# Network Lab Studio

A browser-based network topology lab emulator: design a network visually,
start it, and get real Docker containers and QEMU VMs wired together with
real L2 connectivity — with live console access to every node, right in the
browser.

This is an original, independently-designed app. It's inspired only by the
*publicly documented concept* of this class of tool (draw a topology,
provision real devices, wire them together, give console access) — nothing
here is derived from, or based on inspecting, any proprietary product.

## How it works

```
apps/web      React + Vite topology editor (React Flow canvas, xterm.js consoles)
apps/api      Fastify REST + WebSocket gateway (lab CRUD, start/stop, console relay)
apps/engine   Docker + QEMU drivers, Linux bridge/veth/tap network wiring,
              console sessions — the privileged piece, Linux-only
packages/shared-types   Lab/NodeType/Node/Link domain model (Zod schemas),
                        shared by all three apps
```

A **Lab** is a topology (nodes + links) saved as one JSON file. Starting a
lab spins up each node via the right driver (`DockerDriver` or `QemuDriver`),
then wires every link as its own Linux bridge, with each endpoint attaching
whatever interface type it has (a veth for a container, a tap for a VM) — so
a container and a VM can sit on the same link transparently.

## Prerequisites

The **engine must run on Linux with KVM** — it shells out to `docker`,
`qemu-system-x86_64`, `ip`, and `iptables`, and reads `/dev/kvm` directly.
There is no native Windows or macOS path.

