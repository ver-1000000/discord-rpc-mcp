param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'discord-rpc-mcp')
)
$ErrorActionPreference = 'Stop'
$Version = '0.1.0'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Use install.sh on Linux or macOS.'
}
$Architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($Architecture -ne 'AMD64') { throw 'This installer supports Windows x64.' }
if (-not [IO.Path]::IsPathRooted($InstallDir)) { throw 'Installation directory must be an absolute path.' }
$Checksum = '5cbdb74c003bbe0985deb6be0962f275fc054bb3bf954729d460da96b11c2e9e'
$Stage = Join-Path ([IO.Path]::GetTempPath()) ('discord-rpc-mcp-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Stage | Out-Null
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $Archive = Join-Path $Stage 'archive.zip'
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/ver-1000000/discord-rpc-mcp/releases/download/v$Version/discord-rpc-mcp-v$Version-windows-x64.zip" -OutFile $Archive
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Archive).Hash.ToLowerInvariant() -ne $Checksum) {
        throw 'Checksum mismatch. Nothing installed.'
    }
    $Unpacked = Join-Path $Stage 'unpacked'
    Expand-Archive -LiteralPath $Archive -DestinationPath $Unpacked
    $Bin = Join-Path $InstallDir 'bin'
    $Config = Join-Path $InstallDir 'config'
    New-Item -ItemType Directory -Force -Path $Bin, $Config | Out-Null
    Copy-Item -LiteralPath (Join-Path $Unpacked 'discord-rpc-mcp.exe') -Destination (Join-Path $Bin 'discord-rpc-mcp.exe.new')
    Move-Item -LiteralPath (Join-Path $Bin 'discord-rpc-mcp.exe.new') -Destination (Join-Path $Bin 'discord-rpc-mcp.exe') -Force
    foreach ($File in @('LICENSE', 'THIRD_PARTY_NOTICES.md')) {
        Copy-Item -LiteralPath (Join-Path $Unpacked $File) -Destination (Join-Path $InstallDir $File) -Force
    }
    $EnvFile = Join-Path $Config '.env'
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        Copy-Item -LiteralPath (Join-Path $Unpacked '.env.example') -Destination $EnvFile
    }
    Write-Host "Installed discord-rpc-mcp $Version (windows-x64)"
    Write-Host "Configuration: $EnvFile"
    Write-Host 'Next: enter your Discord application ID and client secret in that file, start Discord, then run:'
    Write-Host "  & `"$Bin\discord-rpc-mcp.exe`" --env-file `"$EnvFile`" login"
} finally {
    Remove-Item -LiteralPath $Stage -Recurse -Force
}
