# Agent Installation

The agent is a local service that watches one or more folders on a staff machine or NAS for new
certificate files (`.pdf`, `.png`, `.jpg`, `.jpeg`, up to 20MB each) and uploads them to CertiWatch,
where the existing OCR pipeline extracts staff name, course, issuer, and dates automatically.

## 1. Get an enrollment code

From the CertiWatch dashboard, go to **Devices** and click **Generate enrollment code**. The code is
shown once, is tenant-scoped, and expires after 24 hours (minting a new one revokes the previous
one) — treat it like a password for the duration it's valid.

## 2. Configuration

The agent reads config from environment variables prefixed with `Agent__` (double underscore — this
is standard .NET configuration binding, not a typo):

| Variable | Required | Description |
|---|---|---|
| `Agent__ApiBaseUrl` | Yes | The CertiWatch API URL, e.g. `https://api.yourcompany.com` |
| `Agent__EnrollmentCode` | Yes (first run only) | The code from step 1. Only needed until the agent enrolls and saves its device token; can be removed after. |
| `Agent__DeviceName` | No | Defaults to the machine's hostname |
| `Agent__WatchPaths__0` | No | Folder to watch. Defaults to the current user's Documents folder. Add `__1`, `__2`, etc. for additional folders |

## 3. Install as a service

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

## How it behaves

- Watches the configured folder(s) via both a live filesystem watcher and a 60-second re-scan (the
  re-scan also acts as the retry mechanism for anything that failed to upload).
- Skips files by extension/size before doing any work, then dedupes by SHA-256 hash against a local
  `processed-files.json` (persisted next to the agent binary, so restarts don't re-upload everything)
  and a server-side check.
- Uploads the real file — not extracted text — so the server's OCR pipeline does the actual reading;
  the agent itself never parses documents.
- Sends a heartbeat every 60 seconds so the Devices page's "last seen" / online status stays accurate.
