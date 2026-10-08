# Builds a full-trust x64 MSIX from the existing release build.
# Name and Publisher are the Partner Center product identity.
# Microsoft re-signs the package after certification.

param(
    [string]$PackageName = "beaudenison.PortraitClip",
    [string]$Publisher = "CN=F18EBFF7-15AB-46F6-9E3F-142DADBF6515"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$release = Join-Path $root "src-tauri\target\release"
$layout = Join-Path $release "bundle\msix\layout"
$outDir = Join-Path $release "bundle\msix"
$msix = Join-Path $outDir "PortraitClip_1.0.2.0_x64.msix"
$pfx = Join-Path $outDir "portrait-clip-dev.pfx"
$pfxPassword = "portrait-clip-dev"
$publisher = $Publisher
$makeappx = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe"
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

$exe = Join-Path $release "portrait-clip.exe"
$ffmpeg = Join-Path $release "resources\ffmpeg.exe"
$ffprobe = Join-Path $release "resources\ffprobe.exe"
foreach ($required in @($exe, $ffmpeg, $ffprobe, $makeappx, $signtool)) {
    if (-not (Test-Path $required)) {
        throw "Missing $required"
    }
}

if (Test-Path $layout) {
    Remove-Item $layout -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $layout "resources") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $layout "Assets") -Force | Out-Null

Copy-Item $exe (Join-Path $layout "portrait-clip.exe")
Copy-Item $ffmpeg (Join-Path $layout "resources\ffmpeg.exe")
Copy-Item $ffprobe (Join-Path $layout "resources\ffprobe.exe")

$iconDir = Join-Path $root "src-tauri\icons"
foreach ($icon in @("StoreLogo.png", "Square44x44Logo.png", "Square71x71Logo.png", "Square150x150Logo.png", "Square310x310Logo.png")) {
    Copy-Item (Join-Path $iconDir $icon) (Join-Path $layout "Assets\$icon")
}

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity
    Name="$PackageName"
    Publisher="$publisher"
    Version="1.0.2.0"
    ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>Portrait Clip</DisplayName>
    <PublisherDisplayName>beaudenison</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-US" />
  </Resources>
  <Applications>
    <Application Id="App" Executable="portrait-clip.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="Portrait Clip"
        Description="Turn landscape stream recordings into vertical shorts."
        BackgroundColor="#0C0C0E"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Square71x71Logo="Assets\Square71x71Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
[System.IO.File]::WriteAllText((Join-Path $layout "AppxManifest.xml"), $manifest, [System.Text.UTF8Encoding]::new($false))

$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $publisher } | Select-Object -First 1
if (-not $cert) {
    $cert = New-SelfSignedCertificate `
        -Type Custom `
        -Subject $publisher `
        -KeyUsage DigitalSignature `
        -FriendlyName "Portrait Clip dev signing" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -TextExtension @("2.5.29.37={critical}{text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
}
$secure = ConvertTo-SecureString -String $pfxPassword -Force -AsPlainText
$cer = Join-Path $outDir "portrait-clip-dev.cer"
foreach ($locked in @($pfx, $cer)) {
    if (Test-Path $locked) {
        Remove-Item $locked -Force
    }
}
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secure | Out-Null
Export-Certificate -Cert $cert -FilePath $cer | Out-Null
$people = Get-ChildItem Cert:\CurrentUser\TrustedPeople | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
if (-not $people) {
    Import-Certificate -FilePath $cer -CertStoreLocation Cert:\CurrentUser\TrustedPeople | Out-Null
}
# App install checks the machine root store, not the user store.
certutil.exe -addstore Root $cer | Out-Null

if (Test-Path $msix) {
    Remove-Item $msix -Force
}
& $makeappx pack /d $layout /p $msix /o
if ($LASTEXITCODE -ne 0) {
    throw "makeappx failed with exit $LASTEXITCODE"
}
& $signtool sign /fd SHA256 /f $pfx /p $pfxPassword /tr http://timestamp.digicert.com /td SHA256 $msix
if ($LASTEXITCODE -ne 0) {
    throw "signtool failed with exit $LASTEXITCODE"
}

Write-Output "PACKAGE $msix"
Write-Output "SIZE $((Get-Item $msix).Length)"
