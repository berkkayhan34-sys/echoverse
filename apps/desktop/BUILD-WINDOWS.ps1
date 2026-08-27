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

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -ne 22) {
    Write-Host "HATA: Node.js 22 LTS gerekli. Bulunan surum: $(node --version)"
    exit 1
}

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repositoryRoot
try {
Write-Host "[1/3] Paketler kuruluyor..."
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[2/3] Uygulama derleniyor..."
npm --workspace=@echoverse/desktop run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[3/3] Windows installer olusturuluyor..."
npm --workspace=@echoverse/desktop run release:win
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "======================================"
Write-Host " TAMAMLANDI"
Write-Host "======================================"
Write-Host ""
Write-Host "Installer release klasorunde:"
Get-ChildItem ".\apps\desktop\release\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host $_.FullName
}
Write-Host ""
pause
} finally {
    Pop-Location
}
