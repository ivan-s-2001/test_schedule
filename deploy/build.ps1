$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is not installed or docker is not in PATH."
}

$DockerRepo = Join-Path $Root ".frappe_docker"
if (-not (Test-Path $DockerRepo)) {
    git clone --depth 1 https://github.com/frappe/frappe_docker.git $DockerRepo
} else {
    git -C $DockerRepo fetch origin main --depth 1
    git -C $DockerRepo reset --hard origin/main
}

$AppsJson = (Resolve-Path (Join-Path $Root "deploy/apps.json")).Path
$Containerfile = Join-Path $DockerRepo "images/layered/Containerfile"

Write-Host "Building qt/workforce:16 from official Frappe Docker tooling..."
docker build `
    --build-arg "FRAPPE_PATH=https://github.com/frappe/frappe" `
    --build-arg "FRAPPE_BRANCH=version-16" `
    --secret "id=apps_json,src=$AppsJson" `
    --tag "qt/workforce:16" `
    --file $Containerfile `
    $DockerRepo

if ($LASTEXITCODE -ne 0) {
    throw "Docker image build failed."
}

Write-Host "Image built: qt/workforce:16" -ForegroundColor Green
