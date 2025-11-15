# Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Agent stuck offline | Check Windows Event Viewer / `journalctl -u certiwatch-agent`, verify enrollment code and TLS connectivity. |
| OCR queue growing | Confirm Azure Vision credentials, worker logs, and Redis connectivity. Worker falls back to local parsing automatically. |
| Digest email missing | Ensure ReminderScheduler job running (API logs) and email provider key loaded from Key Vault. |
| Terraform apply fails | Run `az login`, confirm subscription, and re-run `terraform init -upgrade`. |
