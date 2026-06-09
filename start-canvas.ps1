param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs = Join-Path $root 'logs'
$pids = Join-Path $root '.pids'
$nodeCandidates = @(
  (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
  (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not $nodeCandidates) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    'Node.js was not found. Please install Node.js 22 or newer.',
    'Nixiang Infinite Canvas'
  ) | Out-Null
  exit 1
}

$node = $nodeCandidates[0]
New-Item -ItemType Directory -Path $logs -Force | Out-Null
New-Item -ItemType Directory -Path $pids -Force | Out-Null

function Test-Endpoint {
  param([string]$Uri)
  try {
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-Endpoint {
  param(
    [string]$Uri,
    [int]$Attempts = 30
  )
  for ($i = 0; $i -lt $Attempts; $i++) {
    if (Test-Endpoint -Uri $Uri) {
      return $true
    }
    Start-Sleep -Milliseconds 300
  }
  return $false
}

if (-not (Test-Endpoint -Uri 'http://127.0.0.1:4320/api/projects.php?action=list')) {
  $backend = Start-Process `
    -FilePath $node `
    -ArgumentList 'server-index.mjs' `
    -WorkingDirectory (Join-Path $root 'canvas-server') `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'backend.log') `
    -RedirectStandardError (Join-Path $logs 'backend-error.log') `
    -PassThru
  Set-Content -LiteralPath (Join-Path $pids 'backend.pid') -Value $backend.Id -Encoding ascii
}

if (-not (Wait-Endpoint -Uri 'http://127.0.0.1:4320/api/projects.php?action=list')) {
  throw "Canvas backend failed to start. Check logs\backend-error.log."
}

if (-not (Test-Endpoint -Uri 'http://127.0.0.1:3000/')) {
  $frontend = Start-Process `
    -FilePath $node `
    -ArgumentList 'serve-canvas.mjs' `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'frontend.log') `
    -RedirectStandardError (Join-Path $logs 'frontend-error.log') `
    -PassThru
  Set-Content -LiteralPath (Join-Path $pids 'frontend.pid') -Value $frontend.Id -Encoding ascii
}

if (-not (Wait-Endpoint -Uri 'http://127.0.0.1:3000/')) {
  throw "Canvas frontend failed to start. Check logs\frontend-error.log."
}

Write-Host 'Nixiang Infinite Canvas is ready: http://localhost:3000' -ForegroundColor Green
Write-Host 'Local account: admin / admin123'

if (-not $NoBrowser) {
  Start-Process 'http://localhost:3000'
}
