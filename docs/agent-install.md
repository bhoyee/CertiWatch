# Agent Installation

## Windows Service
```powershell
$env:API_BASE_URL="https://api.example.com"
$env:ENROLLMENT_CODE="TENANT-CODE"
$env:DEVICE_NAME="Ops-Laptop"
New-Service -Name CertiWatchAgent -BinaryPathName "C:\\Program Files\\CertiWatch\\agent.exe" -StartupType Automatic
Start-Service CertiWatchAgent
```

## Linux (systemd)
```
sudo cp apps/agent/bin/Release/net8.0/publish/certiwatch-agent /usr/local/bin/
cat <<'UNIT' | sudo tee /etc/systemd/system/certiwatch-agent.service
[Unit]
Description=CertiWatch Local Agent
After=network.target

[Service]
Environment=API_BASE_URL=https://api.example.com
Environment=ENROLLMENT_CODE=TENANT-CODE
Environment=DEVICE_NAME=$(hostname)
ExecStart=/usr/local/bin/certiwatch-agent
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable --now certiwatch-agent
```

## macOS (launchd)
Provide a `.plist` referencing the agent binary and the same env variables.

The agent watches the configured folders, computes hashes, extracts inline text, persists offline queue at `%APPDATA%/CertiWatch/queue.json`, and retries until the API accepts the payload.
