$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$desktopRelease = Join-Path $PSScriptRoot 'release'
$desktopCache = Join-Path $PSScriptRoot '.build-cache'
$desktopCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $desktopCompiler)) { throw '需要 Windows 64位 .NET Framework 4.x 编译器。' }
if (!(Test-Path -LiteralPath (Join-Path $desktopRelease 'win-unpacked/对白工坊.exe'))) { throw '请先用 electron-builder --win dir 生成应用目录。' }
New-Item -ItemType Directory -Force -Path $desktopCache | Out-Null
$desktopHashFile = Join-Path $desktopCache 'PayloadHash.cs'
Set-Content -LiteralPath $desktopHashFile -Value 'static class PayloadHash { internal const string Value=""; }' -Encoding utf8
$desktopUninstaller = Join-Path $desktopRelease 'win-unpacked/Uninstall.exe'
& $desktopCompiler /nologo /target:winexe /platform:x64 /define:UNINSTALLER "/out:$desktopUninstaller" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:Microsoft.CSharp.dll /win32manifest:installer.manifest /win32icon:assets/icon.ico Installer.cs $desktopHashFile
if ($LASTEXITCODE -ne 0) { throw '卸载程序编译失败。' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$desktopPayload = Join-Path $desktopCache ('payload-' + [Guid]::NewGuid().ToString('N') + '.zip')
[IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $desktopRelease 'win-unpacked'), $desktopPayload, [IO.Compression.CompressionLevel]::Optimal, $false)
$desktopHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $desktopPayload).Hash.ToLowerInvariant()
Set-Content -LiteralPath $desktopHashFile -Value ('static class PayloadHash { internal const string Value="' + $desktopHash + '"; }') -Encoding utf8
$desktopInstaller = Join-Path $desktopRelease 'Dialogue-Atelier-Setup-0.1.0.exe'
& $desktopCompiler /nologo /target:winexe /platform:x64 "/out:$desktopInstaller" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:Microsoft.CSharp.dll /win32manifest:installer.manifest /win32icon:assets/icon.ico "/resource:$desktopPayload,Payload.zip" Installer.cs $desktopHashFile
if ($LASTEXITCODE -ne 0) { throw '安装程序编译失败。' }
(Get-FileHash -Algorithm SHA256 -LiteralPath $desktopInstaller).Hash + '  ' + [IO.Path]::GetFileName($desktopInstaller) | Set-Content -Encoding utf8 -LiteralPath (Join-Path $desktopRelease 'SHA256SUMS.txt')
Write-Output ('Installer: ' + $desktopInstaller)
