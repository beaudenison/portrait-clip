# Downloads Windows FFmpeg essentials into src-tauri/resources/
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "src-tauri\resources"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$ffmpeg = Join-Path $out "ffmpeg.exe"
$ffprobe = Join-Path $out "ffprobe.exe"
if ((Test-Path $ffmpeg) -and (Test-Path $ffprobe)) {
  Write-Host "FFmpeg already present."
  exit 0
}

$zip = Join-Path $env:TEMP "ffmpeg-essentials.zip"
$extract = Join-Path $env:TEMP "ffmpeg-essentials"
Write-Host "Downloading FFmpeg..."
Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $zip
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $extract -Force
$ff = Get-ChildItem $extract -Recurse -Filter ffmpeg.exe | Select-Object -First 1
$fp = Get-ChildItem $extract -Recurse -Filter ffprobe.exe | Select-Object -First 1
if (-not $ff -or -not $fp) { throw "Could not find ffmpeg.exe in the download." }
Copy-Item $ff.FullName $ffmpeg -Force
Copy-Item $fp.FullName $ffprobe -Force
Write-Host "Installed to $out"