- **Linux host**: bare metal, a Linux VM, or **WSL2** (Ubuntu) on Windows.
- Node.js ≥ 20, pnpm
- Docker Engine, QEMU/KVM, `iproute2`
- Passwordless `sudo` for the user running the engine (see
  [Privileges](#privileges) — this is a deliberate dev-only tradeoff, not
  done automatically by anything in this repo)

The web/API layers are plain TypeScript with no Linux-specific dependency —
only the engine needs the Linux/KVM host.

## Quick start

```bash
git clone <this-repo> network-lab-studio
cd network-lab-studio

# On the Linux host that will run the engine (WSL2 Ubuntu, a Linux VM, bare metal):
./scripts/bootstrap.sh
```

The bootstrap script checks/installs Docker, QEMU/KVM, and `iproute2`, adds
your user to the `docker`/`kvm` groups, sets up pnpm if needed, and runs
`pnpm install`. It does **not** touch sudoers — it prints the passwordless-
sudo command at the end for you to run yourself, since that's a real
security decision.

If your group membership changed, restart your shell/WSL session
(`wsl --shutdown` from PowerShell, then reopen the distro) before continuing.

Then:

```bash
pnpm build       # builds all packages once (good first-run sanity check)
pnpm dev         # runs apps/api and apps/web together, with live reload
```

Open the URL `apps/web`'s dev server prints (default `http://localhost:5173`).

## Privileges

The engine needs to run `ip`, `iptables`, and `nsenter` to wire up bridges,
taps, and veth pairs, and needs `/dev/kvm` access for QEMU. For development,
the simplest path (what the bootstrap script suggests) is passwordless sudo
for your user on that one host:

```bash
echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/dev-nopasswd
sudo chmod 440 /etc/sudoers.d/dev-nopasswd
```

**Only do this on a disposable/personal dev machine** — never a shared or
production host. A narrower (safer, more setup) alternative is scoping
`NOPASSWD` to just the specific commands the engine runs
(`ip`, `iptables`, `nsenter`, `qemu-system-x86_64`) via a dedicated
`/etc/sudoers.d` rule, instead of blanket `ALL`. Proper capability-scoping
(`CAP_NET_ADMIN` via `setcap`, no sudo at all) is accepted as a known MVP
gap — see [Limitations](#known-limitations).

## Running the pieces individually

```bash
pnpm --filter @network-lab-studio/api dev      # API on http://127.0.0.1:4001
pnpm --filter @network-lab-studio/web dev      # web on http://127.0.0.1:5173
```

The web dev server proxies `/api/*` (including the console WebSocket) to the
API — no CORS/proxy config needed beyond what's already in
`apps/web/vite.config.ts`.

## Production / unattended install

For a dedicated lab host (not day-to-day dev), `apps/api` can serve the
built frontend directly — one process, one port:

```bash
pnpm build
HOST=0.0.0.0 node apps/api/dist/index.js
```

Open `http://<host-ip>:4001`. `WEB_DIST_DIR`/`LABS_DIR`/`PORT` are all
overridable via environment variables (see `apps/api/src/index.ts`).

For a fully unattended install — boot the stock Ubuntu Server LTS ISO,
walk away, come back to a running host — see
[`install/README.md`](install/README.md). It pairs an
[autoinstall](https://ubuntu.com/server/docs/install/autoinstall) config
with the official ISO (no custom/respun image) and installs a systemd
service (`install/systemd/network-lab-studio.service`) that starts the app
on boot.

## Testing

```bash
pnpm test        # all packages
pnpm typecheck
pnpm build
```

`apps/engine`'s tests are **real integration tests** — they start actual
Docker containers and (for the QEMU test) boot a real VM, so they only pass
on a properly set-up Linux/KVM host, and the QEMU test specifically needs
local test fixtures (see below) that aren't committed to the repo.

## Adding QEMU images

Nothing is bundled or auto-downloaded — every QEMU node points at a local
disk image you supply yourself. In the web UI, select a QEMU node and use
the inspector panel to set:

- **Image path** — absolute path to your `.qcow2` (or other QEMU-compatible)
  disk image, as seen from the Linux engine host
- **CPUs** / **Memory** — straightforward
- **Extra QEMU args** — an escape hatch for anything else (e.g.
  `-kernel /path/vmlinuz -initrd /path/initrd -append console=ttyS0` to boot
  from an external kernel instead of the disk's own bootloader)

Put image files under `images/` in the repo (gitignored — never committed)
or anywhere else on the engine host's filesystem.

## Known limitations

Deliberate MVP scope, not oversights:

- **Single host only** — no clustering; everything runs on the one engine
  host (see the "multi-host clustering" discussion if you're considering it
  — it's a materially bigger rework, not a small addition)
- **No auth / multi-user** — single-user, trusted-host assumption
- **Engine needs passwordless sudo** (or runs as root — see the systemd
  unit) — no capability-scoping yet
- **Status is polled**, not pushed — the UI polls `/status` every 3s rather
  than a live events WebSocket; simple and good enough so far
- **No image acquisition tooling** — by design; you always supply your own

## Troubleshooting

A few non-obvious things we hit building this, in case you hit them too:

- **Console WebSocket hangs forever, no error** — Vite's dev proxy does
  *not* forward WebSocket upgrades with the plain string shorthand in
  `server.proxy`; it needs `{ target, ws: true }` explicitly. Already set
  correctly in `apps/web/vite.config.ts` — worth knowing if you ever touch
  that config.
- **`dockerode` connects to a Windows named pipe instead of
  `/var/run/docker.sock`** — means something in your shell resolved a
  Windows-installed `node`/`pnpm` instead of the Linux one (common under
  WSL2 if a Windows-side global install shadows the Linux one on `PATH`).
  Check `command -v node` and `command -v pnpm` — both should point inside
  Linux (`/usr/...`, `/home/...`, not `/mnt/c/...`).
- **A bridge you created has zero connectivity** — Docker sets the
  iptables `FORWARD` chain's default policy to `DROP`. Any bridge the
  engine creates gets an explicit per-bridge `ACCEPT` rule for exactly this
  reason (see `apps/engine/src/net/LinkWiring.ts`).
- **QEMU's serial console shows garbage bytes** — that's Telnet IAC
  negotiation from QEMU's own `-serial telnet:...` backend; filtered out in
  `apps/engine/src/console/telnetFilter.ts`.
