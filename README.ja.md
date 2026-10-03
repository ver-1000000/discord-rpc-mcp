<p align="center">
  <img src="assets/icon.svg" width="128" alt="Discord RPC MCP">
</p>

# discord-rpc-mcp

[English](README.md)

DiscordデスクトップアプリのRPCを、MCPから扱うためのサーバーです。(機能はDiscordのRPCに準拠しているため、過去のチャットの検索などはできません)

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
| `toggle_video`, `toggle_screenshare` | 通話中のカメラ・画面共有を切り替え |
| `set_activity` | Rich Presenceを設定・解除 |
| `send_activity_join_invite`, `close_activity_request` | アクティビティへの参加リクエストを承認・拒否 |
| `set_certified_devices` | デバイス情報を設定 |

<div align="center">

https://github.com/user-attachments/assets/00c599d7-01ff-45cf-be04-74ec699a8811

</div>

## セットアップ

認証トークンを安全に保存するため、OSのキーリングが必要です(LinuxではSecret Service対応)。

Node.js 22以降・npm・Gitがある環境では、お使いのエージェントクライアントに次のように登録できます。

```sh
# Codexの場合
codex mcp add discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp

# Claude Codeの場合
claude mcp add --scope user discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp
```

[MCPB](https://github.com/modelcontextprotocol/mcpb)に対応したクライアントでは、[リリース一覧](https://github.com/ver-1000000/discord-rpc-mcp/releases)の`.mcpb`ファイルからインストールできます。

MCPのインストールと有効化が終わったら、エージェントに **discord-rpc-mcpのセットアップをして** と伝えてください。
`setup`ツールがローカル設定画面を開き、自分のDiscordアプリの作成、**公開クライアント** の有効化、Client IDの入力を案内します。

手動でのインストールや、詳細な手順は[インストールガイド](docs/installation.ja.md)を参照してください。

---

[使い方ガイド](docs/usage.md) · [開発者向け](docs/development.md) · [DiscordのRPC利用条件](https://docs.discord.com/developers/topics/rpc#restrictions) · [利用規約](docs/terms.md) · [プライバシーポリシー](docs/privacy.md)

## ライセンス

[MIT](LICENSE)
