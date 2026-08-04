# CertiWatch agent installer for Windows.
# Usage (run as Administrator):
#   $s = irm __API_BASE_URL__/api/devices/install.ps1
#   & ([scriptblock]::Create($s)) -Code 'YOUR-CODE' -Path 'C:\CertiWatch\Watch' -Name 'device name'
param(
    [Parameter(Mandatory = $true)]
    [string]$Code,

    [Parameter(Mandatory = $true)]
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
