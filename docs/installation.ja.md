# インストール

Windows・macOS・Linuxに対応しています。
認証トークンを安全に保存するため、OSのキーリングが必要です(LinuxではSecret Service対応)。
Discordデスクトップアプリを、MCPサーバーと同じPCで起動してください。

## 1. MCPを登録・有効化

### Codex・Claude Code

Node.js 22以降・npm・Gitを用意し、利用するクライアントのコマンドを実行してください。

```sh
# Codexの場合
codex mcp add discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp

# Claude Codeの場合
claude mcp add --scope user discord-rpc-mcp -- npx -y github:ver-1000000/discord-rpc-mcp
```

登録後、クライアントのMCPを再読み込みして有効化してください。
ファイルの取得や保存先の管理は`npx`が行います。

### MCPB対応クライアント

[リリース一覧](https://github.com/ver-1000000/discord-rpc-mcp/releases)の`.mcpb`を、クライアントの拡張機能追加からインストール・有効化してください。
Node.jsの準備は不要です。

## 2. Agentにセットアップを頼む

Agentに **discord-rpc-mcpのセットアップをして** と伝えてください。
ローカル設定画面の案内に沿って自分のDiscordアプリを作成するか、所有する既存のアプリを使い、**公開クライアント** を有効にし、Client IDを入力して接続します。
Discordの認可画面でアプリ名と要求権限を確認し、承認してください。

初回は操作系と、表示されているすべての追加権限が選択されています。
不要な権限は **詳細オプション** でチェックを外せます。

ブラウザが開かない場合は、Agentが案内するURLを同じPCで開いてください。

完了したらAgentに伝え、サーバー一覧を取得できることを確認してください。
MCPの再起動は不要です。

## 手動で単体バイナリを登録する場合

Node.jsを使わずに登録する場合は、[リリース一覧](https://github.com/ver-1000000/discord-rpc-mcp/releases)からOS・CPUに合うアーカイブをダウンロードして展開してください。
Linux x64(glibc)、Windows x64、macOS arm64 / x64向けを配布しています。

実行ファイルを保存し、クライアントのMCP設定にその絶対パスを指定してください。
macOS・Linuxでは実行権限が必要です。
JSONで設定する場合の例:

```json
{
  "mcpServers": {
    "discord-rpc-mcp": {
      "command": "/absolute/path/discord-rpc-mcp"
    }
  }
}
```

Windowsでは`C:/path/to/discord-rpc-mcp.exe`のように指定してください。
登録後は、上の「Agentにセットアップを頼む」へ進んでください。

権限・認証情報の保存先・イベントの購読・トラブル対処は[使い方ガイド](usage.md)を参照してください。

[READMEに戻る](../README.ja.md)
