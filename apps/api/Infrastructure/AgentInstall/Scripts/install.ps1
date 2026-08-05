# CertiWatch agent installer for Windows.
# Usage (run as Administrator):
#   $s = irm __API_BASE_URL__/api/devices/install.ps1
#   & ([scriptblock]::Create($s)) -Code 'YOUR-CODE' -Name 'device name'
#   (omit -Path to pick the folder interactively; pass it to skip the prompt for unattended installs)
param(
    [Parameter(Mandatory = $true)]
    [string]$Code,

    [string]$Path,

    [string]$Name = $env:COMPUTERNAME
)

$ErrorActionPreference = "Stop"

$ApiBaseUrl = "__API_BASE_URL__"
$GitHubRepo = "bhoyee/CertiWatch"
$InstallDir = "C:\Program Files\CertiWatch\Agent"

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This installer needs to run as Administrator (it registers a Windows Service). Re-open PowerShell as Administrator and try again."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Path)) {
    # A browser can never hand back a real filesystem path (sandboxed by design), and the folder
    # only exists on whichever machine actually runs this script - so the only place a real
    # "browse" experience can happen is right here, interactively, at install time.
    $pickedPath = $null
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Choose the folder CertiWatch should watch for new certificates"
        $dialog.ShowNewFolderButton = $true
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $pickedPath = $dialog.SelectedPath
        }
    } catch {
        # No desktop session available (e.g. running over SSH/headless) - System.Windows.Forms
        # can't show a dialog there, so fall through to a plain text prompt below.
    }

    if ($pickedPath) {
        $Path = $pickedPath
    } else {
        $Path = Read-Host "Folder to watch for new certificates (e.g. C:\CertiWatch\Watch)"
    }

    if ([string]::IsNullOrWhiteSpace($Path)) {
        Write-Error "No folder selected. Re-run and either pick a folder or pass -Path explicitly."
        exit 1
    }
}

$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -ne "AMD64") {
    Write-Error "Unsupported architecture: $arch. Only win-x64 is published today."
    exit 1
}

$asset = "certiwatch-agent-win-x64.zip"
$downloadUrl = "https://github.com/$GitHubRepo/releases/download/agent-latest/$asset"

Write-Host "Downloading agent (win-x64)..."
$tempZip = Join-Path $env:TEMP "certiwatch-agent.zip"
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip

if (Test-Path $InstallDir) {
    $existing = Get-Service -Name CertiWatchAgent -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-Service -Name CertiWatchAgent -ErrorAction SilentlyContinue
    }
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Expand-Archive -Path $tempZip -DestinationPath $InstallDir -Force
Remove-Item $tempZip

if (-not (Test-Path $Path)) {
    Write-Host "Creating watch folder: $Path"
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

$settings = @{
    Agent = @{
        ApiBaseUrl     = $ApiBaseUrl
        EnrollmentCode = $Code
        DeviceName     = $Name
        WatchPaths     = @($Path)
    }
} | ConvertTo-Json -Depth 3
Set-Content -Path (Join-Path $InstallDir "agent.settings.json") -Value $settings -Encoding UTF8

$exePath = Join-Path $InstallDir "CertiWatch.Agent.exe"

if (Get-Service -Name CertiWatchAgent -ErrorAction SilentlyContinue) {
    sc.exe delete CertiWatchAgent | Out-Null
    Start-Sleep -Seconds 1
}

New-Service -Name CertiWatchAgent `
    -BinaryPathName "`"$exePath`"" `
    -DisplayName "CertiWatch Agent" `
    -StartupType Automatic | Out-Null
Start-Service -Name CertiWatchAgent

Write-Host "Installed and started. Check status with: Get-Service CertiWatchAgent"
