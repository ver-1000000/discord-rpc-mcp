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

操作するツールは初期状態では無効です。有効化や必要な権限の設定は、[設定ガイド](docs/configuration.md)を参照してAgentに依頼できます。

読める投稿はDiscordが読み込んでいる範囲です。過去ログ全体の検索や、通常メッセージの送信・編集・削除には対応していません。

## 使い始める

LinuxとDiscordデスクトップアプリ、ロック解除済みのキーリングが必要です。

1. 実行ファイルを用意する([ビルド手順](docs/development.md))
2. [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーションを作り、OAuth2のリダイレクトURIに`http://127.0.0.1:8765/callback`を追加する
3. [.env.example](.env.example)を`.env`にコピーし、アプリケーションIDとクライアントシークレットを入力する
4. Discordを起動して、次を実行する

```sh
chmod 600 .env
chmod +x discord-rpc-mcp
./discord-rpc-mcp --env-file .env login
```

Discordの確認画面で承認してください。認証情報は保存され、次回以降も再利用されます。

MCPクライアントに次の設定を追加します。パスは自分の環境に合わせて変更してください。

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

利用中はDiscordを起動したままにしてください。

---

[設定ガイド](docs/configuration.md) · [開発者向け](docs/development.md) · [DiscordのRPC利用条件](https://docs.discord.com/developers/topics/rpc#restrictions)

投稿の取得でDiscordの表示位置が変わる場合があります。取得内容は利用するAIサービスへ送られる場合があります。

MITライセンス。Discordの公式プロジェクトではありません。
