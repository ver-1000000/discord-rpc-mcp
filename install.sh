#!/bin/sh
set -eu

version=0.1.0
case "$(uname -s):$(uname -m)" in
  Linux:x86_64)
    platform=linux-x64
    checksum=f76cde1e826cfe8ff6416f201197fd6595e1e84660a545f2f0e5216d9b72110b ;;
  Darwin:arm64)
    platform=macos-arm64
    checksum=6b71ab5926e44dfcf40e2b8f5d32cbd43d4f2c143f48092db5a6568a90c980ca ;;
  Darwin:x86_64)
    platform=macos-x64
    checksum=84e26b9f265f6f6300aaa40b2165dc74e722a40a2e691349f887251a2f823bfd ;;
  *) echo 'Supported platforms: Linux x64, macOS Apple Silicon and Intel.' >&2; exit 1 ;;
esac
for tool in curl tar mktemp; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Required command: $tool" >&2; exit 1; }
done
if command -v sha256sum >/dev/null 2>&1; then
  hash_tool=sha256sum
elif command -v shasum >/dev/null 2>&1; then
  hash_tool=shasum
else
  echo 'Required command: sha256sum or shasum' >&2; exit 1
fi

install_dir=${DISCORD_RPC_MCP_INSTALL_DIR:-"$HOME/.local/share/discord-rpc-mcp"}
case "$install_dir" in /*) ;; *) echo 'Installation directory must be an absolute path.' >&2; exit 1 ;; esac
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
trap 'exit 1' HUP INT TERM
archive="discord-rpc-mcp-v$version-$platform.tar.gz"
curl --fail --location --silent --show-error --proto '=https' --proto-redir '=https' \
  "https://github.com/ver-1000000/discord-rpc-mcp/releases/download/v$version/$archive" -o "$stage/archive.tar.gz"
if [ "$hash_tool" = sha256sum ]; then
  actual=$(sha256sum "$stage/archive.tar.gz")
else
  actual=$(shasum -a 256 "$stage/archive.tar.gz")
fi
[ "${actual%% *}" = "$checksum" ] || { echo 'Checksum mismatch. Nothing installed.' >&2; exit 1; }
mkdir "$stage/unpacked"
tar -xzf "$stage/archive.tar.gz" -C "$stage/unpacked"
test -f "$stage/unpacked/discord-rpc-mcp"
mkdir -p "$install_dir/bin" "$install_dir/config"
install -m 755 "$stage/unpacked/discord-rpc-mcp" "$install_dir/bin/discord-rpc-mcp.new"
mv -f "$install_dir/bin/discord-rpc-mcp.new" "$install_dir/bin/discord-rpc-mcp"
for file in LICENSE THIRD_PARTY_NOTICES.md; do
  cp "$stage/unpacked/$file" "$install_dir/$file"
done
if [ ! -e "$install_dir/config/.env" ]; then
  (umask 077; cp "$stage/unpacked/.env.example" "$install_dir/config/.env")
fi
printf '\nInstalled discord-rpc-mcp %s (%s)\n' "$version" "$platform"
printf 'Configuration: %s/config/.env\n' "$install_dir"
printf 'Next: enter your Discord application ID and client secret in that file, start Discord, then run:\n'
printf '  "%s/bin/discord-rpc-mcp" --env-file "%s/config/.env" login\n' "$install_dir" "$install_dir"
