$ErrorActionPreference = "Stop"

$RequiredNodeVersion = 24
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Install and activate Node via fnm
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = "Continue"
    fnm install $RequiredNodeVersion 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    fnm env --shell power-shell | Invoke-Expression
}

# Check Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Error: Node.js is not installed. Please install fnm, then run this script again."
    exit 1
}

# Check Node.js version
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

# Run the CLI
& node "$ScriptDir\dist\index.js" @args
exit $LASTEXITCODE
