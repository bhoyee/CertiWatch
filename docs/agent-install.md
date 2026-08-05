# Agent Installation

The agent is a local service that watches one or more folders on a staff machine or NAS for new
certificate files (`.pdf`, `.png`, `.jpg`, `.jpeg`, up to 20MB each) and uploads them to CertiWatch,
where the existing OCR pipeline extracts staff name, course, issuer, and dates automatically.

## The quick way

1. From the CertiWatch dashboard, go to **Devices** and click **Generate enrollment code**.
   Optionally fill in the folder to watch if you already know the exact path.
2. Copy the one-line command shown for your OS and run it (as Administrator on Windows, with
   `sudo` on Linux/macOS). It downloads the agent, installs it as a service, and starts it — no
   SDK, no source checkout, no manual configuration. If you didn't specify a folder in step 1,
   the script opens a native folder picker on the machine you run it on (falls back to a typed
   prompt on headless machines with no desktop session, e.g. over SSH).

That's it for most installs. The rest of this doc covers what that command does under the hood
and the manual/build-from-source path for unsupported platforms.

**Not code-signed yet** — Windows/macOS will show an "unknown publisher" warning the first run.
That's expected until paid code-signing certs are added; it isn't a sign anything's wrong.

## Manual install / configuration reference

The agent reads config from environment variables prefixed with `Agent__` (double underscore —
this is standard .NET configuration binding, not a typo), or from a single `agent.settings.json`
file next to the binary (this is what the one-line installer writes for you):

| Variable | Required | Description |
|---|---|---|
| `Agent__ApiBaseUrl` | Yes | The CertiWatch API URL, e.g. `https://api.yourcompany.com` |
| `Agent__EnrollmentCode` | Yes (first run only) | An enrollment code from the Devices page. Only needed until the agent enrolls and saves its device credentials to disk (`device-credentials.json`) - subsequent restarts reuse those and never re-enroll. |
| `Agent__DeviceName` | No | Defaults to the machine's hostname |
| `Agent__WatchPaths__0` | Yes | Folder to watch. No default — an agent started with no watch paths configured logs a warning and watches nothing. Add `__1`, `__2`, etc. for additional folders |

### Windows Service
```powershell
$env:Agent__ApiBaseUrl="https://api.yourcompany.com"
$env:Agent__EnrollmentCode="TENANT-CODE"
$env:Agent__DeviceName="Ops-Laptop"
New-Service -Name CertiWatchAgent -BinaryPathName "C:\Program Files\CertiWatch\certiwatch-agent.exe" -StartupType Automatic
Start-Service CertiWatchAgent
```

### Linux (systemd)
```bash
sudo cp apps/agent/bin/Release/net8.0/publish/certiwatch-agent /usr/local/bin/
cat <<'UNIT' | sudo tee /etc/systemd/system/certiwatch-agent.service
[Unit]
Description=CertiWatch Local Agent
After=network.target

[Service]
Type=notify
Environment=Agent__ApiBaseUrl=https://api.yourcompany.com
Environment=Agent__EnrollmentCode=TENANT-CODE
Environment=Agent__DeviceName=%H
ExecStart=/usr/local/bin/certiwatch-agent
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable --now certiwatch-agent
```

### macOS (launchd)
Provide a `.plist` referencing the agent binary with the same `Agent__*` environment variables under
an `<EnvironmentVariables>` dict.

## Releases

`dotnet publish -r <win-x64|linux-x64|osx-x64|osx-arm64> --self-contained true
-p:PublishSingleFile=true` builds a standalone binary per platform (no .NET runtime needed on the
target machine). `.github/workflows/agent-release.yml` builds all four on every push to `main`
that touches `apps/agent/**` and publishes them to a rolling `agent-latest` GitHub Release - this
is what the one-line install scripts (served from `GET /api/devices/install.sh` /
`/install.ps1`) download.

## How it behaves

- On first run, enrolls once using the code and persists the resulting device credentials to
  `device-credentials.json` next to the binary; every subsequent start reuses them instead of
  re-enrolling (enrollment codes are one-time and expire, so re-enrolling on every restart would
  break the service after 24h and would create a duplicate Device entry on every restart in the
  meantime).
- Watches the configured folder(s) via both a live filesystem watcher and a 60-second re-scan (the
  re-scan also acts as the retry mechanism for anything that failed to upload).
- Skips files by extension/size before doing any work, then dedupes by SHA-256 hash against a local
  `processed-files.json` (persisted next to the agent binary, so restarts don't re-upload everything)
  and a server-side check.
- Uploads the real file — not extracted text — so the server's OCR pipeline does the actual reading;
  the agent itself never parses documents.
- Sends a heartbeat every 60 seconds so the Devices page's "last seen" / online status stays accurate,
  including the folder(s) it's currently watching (shown in the Devices table).
- Removing a device from the Devices page immediately invalidates its device token server-side -
  the agent process keeps running until stopped locally, but every call it makes gets rejected from
  that point on. Re-enrolling it means installing again with a fresh code.
