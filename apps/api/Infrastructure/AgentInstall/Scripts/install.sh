#!/usr/bin/env bash
# CertiWatch agent installer for Linux/macOS.
# Usage: curl -fsSL <api-base-url>/api/devices/install.sh | sudo bash -s -- --code YOUR-CODE --name "device name"
#   (omit --path to pick the folder interactively; pass it to skip the prompt for unattended installs)
set -euo pipefail

API_BASE_URL="__API_BASE_URL__"
GITHUB_REPO="bhoyee/CertiWatch"
INSTALL_DIR="/opt/certiwatch-agent"

CODE=""
WATCH_PATH=""
NAME="$(hostname)"

while [ $# -gt 0 ]; do
  case "$1" in
    --code) CODE="$2"; shift 2 ;;
    --path) WATCH_PATH="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$CODE" ]; then
  echo "Missing --code. Generate an enrollment code from the Devices page first." >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer needs to run as root (it registers a system service)." >&2
  echo "Re-run with: curl -fsSL $API_BASE_URL/api/devices/install.sh | sudo bash -s -- --code $CODE --name \"$NAME\"" >&2
  exit 1
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ -z "$WATCH_PATH" ]; then
  # A browser can never hand back a real filesystem path (sandboxed by design), and the folder
  # only exists on whichever machine actually runs this script - so the only place a real
  # "browse" experience can happen is right here, interactively, at install time.
  PICKED=""
  if [ "$OS" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    PICKED="$(osascript -e 'POSIX path of (choose folder with prompt "Choose the folder CertiWatch should watch for new certificates")' 2>/dev/null || true)"
  elif [ "$OS" = "Linux" ] && command -v zenity >/dev/null 2>&1; then
    PICKED="$(zenity --file-selection --directory --title="Choose the folder CertiWatch should watch for new certificates" 2>/dev/null || true)"
  fi

  if [ -n "$PICKED" ]; then
    WATCH_PATH="$PICKED"
  elif [ -r /dev/tty ]; then
    # No GUI session available (headless server, SSH, NAS) - fall back to a plain prompt. This
    # script is normally run as `curl ... | sudo bash`, which occupies stdin with the piped
    # script itself, so the prompt has to read from the controlling terminal directly instead.
    read -r -p "Folder to watch for new certificates (e.g. /mnt/certificates): " WATCH_PATH < /dev/tty
  fi

  if [ -z "$WATCH_PATH" ]; then
    echo "No folder selected. Re-run and either pick a folder or pass --path explicitly." >&2
    exit 1
  fi
fi

if [ ! -d "$WATCH_PATH" ]; then
  echo "Creating watch folder: $WATCH_PATH"
  mkdir -p "$WATCH_PATH"
fi

case "$OS" in
  Linux)
    case "$ARCH" in
      x86_64) RID="linux-x64" ;;
      aarch64|arm64) echo "Linux arm64 is not published yet - build from source instead (see docs/agent-install.md)." >&2; exit 1 ;;
      *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
    esac
    ;;
  Darwin)
    case "$ARCH" in
      x86_64) RID="osx-x64" ;;
      arm64) RID="osx-arm64" ;;
      *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported OS: $OS. Use install.ps1 on Windows." >&2
    exit 1
    ;;
esac

ASSET="certiwatch-agent-${RID}.tar.gz"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/agent-latest/${ASSET}"

echo "Downloading agent (${RID})..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$ASSET"

mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_DIR/$ASSET" -C "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/CertiWatch.Agent"

cat > "$INSTALL_DIR/agent.settings.json" <<SETTINGS
{
  "Agent": {
    "ApiBaseUrl": "${API_BASE_URL}",
    "EnrollmentCode": "${CODE}",
    "DeviceName": "${NAME}",
    "WatchPaths": ["${WATCH_PATH}"]
  }
}
SETTINGS

if [ "$OS" = "Linux" ]; then
  cat > /etc/systemd/system/certiwatch-agent.service <<UNIT
[Unit]
Description=CertiWatch Local Agent
After=network.target

[Service]
Type=notify
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/CertiWatch.Agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now certiwatch-agent
  echo "Installed and started. Check status with: systemctl status certiwatch-agent"
else
  PLIST=/Library/LaunchDaemons/com.certiwatch.agent.plist
  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.certiwatch.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/CertiWatch.Agent</string>
  </array>
  <key>WorkingDirectory</key><string>${INSTALL_DIR}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
PLIST_EOF
  launchctl load -w "$PLIST"
  echo "Installed and started. Check status with: launchctl list | grep certiwatch"
fi
