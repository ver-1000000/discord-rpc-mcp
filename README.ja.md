<p align="center">
  <img src="assets/icon.svg" width="128" alt="Discord RPC MCP">
</p>

# discord-rpc-mcp

[English](README.md)

AIアシスタントから、手元のDiscordを読み取ったり操作したりするためのMCPサーバーです。

「このチャンネルの投稿を見て」「新しい投稿を受け取りたい」「通話相手の音量を下げて」といった使い方ができます。

## できること

| ツール | 用途 |
| --- | --- |
| `get_guilds`, `get_guild`, `get_channels` | サーバー・チャンネルの情報を取得 |
| `get_channel` | チャンネル・DM・グループDMの投稿を読む |
| `get_selected_voice_channel`, `get_voice_settings` | 通話先・音声設定を確認 |
| `subscribe`, `unsubscribe`, `get_events` | 新着投稿や入退室などを購読・取得 |
| `select_text_channel`, `select_voice_channel` | 表示チャンネルの切り替え・通話への参加や退出 |
| `set_voice_settings`, `set_user_voice_settings` | 自分の音声設定・相手の音量を変更 |
| `set_activity` | Rich Presenceを設定・解除 |
| `send_activity_join_invite`, `close_activity_request` | アクティビティへの参加リクエストを承認・拒否 |
| `set_certified_devices` | デバイス情報を設定 |

## 使い始める

Windows・macOS・Linuxに対応しています。Discordデスクトップアプリと、利用可能なOSの認証情報ストアが必要です(LinuxではSecret Service対応のキーリング)。

### 1. インストール

macOS・Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ver-1000000/discord-rpc-mcp/main/install.ps1 | iex
```

OS・CPUに合う配布物を取得し、ハッシュを検証して、設定ファイルを作成します。管理者権限やNode.js・Bunは不要です。既存の設定ファイルは上書きしません。

### 2. Discordと接続

[Discord Developer Portal](https://discord.com/developers/applications)でアプリケーションを作り、OAuth2のリダイレクトURIに`http://127.0.0.1:8765/callback`を追加してください。インストーラーが表示した場所の`.env`に、アプリケーションIDとクライアントシークレットを入力します。

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

### 3. MCPクライアントに登録

Codex (macOS・Linux):

```sh
codex mcp add discord-rpc-mcp -- "$HOME/.local/share/discord-rpc-mcp/bin/discord-rpc-mcp" --env-file "$HOME/.local/share/discord-rpc-mcp/config/.env"
```

Codex (Windows PowerShell):

```powershell
codex mcp add discord-rpc-mcp -- "$env:LOCALAPPDATA\discord-rpc-mcp\bin\discord-rpc-mcp.exe" --env-file "$env:LOCALAPPDATA\discord-rpc-mcp\config\.env"
```

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

手動でダウンロードする場合は、[Latest Release](https://github.com/ver-1000000/discord-rpc-mcp/releases/latest)からOS別の配布物かMCPBを取得できます。MCPB対応クライアントでは、`.mcpb`ファイルを開いて同じ`.env`ファイルを選択してください。

---

[設定ガイド](docs/configuration.md) · [開発者向け](docs/development.md) · [DiscordのRPC利用条件](https://docs.discord.com/developers/topics/rpc#restrictions)

## 注意事項

- 初期設定では読み取りのみ有効です。音量変更やチャンネル移動なども使う場合は、`.env`に`DISCORD_ALLOW_CONTROL=1`を設定してください。必要な認可スコープは[設定ガイド](docs/configuration.md)を参照してください
- 読める投稿はDiscordが読み込んでいる範囲です。過去ログ全体の検索や、通常メッセージの送信・編集・削除には対応していません
- 投稿の取得でDiscordの表示位置が変わる場合があります
- 取得した内容は、利用するAIサービスへ送信される場合があります
- Discordの公式プロジェクトではありません

## ライセンス

[MIT](LICENSE)
