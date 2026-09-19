$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " PMS Tauri Build Script" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Rust/Cargo check
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "Rust/Cargo not found. Installing Rust..." -ForegroundColor Yellow
    $rustupPath = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupPath
    Start-Process -FilePath $rustupPath -ArgumentList "-y" -Wait -NoNewWindow
    Remove-Item -Path $rustupPath
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
    Write-Host "Rust installed successfully." -ForegroundColor Green
} else {
    Write-Host "Rust is already installed." -ForegroundColor Green
}

# 2. VS Build Tools check
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false
if (Test-Path $vsWhere) {
    $tools = & $vsWhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($tools) { $hasBuildTools = $true }
}
if (-not $hasBuildTools -and -not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
    Write-Host "VS Build Tools not found. Installing via winget..." -ForegroundColor Yellow
    Start-Process -FilePath "winget" -ArgumentList "install --id Microsoft.VisualStudio.2022.BuildTools --silent --override `"--wait --add Microsoft.VisualStudio.Workload.VCTools;includeRecommended`"" -Wait -NoNewWindow
    Write-Host "VS Build Tools installed." -ForegroundColor Yellow
} else {
    Write-Host "VS Build Tools present." -ForegroundColor Green
}

# 3. Install PyInstaller
Write-Host "Installing PyInstaller..." -ForegroundColor Cyan
& .\backend\venv\Scripts\pip.exe install pyinstaller --upgrade

# 4. Prepare clean database template
Write-Host "Preparing clean database template..." -ForegroundColor Cyan
& .\backend\venv\Scripts\python.exe prepare_build.py

# 5. Build Backend with PyInstaller (one-directory mode)
Write-Host "Building Backend (one-directory mode)..." -ForegroundColor Cyan
& .\backend\venv\Scripts\python.exe -m PyInstaller pms-backend.spec --noconfirm

# Verify the one-dir output exists
$backendDir = "dist\pms-backend"
$backendExe  = "$backendDir\pms-backend-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $backendExe)) {
    Write-Host "ERROR: Backend EXE not found at $backendExe" -ForegroundColor Red
    exit 1
}
Write-Host "Backend built at: $backendDir" -ForegroundColor Green

# 6. Copy one-dir backend into Tauri resources folder
Write-Host "Copying backend directory to Tauri resources..." -ForegroundColor Cyan
$resTarget = "frontend\src-tauri\resources\pms-backend"
if (Test-Path $resTarget) {
    Remove-Item $resTarget -Recurse -Force
}
New-Item -ItemType Directory -Path $resTarget -Force | Out-Null
Copy-Item "$backendDir\*" -Destination $resTarget -Recurse -Force
Write-Host "Backend directory copied to: $resTarget" -ForegroundColor Green

# 7. Build Frontend (Next.js static export)
Write-Host "Building Frontend (Next.js)..." -ForegroundColor Cyan
Set-Location frontend
npm install
npm run build
Set-Location ..

# 8. Tauri CLI check
if (-not (Get-Command "cargo-tauri" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli --version "^2.0.0"
}

# 9. Build Tauri NSIS installer
Write-Host "Building Tauri Application (NSIS Installer)..." -ForegroundColor Cyan
Set-Location frontend
npm run tauri build
Set-Location ..

Write-Host "=============================================" -ForegroundColor Green
Write-Host " Build Complete!" -ForegroundColor Green
Write-Host " Installer:" -ForegroundColor Green
Write-Host " frontend\src-tauri\target\release\bundle\nsis\" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
