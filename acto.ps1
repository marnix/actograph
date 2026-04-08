$ErrorActionPreference = "Stop"

$RequiredNodeVersion = 24
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Ensure the right Node.js version is available via fnm.
# Install only if the required version isn't already installed.
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = "Continue"
    $installed = fnm list 2>&1 | Select-String "v${RequiredNodeVersion}\."
    if (-not $installed) {
        Write-Host "Installing Node.js ${RequiredNodeVersion} via fnm..." -ForegroundColor Yellow
        fnm install $RequiredNodeVersion
    }
    $ErrorActionPreference = "Stop"
    fnm env --shell power-shell | Invoke-Expression
}

# Check Node.js is installed and meets version requirement
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Error: Node.js is not installed. Please install fnm, then run this script again."
    exit 1
}

$nodeVersion = [int]((node -v) -replace '^v(\d+).*', '$1')
if ($nodeVersion -lt $RequiredNodeVersion) {
    Write-Error "Error: Node.js ${RequiredNodeVersion}.x or later is required. Current version: $(node -v)"
    exit 1
}

# Auto-build after clean checkout
if (-not (Test-Path "$ScriptDir\dist")) {
    Write-Host "First run: installing dependencies and building..." -ForegroundColor Yellow
    Push-Location $ScriptDir
    npm install
    npm run build
    Pop-Location
}

& node "$ScriptDir\dist\index.js" @args
exit $LASTEXITCODE
