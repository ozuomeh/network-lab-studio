#!/usr/bin/env bash
# Bootstrap script for Network Lab Studio's engine host.
#
# Run this ON THE LINUX HOST (bare metal, a Linux VM, or WSL2's Ubuntu
# distro) that will run `apps/engine` — i.e. the one that actually launches
# Docker containers and QEMU VMs. It checks/installs the system-level
# prerequisites (Docker, QEMU/KVM, iproute2), adds your user to the right
# groups, and runs `pnpm install` for the whole workspace.
#
# It deliberately does NOT touch sudoers (passwordless sudo). The engine
# needs passwordless sudo for bridge/tap/iptables commands during
# development (see README "Privileges" section) — that's a meaningful
# security decision left to you; this script prints the exact command at
# the end instead of running it.
#
# Usage: ./scripts/bootstrap.sh

set -euo pipefail

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m\xe2\x9c\x93\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m\xc3\x97\033[0m %s\n' "$1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

bold "Network Lab Studio — engine host bootstrap"
echo "Repo: $REPO_ROOT"
echo

# --- 1. Platform check -------------------------------------------------
if [[ "$(uname -s)" != "Linux" ]]; then
  fail "This must run on Linux (the engine needs Docker, QEMU/KVM, and Linux networking commands)."
  echo "  On Windows, run this inside a WSL2 Ubuntu distro instead."
  exit 1
fi
ok "Running on Linux ($(uname -r))"

IS_WSL=false
if grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=true
  ok "Detected WSL2"
fi

if ! command -v apt-get >/dev/null 2>&1; then
  fail "This script only automates apt-based distros (Debian/Ubuntu)."
  echo "  On another distro, install manually: docker, qemu-system-x86_64, qemu-img, iproute2, iptables, bridge-utils, node >=20, pnpm."
  exit 1
fi

# --- 2. KVM availability ------------------------------------------------
bold "Checking KVM"
if [[ -e /dev/kvm ]]; then
  ok "/dev/kvm exists"
else
  warn "/dev/kvm not found — QEMU nodes need hardware virtualization."
  if $IS_WSL; then
    echo "  WSL2 nested virtualization needs: a CPU that supports it, and no Windows"
    echo "  security feature (Credential Guard / Memory Integrity / HVCI) blocking it."
    echo "  After fixing that, run: wsl --shutdown  (from PowerShell), then reopen this distro."
  else
    echo "  Check BIOS virtualization extensions (VT-x/AMD-V) are enabled, and that"
    echo "  your user/kernel actually exposes /dev/kvm (cpu-checker's kvm-ok can confirm)."
  fi
fi

# --- 3. System packages ---------------------------------------------------
bold "System packages (docker.io, qemu-system-x86, qemu-utils, bridge-utils, iproute2)"
NEEDED_PKGS=()
for pkg in docker.io qemu-system-x86 qemu-utils bridge-utils iproute2; do
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    ok "$pkg already installed"
  else
    NEEDED_PKGS+=("$pkg")
  fi
done

if [[ ${#NEEDED_PKGS[@]} -gt 0 ]]; then
  echo "  Installing: ${NEEDED_PKGS[*]}"
  sudo apt-get update
  sudo apt-get install -y "${NEEDED_PKGS[@]}"
  ok "Installed: ${NEEDED_PKGS[*]}"
fi

# --- 4. Group membership -------------------------------------------------
bold "Group membership (docker, kvm)"
NEEDED_GROUPS=()
for grp in docker kvm; do
  if id -nG "$USER" | grep -qw "$grp"; then
    ok "$USER is in '$grp'"
  else
    NEEDED_GROUPS+=("$grp")
  fi
done
if [[ ${#NEEDED_GROUPS[@]} -gt 0 ]]; then
  joined=$(IFS=,; echo "${NEEDED_GROUPS[*]}")
  sudo usermod -aG "$joined" "$USER"
  warn "Added $USER to: $joined — this needs a fresh shell/session to take effect."
  if $IS_WSL; then
    echo "  Run: wsl --shutdown  (from PowerShell), then reopen this distro."
  else
    echo "  Log out and back in (or run: newgrp $joined) before using the engine."
  fi
fi

# --- 5. Node.js / pnpm ------------------------------------------------
bold "Node.js and pnpm"
if command -v node >/dev/null 2>&1; then
  NODE_VER="$(node -v)"
  ok "node $NODE_VER found ($(command -v node))"
  if $IS_WSL; then
    case "$(command -v node)" in
      /mnt/c/*) warn "This 'node' resolves to a Windows install via WSL interop — prefer a Linux-native Node (nvm, or your distro's nodesource setup) so native modules (e.g. in apps/engine) build correctly." ;;
    esac
  fi
else
  fail "node not found. Install Node.js >=20 (nvm, nodesource, or your distro's package) before continuing."
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  case "$(command -v pnpm)" in
    /mnt/c/*)
      warn "'pnpm' resolves to a Windows install via WSL interop — this breaks native/platform-sensitive code (confirmed firsthand: dockerode defaulted to a Windows named pipe instead of /var/run/docker.sock)."
      echo "  Fix: corepack enable   (or) npm install -g pnpm --prefix \$(dirname \$(dirname \$(command -v node)))"
      echo "  Then make sure that directory precedes any /mnt/c/... entries on PATH."
      ;;
    *) ok "pnpm found ($(command -v pnpm))" ;;
  esac
else
  echo "  Installing pnpm via corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
  ok "pnpm installed via corepack"
fi

# --- 6. Install workspace dependencies ------------------------------------
bold "Installing workspace dependencies"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  ok "pnpm install complete"
else
  warn "Skipped — fix pnpm above, then run 'pnpm install' yourself."
fi

# --- Summary ---------------------------------------------------------
echo
bold "Summary"
if [[ ${#NEEDED_GROUPS[@]} -gt 0 ]]; then
  warn "Restart your shell/WSL session for new group membership to take effect, then re-run this script to verify."
fi
echo
bold "One more thing — NOT done automatically:"
cat <<'EOF'
  The engine runs privileged commands (ip, iptables, nsenter) during
  development and needs passwordless sudo for your user. This is a real
  security relaxation, so it's left to you — only do this on a disposable/
  personal dev host, never a shared or production machine:

    echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/dev-nopasswd
    sudo chmod 440 /etc/sudoers.d/dev-nopasswd

  See README.md "Privileges" for the narrower, command-scoped alternative.
EOF
