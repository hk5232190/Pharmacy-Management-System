$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " PMS Tauri Build Script" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Install PyInstaller
Write-Host "Installing PyInstaller..." -ForegroundColor Cyan
& .\backend\venv\Scripts\pip.exe install pyinstaller --upgrade --quiet

# 2. Prepare clean database template
Write-Host "Preparing clean database template..." -ForegroundColor Cyan
& .\backend\venv\Scripts\python.exe prepare_build.py

# 3. Build Backend with PyInstaller (one-directory mode)
Write-Host "Building Backend (one-directory mode)..." -ForegroundColor Cyan
& .\backend\venv\Scripts\python.exe -m PyInstaller pms-backend.spec --noconfirm

# Verify the one-dir output exists
$backendDir = "dist\pms-backend"
$backendExe = "$backendDir\pms-backend-x86_64-pc-windows-msvc.exe"
$internalDir = "$backendDir\_internal"
if (-not (Test-Path $backendExe)) {
    Write-Host "ERROR: Backend EXE not found at $backendExe" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $internalDir)) {
    Write-Host "ERROR: _internal directory not found at $internalDir" -ForegroundColor Red
    exit 1
}
$fileCount = (Get-ChildItem $backendDir -Recurse -File).Count
Write-Host "Backend built: $backendDir ($fileCount files, _internal/ present)" -ForegroundColor Green

# 4. Copy one-dir backend to pms-backend/ for Tauri resources (preserves _internal/ structure natively via array syntax)
Write-Host "Copying backend to pms-backend/ for Tauri..." -ForegroundColor Cyan
$bundleTarget = "frontend\src-tauri\pms-backend"
if (Test-Path $bundleTarget) { Remove-Item $bundleTarget -Recurse -Force }
New-Item -ItemType Directory -Path $bundleTarget -Force | Out-Null
Copy-Item "$backendDir\*" -Destination $bundleTarget -Recurse -Force
Write-Host "  EXE: $(Test-Path "$bundleTarget\pms-backend-x86_64-pc-windows-msvc.exe")" -ForegroundColor Green
Write-Host "  _internal/: $(Test-Path "$bundleTarget\_internal")" -ForegroundColor Green
Write-Host "  Files: $((Get-ChildItem $bundleTarget -Recurse -File).Count)" -ForegroundColor Green

# 5. Build Frontend (Next.js static export)
Write-Host "Building Frontend (Next.js)..." -ForegroundColor Cyan
Set-Location frontend
npm install --prefer-offline
npm run build
Set-Location ..

# 6. Build Tauri NSIS installer
Write-Host "Building Tauri Application (NSIS Installer)..." -ForegroundColor Cyan
Set-Location frontend
npm run tauri build
Set-Location ..

Write-Host "=============================================" -ForegroundColor Green
Write-Host " Build Complete!" -ForegroundColor Green
$exe = Get-ChildItem "frontend\src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($exe) {
    Write-Host " Installer: $($exe.FullName)" -ForegroundColor Green
    Write-Host " Size: $([math]::Round($exe.Length / 1MB, 1)) MB" -ForegroundColor Green
}
Write-Host "=============================================" -ForegroundColor Green