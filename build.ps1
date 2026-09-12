$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " PMS Tauri Build Script" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Install Rust/Cargo if missing
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "Rust/Cargo not found. Installing Rust..." -ForegroundColor Yellow
    $rustupPath = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupPath
    Start-Process -FilePath $rustupPath -ArgumentList "-y" -Wait -NoNewWindow
    Remove-Item -Path $rustupPath
    
    # Update PATH for the current session
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
    Write-Host "Rust installed successfully." -ForegroundColor Green
} else {
    Write-Host "Rust is already installed." -ForegroundColor Green
}

# 2. Check for Visual Studio Build Tools (required by Rust on Windows)
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false
if (Test-Path $vsWhere) {
    $tools = & $vsWhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($tools) { $hasBuildTools = $true }
}
if (-not $hasBuildTools -and -not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
    Write-Host "Visual Studio C++ Build Tools not found. Installing via winget..." -ForegroundColor Yellow
    Start-Process -FilePath "winget" -ArgumentList "install --id Microsoft.VisualStudio.2022.BuildTools --silent --override `"--wait --add Microsoft.VisualStudio.Workload.VCTools;includeRecommended`"" -Wait -NoNewWindow
    Write-Host "VS Build Tools installed. You may need to restart your terminal for all environment variables to load." -ForegroundColor Yellow
} else {
    Write-Host "VS Build Tools are present." -ForegroundColor Green
}

# 3. Build Frontend
Write-Host "Building Frontend (Next.js)..." -ForegroundColor Cyan
Set-Location frontend
npm install
npm run build
Set-Location ..

# 4. Install PyInstaller in the backend venv
Write-Host "Installing PyInstaller..." -ForegroundColor Cyan
& .\backend\venv\Scripts\pip.exe install pyinstaller --upgrade

# 5. Build Backend Sidecar
Write-Host "Building Backend Sidecar with PyInstaller..." -ForegroundColor Cyan
& .\backend\venv\Scripts\python.exe -m PyInstaller pms-backend.spec --noconfirm

# 6. Copy Sidecar to Tauri binaries directory
Write-Host "Copying sidecar to Tauri binaries..." -ForegroundColor Cyan
$binDir = "frontend\src-tauri\binaries"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }
Copy-Item "dist\pms-backend-x86_64-pc-windows-msvc.exe" -Destination "$binDir\pms-backend-x86_64-pc-windows-msvc.exe" -Force

# 7. Install Tauri CLI if missing
if (-not (Get-Command "cargo-tauri" -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli --version "^2.0.0"
}

# 8. Build Tauri App
Write-Host "Building Tauri Application (NSIS Installer)..." -ForegroundColor Cyan
Set-Location frontend
npm run tauri build
Set-Location ..

Write-Host "=============================================" -ForegroundColor Green
Write-Host " Build Complete!" -ForegroundColor Green
Write-Host " Installer can be found at:" -ForegroundColor Green
Write-Host " e:\Projects\PMS-Software\frontend\src-tauri\target\release\bundle\nsis\" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
