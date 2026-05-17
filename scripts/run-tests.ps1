# ============================================================
# Ejecutar suite de tests de integración (JUnit + Testcontainers)
# Windows — PowerShell
# Uso: powershell -ExecutionPolicy Bypass .\scripts\run-tests.ps1
# ============================================================

$BackendPath = Join-Path $PSScriptRoot "..\backend"
$M2Path = "$env:USERPROFILE\.m2"

Write-Host "=========================================="
Write-Host " Express Quinuapata — Tests de integración"
Write-Host "=========================================="

# Testcontainers accede a Docker Desktop via named pipe en Windows
docker run --rm `
  -v "${BackendPath}:/app" `
  -v "${M2Path}:/root/.m2" `
  -v "//./pipe/docker_engine://./pipe/docker_engine" `
  -e "DOCKER_HOST=npipe:////./pipe/docker_engine" `
  -e "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=//./pipe/docker_engine" `
  -w /app `
  maven:3.9-eclipse-temurin-17-alpine `
  mvn test -Dspring.profiles.active=test

Write-Host ""
Write-Host "=========================================="
Write-Host " Tests completados."
Write-Host "=========================================="
