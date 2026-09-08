# インストール

Windows・macOS・Linuxに対応しています。Discordデスクトップアプリと、利用可能なOSの認証情報ストアが必要です(LinuxではSecret Service対応のキーリング)。

## 1. インストール

macOS・Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.ps1 | iex
```

## 2. Discordと接続

[READMEのDiscord接続手順](../README.ja.md#2-discordと接続)に沿ってアプリを設定し、インストーラーが表示した場所の`.env`にアプリケーションIDとクライアントシークレットを入力してください。Agentが進める場合は、ユーザーの入力完了を待ってから以下を実行します。

Discordを起動して、次を実行してください。

macOS・Linux:

```sh
"$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env" login
```

Windows (PowerShell):

```powershell
& "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env" login
```

Discordの確認画面で承認してください。認証情報は保存され、次回以降も再利用されます。

## 3. MCPクライアントに登録

利用するクライアントの手順だけ実行してください。

### Codex

macOS・Linux:

```sh
codex mcp add discord-rpc-mcp -- "$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env"
```

Windows (PowerShell):

```powershell
codex mcp add discord-rpc-mcp -- "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env"
```

### Claude Code

macOS・Linux:

```sh
claude mcp add --transport stdio --scope user discord-rpc-mcp -- "$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env"
```

Windows (PowerShell):

```powershell
claude mcp add --transport stdio --scope user discord-rpc-mcp -- "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env"
```

### その他のMCPクライアント

MCPクライアントに次の設定を追加します。パスはインストーラーが表示した場所の絶対パスに変更してください。

```json
{
  "mcpServers": {
    "discord-rpc-mcp": {
      "command": "/absolute/path/bin/discord-rpc-mcp",
      "args": ["--env-file", "/absolute/path/config/.env"]
    }
  }
}
```

Windowsでは`command`を`C:/path/to/discord-rpc-mcp.exe`のように指定してください。利用中はDiscordを起動したままにしてください。

### Claude Desktop・MCPB

上の手順1・2でDiscordの認証まで完了したら、[Latest Release](https://github.com/ver-1000000/discord-rpc-mcp/releases/latest)の`.mcpb`をクライアントにインストールし、設定ファイルとして同じ`.env`を選択してください。MCPB非対応のクライアントでは上のJSON設定を使用します。

## 接続確認

クライアントのMCP設定を再読み込みし、`get_guilds`でサーバー一覧を取得できることを確認してください。`status`は保存済み認証の確認だけで、Discordへの接続確認ではありません。必要な場合だけMCPサーバーやクライアントを再起動してください。

既存の設定・認証がある場合は再利用し、他のMCP設定を上書きしないでください。シークレットはチャットに貼らず、ローカルの`.env`に入力してください。読み取りのみで開始し、操作系を希望する場合は[設定ガイド](configuration.md)を参照してください。

[Claude CodeのMCP設定](https://code.claude.com/docs/en/mcp) · [READMEに戻る](../README.ja.md)
