$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================"
Write-Host " EchoVerse Windows Installer Build"
Write-Host "======================================"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "HATA: Node.js bulunamadi."
    Write-Host "https://nodejs.org adresinden LTS kur."
    exit 1
}

Write-Host "[1/3] Paketler kuruluyor..."
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[2/3] Uygulama derleniyor..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[3/3] Windows installer olusturuluyor..."
npx electron-builder --win nsis
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "======================================"
Write-Host " TAMAMLANDI"
Write-Host "======================================"
Write-Host ""
Write-Host "Installer release klasorunde:"
Get-ChildItem ".\release\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host $_.FullName
}
Write-Host ""
pause
