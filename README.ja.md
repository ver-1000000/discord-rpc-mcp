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
| `set_activity` | Rich Presenceを設定・解除 |
| `send_activity_join_invite`, `close_activity_request` | アクティビティへの参加リクエストを承認・拒否 |
| `set_certified_devices` | デバイス情報を設定 |

## 使い始める

### 1. インストール

CodexやClaude Codeなど、端末を操作できるAgentに次を送ってください。

```text
次のガイドに沿って、discord-rpc-mcpのインストールと、今使っているMCPクライアントへの登録を進めてください。
https://github.com/ver-1000000/discord-rpc-mcp/blob/main/docs/installation.ja.md
```

自分でコマンドを実行する方やClaude Desktopを使う方は、[インストールガイド](docs/installation.ja.md)をご覧ください。

### 2. Discordと接続

Discord側の設定は、次の手順で行ってください。画面名は英語表記です。設定済みのアプリがある場合は再利用できます。

1. [Discord Developer Portal](https://discord.com/developers/applications)を開き、Discordにログイン
2. `New Application` > `Name`に`RPC MCP Bridge`などの名前を入力 > 利用規約を確認してチェック > `Create`
3. 左メニューの`OAuth2` > `Redirects` > `Add Redirect` > `http://127.0.0.1:8765/callback`を入力 > `Save Changes`
4. 同じ`OAuth2`画面の`Client ID` > `Copy`でコピーし、Agentが案内した`.env`の`DISCORD_CLIENT_ID=`の右側に貼り付け
5. `Client Secret`をコピーし、同じファイルの`DISCORD_CLIENT_SECRET=`の右側に貼り付けて保存
   - 新しく作ったアプリでシークレットが取得できない場合は、`Reset Secret`から発行し、求められた本人確認を完了する
   - 既存アプリのシークレットをリセットすると、他で使っている設定も更新が必要になるので注意
6. PCのDiscordデスクトップアプリを起動し、Agentに「設定を保存したので接続を続けて」と伝える
7. Discordに認可画面が出たら、アプリ名と要求権限を確認して承認

シークレットはチャットに貼らず、ローカルの`.env`に入力してください。手動で認証を進める場合のコマンドは[インストールガイド](docs/installation.ja.md#2-discordと接続)にあります。

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
