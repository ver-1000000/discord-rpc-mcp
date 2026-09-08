#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) platform=linux-x64 ;;
  Darwin:arm64) platform=macos-arm64 ;;
  Darwin:x86_64) platform=macos-x64 ;;
  *) echo "Unsupported platform. Use Linux x64 or macOS Intel/Apple Silicon." >&2; exit 1 ;;
esac
exec "$base/$platform/discord-rpc-mcp" "$@"
