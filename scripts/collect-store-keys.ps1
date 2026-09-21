# Copie, DANS code\secrets\, les cles de publication (Apple / Google) d'un autre projet de ce PC.
#
# A LANCER PAR VOUS, dans votre propre terminal (jamais par l'assistant : le systeme de securite refuse
# qu'il explore les cles d'un autre projet). Ce script :
#   - ne modifie RIEN dans les projets qu'il parcourt (lecture seule, copies uniquement) ;
#   - ne copie que : les fichiers AuthKey_*.p8 / *.p8 (cles Apple), les cles de compte de service Google
#     (JSON contenant "private_key"), et lit eas.json / .env* pour en tirer les IDENTIFIANTS Apple
#     (Team ID, Key ID, Issuer ID) qu'il ecrit dans secrets\apple-ids-found.txt ;
#   - n'affiche JAMAIS le contenu d'une cle : seulement des noms de fichiers et des identifiants.
#
# Utilisation (dans PowerShell, depuis le dossier code\) :
#   powershell -ExecutionPolicy Bypass -File scripts\collect-store-keys.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\collect-store-keys.ps1 -Roots "C:\chemin\vers\coligo"
#
# Par defaut il cherche sous Desktop\noti\dz (hors Salon DZ). Donnez -Roots si le projet est ailleurs.
param(
  [string[]]$Roots = @("$env:USERPROFILE\Desktop\noti\dz")
)
$ErrorActionPreference = 'Continue'

$codeDir = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $codeDir 'secrets'
$destApple = Join-Path $dest 'apple-keys-found'
$destGoogle = Join-Path $dest 'google-keys-found'
New-Item -ItemType Directory -Force -Path $destApple, $destGoogle | Out-Null

$skip = '\\(node_modules|\.git|dist|build|\.expo|\.next|Pods|salondz)\\'
$ids = New-Object System.Collections.Generic.List[string]
$foundP8 = 0; $foundGoogle = 0

foreach ($root in $Roots) {
  if (-not (Test-Path $root)) { Write-Host "Introuvable : $root"; continue }
  Write-Host "Recherche sous $root ..."
  $files = Get-ChildItem -Path $root -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $skip -and $_.Length -lt 200KB }

  foreach ($f in $files) {
    $name = $f.Name

    # Cles Apple (App Store Connect OU notifications APNs : meme forme de nom, on les distingue ensuite).
    if ($f.Extension -eq '.p8') {
      Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $destApple $name) -Force
      $keyId = if ($name -match '^AuthKey_([A-Z0-9]{10})\.p8$') { $Matches[1] } else { '?' }
      Write-Host ("  Cle Apple : {0}  (Key ID {1})  <- {2}" -f $name, $keyId, $f.DirectoryName)
      $foundP8++
      continue
    }

    # Cles de compte de service Google (JSON contenant une cle privee).
    if ($f.Extension -eq '.json' -and $name -notmatch '^(package|tsconfig|app|eas|google-services)') {
      $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
      if ($txt -and $txt -match '"type"\s*:\s*"service_account"' -and $txt -match '"private_key"') {
        $mail = if ($txt -match '"client_email"\s*:\s*"([^"]+)"') { $Matches[1] } else { '?' }
        Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $destGoogle $name) -Force
        Write-Host ("  Cle Google : {0}  ({1})  <- {2}" -f $name, $mail, $f.DirectoryName)
        $foundGoogle++
      }
      continue
    }

    # Identifiants Apple deja notes dans une config (non secrets : Team ID, Key ID, Issuer ID, ID d'app).
    if ($name -eq 'eas.json') {
      try {
        $j = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
        foreach ($p in $j.submit.PSObject.Properties) {
          $ios = $p.Value.ios
          if ($ios) {
            foreach ($k in 'appleTeamId', 'ascAppId', 'ascApiKeyId', 'ascApiKeyIssuerId', 'ascApiKeyPath', 'bundleIdentifier') {
              if ($ios.$k) { $ids.Add("$k = $($ios.$k)   [eas.json : $($f.DirectoryName)]") }
            }
          }
        }
      } catch { }
    }
    if ($name -match '^\.env') {
      foreach ($line in (Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue)) {
        if ($line -match '^\s*(APPLE_TEAM_ID|EXPO_APPLE_TEAM_ID|ASC_[A-Z_]*|EXPO_ASC_[A-Z_]*|APP_STORE_CONNECT_[A-Z_]*)\s*=\s*(.+?)\s*$') {
          $ids.Add("$($Matches[1]) = $($Matches[2])   [$name : $($f.DirectoryName)]")
        }
      }
    }
  }
}

if ($ids.Count -gt 0) {
  $ids | Sort-Object -Unique | Set-Content -Path (Join-Path $dest 'apple-ids-found.txt') -Encoding UTF8
}

Write-Host ''
Write-Host "Termine : $foundP8 cle(s) Apple, $foundGoogle cle(s) Google copiee(s) dans $dest"
if ($ids.Count -gt 0) { Write-Host "Identifiants Apple notes dans secrets\apple-ids-found.txt ($($ids.Count) ligne(s))" }
if ($foundP8 -eq 0 -and $foundGoogle -eq 0) {
  Write-Host 'Rien trouve. Si le projet est ailleurs : relancez avec -Roots "C:\chemin\du\projet".'
  Write-Host 'Sinon les cles n''ont pas ete gardees sur ce PC : il faudra les recreer (5 minutes, etapes dans la conversation).'
}
Write-Host 'Dites simplement "c''est fait" a l''assistant.'
