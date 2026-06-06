$ErrorActionPreference = "Stop"

$RequiredNodeVersion = 24
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Ensure-Built {
    if (-not (Test-Path "$ScriptDir\dist")) {
        Write-Host "First run: installing dependencies and building..." -ForegroundColor Yellow
        Push-Location $ScriptDir
        npm install
        npm run build
        Pop-Location
    }
}

# Fast path: if node is already the right version, skip fnm overhead.
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = [int]((node -v) -replace '^v(\d+).*', '$1')
    if ($nodeVersion -ge $RequiredNodeVersion) {
        Ensure-Built
        & node "$ScriptDir\dist\index.js" @args
        exit $LASTEXITCODE
    }
}

# Slow path: activate fnm to get the right Node.js.
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = "Continue"
    $installed = fnm list 2>&1 | Select-String "v${RequiredNodeVersion}\."
    if (-not $installed) {
        Write-Host "Installing Node.js ${RequiredNodeVersion} via fnm..." -ForegroundColor Yellow
        fnm install $RequiredNodeVersion
    }
    $ErrorActionPreference = "Stop"
    fnm env --shell power-shell | Invoke-Expression
} else {
    Write-Error "Error: Node.js ${RequiredNodeVersion}.x or later is required. Please install fnm, then run this script again."
    exit 1
}

Ensure-Built
& node "$ScriptDir\dist\index.js" @args
exit $LASTEXITCODE
