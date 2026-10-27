# Unattended install (autoinstall)

Boot the **stock, official Ubuntu Server LTS ISO** (22.04 or 24.04 — do not
modify/respin it) paired with the autoinstall config in this folder, and end
up with a running Network Lab Studio host with no manual steps after boot.

This builds nothing custom and distributes no large files of its own — just
a small config layered on top of an ISO you download directly from Ubuntu.

## 1. Edit the config first

Open `autoinstall/user-data` and replace the one remaining `REPLACE_ME` value:

- **Login password hash** — generate one yourself, never reuse this example:
  ```bash
  openssl passwd -6 'your-password-here'
  ```
  Paste the output (starts with `$6$...`) in place of the placeholder.

The repo clone URL needs no edits — this repo is public, so the
unattended `git clone` during install authenticates fine as-is. If you
fork it and keep your fork private, either make the fork public or
substitute an authenticated URL in your own **local, uncommitted** copy of
the file (e.g. `https://<token>@github.com/<you>/<repo>.git`) — never
commit a token.

Everything else (hostname, username, package list, late-commands) is
reasonable defaults — adjust `network:` if your target's NICs don't match
`en*` (e.g. older `eth0` naming).

## 2. Build a NoCloud seed image

The installer needs `user-data` + `meta-data` on a volume labeled `cidata`:

```bash
cd install/autoinstall
genisoimage -output seed.iso -volid cidata -joliet -rock user-data meta-data
# (or: cloud-localds seed.iso user-data meta-data, if cloud-image-utils is installed)
```

## 3a. Test it in QEMU (recommended before real hardware)

```bash
# Download the official ISO yourself — not included here:
#   https://ubuntu.com/download/server  (24.04 or 22.04 LTS)

qemu-system-x86_64 -enable-kvm -cpu host -smp 2 -m 4096 \
  -drive file=install-test.qcow2,if=virtio,format=qcow2 \
  -cdrom ubuntu-24.04-live-server-amd64.iso \
  -drive file=seed.iso,if=virtio,format=raw \
  -boot d
```

(Create `install-test.qcow2` first with `qemu-img create -f qcow2 install-test.qcow2 20G`.)

At the GRUB boot menu, press `e`, add ` autoinstall ds=nocloud` to the linux
line, then Ctrl+X / F10 to boot. The install proceeds unattended and
reboots when done.

For a fully scripted test (no interactive GRUB editing), boot the kernel
and initrd extracted from the ISO's own `/casper/` directory directly via
QEMU's `-kernel`/`-initrd`/`-append "autoinstall ds=nocloud"` instead of
`-boot d` — but add **`-no-reboot`** too. Without it, when the installer
finishes and the guest requests a reboot, QEMU just re-executes the same
`-kernel`/`-initrd`/`-append` again instead of falling through to the
installed disk's own GRUB, silently re-running the whole install a second
time on top of itself (this is exactly what happened the first time this
was tested — caught by noticing the late-commands log repeating from the
top). With `-no-reboot`, QEMU exits cleanly when the installer reboots,
which you can poll for as your "install finished" signal; then boot the
resulting disk again, this time with neither flag, to verify the installed
system itself.

## 3b. Real hardware (USB)

1. Write the official Ubuntu Server ISO to a USB drive (e.g. with
   [Rufus](https://rufus.ie) on Windows, or `dd` on Linux/Mac).
2. Add a second small volume to that same USB (or a second USB) labeled
   `cidata` containing `user-data` and `meta-data` — or write `seed.iso`
   from step 2 to its own USB stick.
3. Boot the target machine from the Ubuntu USB, with the seed USB also
   attached. At the GRUB menu, press `e`, add ` autoinstall ds=nocloud`,
   boot.
4. Walk away. It installs Ubuntu, sets up Docker/QEMU/Node/pnpm, clones and
   builds the app, and enables the systemd service — then reboots into a
   running host.

## After it's up

```bash
ssh labadmin@<host-ip>
systemctl status network-lab-studio
```

Open `http://<host-ip>:4001` in a browser — that's the API serving the
built frontend directly (see root README's "Running the pieces
individually" for the dev-mode alternative, where web and API run as
separate processes on different ports instead).

## What's actually been verified

This has been boot-tested end-to-end in QEMU, not just schema-validated:
booted the real Ubuntu Server 24.04.5 LTS ISO against this exact config
(only the password placeholder filled in), watched all 8 `late-commands`
execute successfully in order — including the heavy one,
`pnpm install && pnpm build` — through to the systemd service being
installed and enabled, then booted the resulting disk a second time via
its own GRUB (no QEMU flags) and confirmed the service auto-started:
real HTTP responses from `/api/health`, the built frontend from `/`, and
a 200 (not 404) from a client-side route, proving the SPA fallback works
too.

Two things worth knowing if you retest this yourself: a scripted
`-kernel`/`-initrd` test run needs `-no-reboot` (see the note in 3a above)
or it silently reinstalls itself a second time; and one retry hit a
transient `netplan apply` failure very early in the install (before any of
this config's own steps ran) that looked like nested-virtualization
flakiness, not a config defect — a clean retry with the identical config
succeeded fully.
