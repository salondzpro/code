# VOIX OFF de la vidéo « Ma pub » (lib/bioVideo.ts, bioVoiceLines) — refonte du 26 nov. 2026.
# Sept répliques calées sur le montage, en français, voix Windows Julie (salon de femmes) et Paul
# (salon d'hommes), débit et pauses réglés en SSML. Sortie : apps/web/public/video/voix/fr-<f|h>-<n>.wav
#   powershell -NoProfile -File scripts/make-video-voices.ps1
# À refaire si les répliques changent ; à remplacer par un vrai enregistrement quand il y en aura un
# (mêmes noms de fichiers, même ordre).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Attendre($op, [Type]$type) {
  $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $t.Wait() | Out-Null
  $t.Result
}

$repliques = @(
  'Réservez ici, <break time="80ms"/> en un instant.',
  'Touchez le lien <break time="80ms"/> dans la bio.',
  'Choisissez votre prestation.',
  'Puis le jour, <break time="80ms"/> et l''heure qui vous arrangent.',
  'Identifiez-vous <break time="60ms"/> en un geste.',
  'Et voilà, <break time="150ms"/> c''est fait !',
  'Disponible aussi en application, <break time="100ms"/> sur l''App Store et Google Play.'
)
$voix = @{ f = 'Microsoft Julie'; h = 'Microsoft Paul' }
$dossier = Join-Path $PSScriptRoot '..\apps\web\public\video\voix'
New-Item -ItemType Directory -Force $dossier | Out-Null

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
foreach ($k in $voix.Keys) {
  $v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $voix[$k] } | Select-Object -First 1
  if (-not $v) { throw "Voix absente : $($voix[$k])" }
  $synth.Voice = $v
  for ($i = 0; $i -lt $repliques.Count; $i++) {
    # Débit un peu plus vif et ton légèrement plus haut : une voix de pub, pas une voix de GPS.
    $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'><prosody rate='+8%' pitch='+4%'>$($repliques[$i])</prosody></speak>"
    $flux = Attendre ($synth.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $lecteur = New-Object Windows.Storage.Streams.DataReader($flux.GetInputStreamAt(0))
    $n = [uint32]$flux.Size
    $null = Attendre ($lecteur.LoadAsync($n)) ([uint32])
    $octets = New-Object byte[] $n
    $lecteur.ReadBytes($octets)
    $f = Join-Path $dossier ("fr-{0}-{1}.wav" -f $k, ($i + 1))
    [System.IO.File]::WriteAllBytes($f, $octets)
    Write-Output ("{0}  {1} ko" -f (Split-Path $f -Leaf), [math]::Round($n / 1024))
  }
}
