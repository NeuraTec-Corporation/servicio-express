param([switch]$Once)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$configPath = Join-Path $PSScriptRoot '..\private\backup-agent.dpapi'
$protected = [IO.File]::ReadAllBytes([IO.Path]::GetFullPath($configPath))
$clear = [Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$config = [Text.Encoding]::UTF8.GetString($clear) | ConvertFrom-Json
[Array]::Clear($clear,0,$clear.Length)
# Destination is deliberately fixed. No user input or server response can redirect it.
$destination = 'G:\My Drive\Servicio Express — Respaldos cifrados'
$headers = @{Authorization=('Bearer ' + $config.token)}
do {
 try {
  if (!(Test-Path -LiteralPath $destination -PathType Container)) { throw 'Drive corporativo no disponible. No se cambia el destino.' }
  $response = Invoke-WebRequest -Uri ($config.baseUrl + '/api/backups/agent') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{action='capture';passphrase=$config.passphrase}|ConvertTo-Json) -UseBasicParsing -TimeoutSec 120
  if ($response.StatusCode -eq 200) {
   $job = [string]$response.Headers['X-Backup-Id']
   $digest = [string]$response.Headers['X-Backup-Sha256']
   if ($job -notmatch '^[a-f0-9-]{36}$' -or $digest -notmatch '^[a-f0-9]{64}$') {throw 'Respuesta de respaldo inválida.'}
   $filename = 'servicio-express-' + $job + '.sebackup'
   # WebRequest binary body is copied without a text conversion.
   $stream = $response.RawContentStream
   $stream.Position = 0
   $bytes = $stream.ToArray()
   $temp = Join-Path $destination ($filename + '.partial')
   $final = Join-Path $destination $filename
   [IO.File]::WriteAllBytes($temp,$bytes)
   $actual = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
   if ($actual -ne $digest) {throw 'No coincide SHA-256. No se confirmó la copia.'}
   Move-Item -LiteralPath $temp -Destination $final
   Invoke-RestMethod -Uri ($config.baseUrl+'/api/backups/agent') -Method Post -Headers $headers -ContentType 'application/json' -Body (@{action='copied';id=$job;sha256=$actual}|ConvertTo-Json) -TimeoutSec 30 | Out-Null
   # Local copy is never labelled cloud verified. IT confirms download from Drive.
  }
 } catch {
  # Do not log headers, tokens, passphrases or server bodies.
  Write-Warning 'Respaldo no completado. Revisa conexión, sesión de Windows y Drive; el borrado continúa protegido.'
 }
 if (!$Once) {Start-Sleep -Seconds 60}
} while (!$Once)
