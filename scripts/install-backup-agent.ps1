$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$private = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\private'))
[IO.Directory]::CreateDirectory($private) | Out-Null
$destination='G:\My Drive\Servicio Express — Respaldos cifrados'
if (!(Test-Path -LiteralPath $destination -PathType Container)) {throw 'Abre Google Drive corporativo y espera que aparezca la carpeta Servicio Express — Respaldos cifrados. No cambies el destino.'}
$tokenSecure=Read-Host 'Token emitido desde Cuentas IT > Copia externa' -AsSecureString
$token=[Net.NetworkCredential]::new('', $tokenSecure).Password
if($token -notmatch '^[A-Za-z0-9_-]{43}$'){throw 'Token inválido'}
$random=New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
$passphrase=[Convert]::ToBase64String($random)
$config=@{baseUrl='https://servicio-express-eta.vercel.app';token=$token;passphrase=$passphrase}|ConvertTo-Json
$encrypted=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($config),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.File]::WriteAllBytes((Join-Path $private 'backup-agent.dpapi'),$encrypted)
# A separate private recovery key is necessary if Windows or DPAPI is lost.
Set-Content -LiteralPath (Join-Path $private 'RECOVERY-KEY.txt') -Value $passphrase -Encoding UTF8
$script=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'backup-agent.ps1'))
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -File "'+$script+'"')
$trigger=New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'NeuraTec Servicio Express Backup' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Respaldo diario cifrado y solicitudes previas al borrado. Destino corporativo fijo.' -Force | Out-Null
Start-ScheduledTask -TaskName 'NeuraTec Servicio Express Backup'
Write-Host 'Agente instalado para este usuario de Windows. Custodia private\RECOVERY-KEY.txt fuera de Drive. IT debe confirmar la copia remota antes de borrar. Nunca se eliminan respaldos automáticamente.'
