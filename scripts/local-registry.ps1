#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Control the local Verdaccio registry used to publish @dreki-gg/* extensions.

.EXAMPLE
  ./scripts/local-registry.ps1 start
  ./scripts/local-registry.ps1 status
  ./scripts/local-registry.ps1 stop
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'status', 'restart', 'logs', 'install-startup', 'uninstall-startup')]
  [string]$Command = 'status'
)

$ErrorActionPreference = 'Stop'

$Registry = 'http://127.0.0.1:4873'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigDir = Join-Path $ScriptDir 'verdaccio'
$ConfigFile = Join-Path $ConfigDir 'config.yaml'
$PidFile = Join-Path $ConfigDir 'verdaccio.pid'
$LogFile = Join-Path $ConfigDir 'verdaccio.log'

function Test-RegistryUp {
  try {
    Invoke-WebRequest -Uri $Registry -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-RunningPid {
  if (Test-Path $PidFile) {
    $procId = (Get-Content $PidFile -Raw).Trim()
    if ($procId -and (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
      return [int]$procId
    }
  }
  return $null
}

switch ($Command) {
  'start' {
    if (Test-RegistryUp) {
      Write-Host "Verdaccio already running at $Registry" -ForegroundColor Green
      break
    }
    Write-Host "Starting Verdaccio (config: $ConfigFile)..." -ForegroundColor Cyan
    # The `verdaccio` command is a shell shim; launch its JS entrypoint via node instead.
    $globalRoot = (npm root -g).Trim()
    $verdaccioBin = Join-Path $globalRoot 'verdaccio/bin/verdaccio'
    if (-not (Test-Path $verdaccioBin)) { Write-Error "Cannot find verdaccio bin at $verdaccioBin (npm install -g verdaccio)" }
    $proc = Start-Process -FilePath 'node' `
      -ArgumentList @($verdaccioBin, '--config', $ConfigFile) `
      -RedirectStandardOutput $LogFile `
      -RedirectStandardError "$LogFile.err" `
      -WindowStyle Hidden -PassThru
    $proc.Id | Out-File -FilePath $PidFile -Encoding ascii

    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 500
      if (Test-RegistryUp) {
        Write-Host "Verdaccio up at $Registry (pid $($proc.Id))" -ForegroundColor Green
        return
      }
    }
    Write-Error "Verdaccio did not come up in time. Check $LogFile / $LogFile.err"
  }
  'stop' {
    $procId = Get-RunningPid
    if ($procId) {
      Stop-Process -Id $procId -Force
      Remove-Item $PidFile -ErrorAction SilentlyContinue
      Write-Host "Stopped Verdaccio (pid $procId)" -ForegroundColor Yellow
    } else {
      Write-Host "Verdaccio not running (no tracked pid)." -ForegroundColor Yellow
    }
  }
  'restart' {
    & $MyInvocation.MyCommand.Path stop
    & $MyInvocation.MyCommand.Path start
  }
  'logs' {
    if (Test-Path $LogFile) { Get-Content $LogFile -Tail 50 } else { Write-Host "No log yet." }
  }
  'status' {
    if (Test-RegistryUp) {
      Write-Host "up   $Registry" -ForegroundColor Green
    } else {
      Write-Host "down $Registry" -ForegroundColor Red
    }
  }
  'install-startup' {
    $taskName = 'DrekiLocalVerdaccio'
    $selfPath = $MyInvocation.MyCommand.Path
    $pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
    if (-not $pwsh) { $pwsh = (Get-Command powershell).Source }
    $action = New-ScheduledTaskAction -Execute $pwsh `
      -Argument "-NoProfile -WindowStyle Hidden -File `"$selfPath`" start"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
      -Settings $settings -Description 'Start local Verdaccio registry at logon' -Force | Out-Null
    Write-Host "Installed scheduled task '$taskName' (runs at your logon)." -ForegroundColor Green
    Write-Host "Manage it: Get-ScheduledTask $taskName  |  Start-ScheduledTask $taskName"
  }
  'uninstall-startup' {
    $taskName = 'DrekiLocalVerdaccio'
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
      Write-Host "Removed scheduled task '$taskName'." -ForegroundColor Yellow
    } else {
      Write-Host "No scheduled task '$taskName' found." -ForegroundColor Yellow
    }
  }
}
