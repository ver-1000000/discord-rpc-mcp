import { readFileSync } from 'node:fs';

// Bun embeds the shared logo at compile time; Node reads the packaged asset.
const logo = typeof DISCORD_RPC_MCP_SETUP_LOGO === 'string' ? DISCORD_RPC_MCP_SETUP_LOGO
  : readFileSync(new URL('../../assets/icon.svg', import.meta.url), 'utf8');
const termsUrl = 'https://github.com/ver-1000000/discord-rpc-mcp/blob/main/docs/terms.md';

export function page({ nonce, token, defaults, scopes }) {
  const data = JSON.stringify({ token, defaults, scopes }).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Discord · Discord RPC MCP</title>
<style nonce="${nonce}">
:root{color-scheme:light dark;font:16px/1.65 system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:light-dark(#f4f5f9,#171820);color:light-dark(#242635,#ececf3)}
main{max-width:760px;margin:40px auto;padding:32px 40px;background:light-dark(white,#222430);border:1px solid #8882;border-radius:20px}
header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:24px}.brand{grid-column:2}.brand svg{display:block;width:76px;height:76px}
.language{grid-column:3;justify-self:end;display:flex;padding:3px;margin:0;border:1px solid #8885;border-radius:9px;gap:2px;min-width:0}
.language label{position:relative;display:block;margin:0;padding:4px 9px;font-size:.85rem;font-weight:500;cursor:pointer;border-radius:6px}
.language label:has(input:checked){background:light-dark(#e6e8ff,#393c5b)}.language label:has(input:focus-visible){outline:2px solid #8c90f8;outline-offset:2px}
.language input{position:absolute;opacity:0;width:1px;height:1px}h1{font-size:1.8rem;line-height:1.3;text-align:center;margin:0 0 12px}
p{margin:12px 0}a{color:light-dark(#4852c8,#adb5ff)}strong{word-break:keep-all;overflow-wrap:anywhere}.intro{text-align:center;color:light-dark(#5c6075,#b8bbce);font-size:.9rem}
ol{padding-left:24px;margin:20px 0;line-height:1.35}li{padding-left:4px;margin:12px 0}li ul{padding-left:22px;margin:5px 0}li ul li{margin:3px 0}small{display:block;font-size:.85rem;color:light-dark(#5c6075,#b8bbce)}
ol strong{font-size:.9em;font-weight:600;line-height:1;padding:2px 5px;margin-inline:2px;background:light-dark(#eceef5,#333746);border:1px solid light-dark(#d6d9e5,#515668);border-radius:4px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
label{display:block;margin-top:14px;font-weight:600}input:not([type=checkbox]):not([type=radio]){width:100%;font:inherit;padding:6px 10px;border:1px solid #8888;border-radius:8px;background:transparent;color:inherit}
input:focus-visible,summary:focus-visible,button:focus-visible{outline:2px solid #8c90f8;outline-offset:3px}
button{font:inherit;cursor:pointer;border:0;border-radius:8px;background:#5865f2;color:white;padding:12px 24px}button:disabled{opacity:.6;cursor:wait}
.redirect{display:flex;align-items:center;gap:12px;margin-top:8px;padding:5px 8px;border:1px solid #8885;border-radius:8px}
.redirect code{overflow-wrap:anywhere;flex:1;user-select:all;font-size:.85rem}.redirect button{font-size:.8rem;flex-shrink:0;padding:3px 8px;background:light-dark(#e6e8ff,#393c5b);color:inherit}
details{margin-top:24px;border:1px solid #8885;border-radius:10px;padding:12px 16px}summary{cursor:pointer;font-weight:600}
.options{margin-top:14px;line-height:1.4}.options>small{margin-bottom:12px}.options label{font-weight:400;display:flex;gap:9px;align-items:baseline;margin:7px 0}
input[type=checkbox]{accent-color:#5865f2}.permissions{margin:14px 0 0;padding:8px 12px;border:1px solid #8885;border-radius:8px}
.permissions label{display:grid;grid-template-columns:auto minmax(0,1fr) auto}.scope-name{font:.75rem/1.3 ui-monospace,monospace;color:light-dark(#656a80,#a0a6bd);text-align:right;overflow-wrap:anywhere}
.permissions legend{font-size:.9rem}.consent{font-size:.85rem;color:light-dark(#5c6075,#b8bbce);margin:22px 0 16px}
#submit{width:100%}#status{white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:0}#copyStatus{margin-top:4px}
@media(max-width:720px){main{margin:16px;padding:24px}header{grid-template-columns:1fr auto 1fr}.brand svg{width:60px;height:60px}.language label{padding:4px 6px;font-size:.75rem}}
@media(max-width:560px){.permissions label{grid-template-columns:auto minmax(0,1fr)}.scope-name{grid-column:2;text-align:left}}
@media(max-width:420px){.language{flex-direction:column}.redirect{gap:8px}.redirect code{font-size:.75rem}}
</style>
<main><header><div class="brand">${logo}</div>
<fieldset class="language" aria-label="Language"><label><input type="radio" name="language" value="en" checked>English</label><label><input type="radio" name="language" value="ja">日本語</label></fieldset></header>
<h1 data-i18n="title">Connect Discord</h1>
<p class="intro"></p>
<ol>
<li id="createStep"></li>
<li><div id="redirectStep"></div><div class="redirect"><code id="redirectUri"></code><button type="button" id="copyRedirect" data-i18n="copy">Copy</button></div><small id="copyStatus" role="status" aria-live="polite"></small></li>
<li id="credentialsStep"></li>
<li id="botStep"></li>
<li id="approveStep"></li>
</ol>
<form id="form" autocomplete="off">
<label for="clientId" data-i18n="clientId">Client ID</label><input id="clientId" name="clientId" required pattern="[0-9]{17,20}" inputmode="numeric" autocomplete="off">
<details><summary data-i18n="advanced">Advanced options</summary><div class="options">
<small data-i18n="storage">Tokens are saved in your OS keyring. A working, unlocked keyring is required.</small>
<label><input type="checkbox" id="allowControl"><span data-i18n="controls">Enable controls</span></label>
<fieldset class="permissions" id="scopes"><legend data-i18n="permissions">Additional permissions</legend><small data-i18n="baseScopes">rpc and messages.read are always requested. Uncheck any permissions you do not need.</small></fieldset>
</div></details>
<p class="consent" id="consent"></p>
<button id="submit" data-i18n="connect">Connect</button><p id="status" role="status" aria-live="polite"></p>
</form></main>
<script nonce="${nonce}">
const { token, defaults, scopes } = ${data};
const translations = {
 en: {
  title: 'Connect Discord',
  ownApp: 'Create your own Discord application to connect.',
  create: '<a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer noopener">Open Discord Developer Portal</a> and click <strong>New Application</strong>.<ul><li>Enter a <strong>Name</strong> of your choice.</li><li>Review the Developer Terms of Service and Developer Policy, then check the agreement box.</li><li>Click <strong>Create</strong>.</li></ul><small>Note: You can also use an existing application you own.</small>',
  redirect: 'Open <strong>OAuth2</strong> → <strong>Redirects</strong>.<ul><li>Add a redirect and enter the URL below.<ul><li>If a redirect already exists, click <strong>Add Another</strong>.</li></ul></li><li>Click <strong>Save Changes</strong>.</li></ul>',
  credentials: 'Open <strong>OAuth2</strong> → <strong>Client information</strong>.<ul><li>Turn on <strong>Public Client</strong> and click <strong>Save Changes</strong>.</li><li>Copy <strong>Client ID</strong> into the field below.</li></ul>',
  bot: '(Optional) Open <strong>Bot</strong> and turn off <strong>Public Bot</strong>.<ul><li>Click <strong>Save Changes</strong>.</li></ul>',
  approve: 'Start Discord desktop.<ul><li>Click <strong>Connect</strong> below.</li><li>Approve the authorization request in Discord.</li></ul>',
  clientId: 'Client ID', copy: 'Copy', copied: 'Copied', copyFailed: 'Select the URL and copy it.',
  advanced: 'Advanced options', storage: 'Tokens are saved in your OS keyring. A working, unlocked keyring is required.',
  controls: 'Enable controls (volume, channel switching and more)', permissions: 'Additional permissions',
  baseScopes: 'rpc and messages.read are always requested. Uncheck any permissions you do not need. Discord may restrict access to requested permissions.',
  consent: 'By connecting, you agree to the <a href="${termsUrl}" target="_blank" rel="noreferrer noopener">Terms of Use</a> and to share requested Discord data and subscribed events with your agent and its AI provider. Use a client and provider that will not use Discord messages for AI training.',
  connect: 'Connect', connecting: 'Connecting… Approve the request in Discord.',
  connected: 'Connected', done: 'You can close this page and return to your agent.', failed: 'Connection failed.',
  failedAt: 'Failed at: ', requested: 'Requested permissions: ',
  scopeLabels: { 'rpc.activities.write': 'Update Rich Presence', 'rpc.notifications.read': 'Read notifications', 'rpc.voice.read': 'Read voice events', 'rpc.voice.write': 'Change voice settings', 'rpc.video.read': 'Read video status', 'rpc.video.write': 'Control camera', 'rpc.screenshare.read': 'Read screen sharing status', 'rpc.screenshare.write': 'Control screen sharing', voice: 'Voice access' },
  stages: { validation: 'Input validation', load_credentials: 'Read saved credentials', connect: 'Connect to Discord desktop', authorize: 'Request permission in Discord', token_exchange: 'Obtain token', authenticate: 'Authenticate with token', save_credentials: 'Save credentials', save_settings: 'Save settings' },
  errors: {}
 },
 ja: {
  title: 'Discordと接続',
  ownApp: '自分のDiscordアプリを作成して接続します',
  create: '<a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer noopener">Discord Developer Portalを開き</a>、<strong>新しいアプリケーション</strong>を押す<ul><li>任意の<strong>名前</strong>を入力</li><li>開発者向けサービス利用規約と開発者ポリシーを確認し、同意にチェック</li><li><strong>作成</strong>を押す</li></ul><small>※ 自分が所有する既存のアプリも利用可能</small>',
  redirect: '<strong>OAuth2</strong> → <strong>リダイレクト</strong>を開く<ul><li><strong>Redirectを追加</strong>を押して、下のURLを入力<ul><li>登録済みのURLがある場合は<strong>他を追加</strong>を押す</li></ul></li><li><strong>変更を保存</strong>を押す</li></ul>',
  credentials: '<strong>OAuth2</strong> → <strong>クライアント情報</strong>を開く<ul><li><strong>公開クライアント</strong>をONにし、<strong>変更を保存</strong>を押す</li><li><strong>クライアントID</strong>をコピーし、下の入力欄に貼り付ける</li></ul>',
  bot: '(任意) <strong>Bot</strong>を開き、<strong>公開Bot</strong>のチェックを外す<ul><li><strong>変更を保存</strong>を押す</li></ul>',
  approve: 'Discordデスクトップを起動<ul><li>下の<strong>Discordで承認して接続</strong>を押す</li><li>Discordの認可画面で<strong>認証</strong>を押す</li></ul>',
  clientId: 'クライアントID', copy: 'コピー', copied: 'コピーしました', copyFailed: 'URLを選択してコピーしてください。',
  advanced: '詳細オプション', storage: 'トークンはOSキーリングに保存します。 利用可能でロック解除済みのキーリングが必要です。',
  controls: '操作を有効にする (音量変更・チャンネル移動など)', permissions: '追加権限',
  baseScopes: 'rpcとmessages.readは常に要求します。 不要な権限はチェックを外してください。 要求した権限はDiscord側の制限で利用できない場合があります。',
  consent: '接続すると、<a href="${termsUrl}" target="_blank" rel="noreferrer noopener">利用規約</a>と、要求したDiscord情報・購読イベントをAgentおよび接続先のAIサービスへ共有することに同意します。 DiscordのメッセージをAI学習に使わない設定で利用してください。',
  connect: 'Discordで承認して接続', connecting: '接続中… Discordの認可画面で承認してください。',
  connected: '接続しました', done: 'この画面を閉じてAgentに戻れます。', failed: '接続できませんでした。',
  failedAt: '失敗した工程: ', requested: '要求した権限: ',
  scopeLabels: { 'rpc.activities.write': 'Rich Presenceの変更', 'rpc.notifications.read': '通知の取得', 'rpc.voice.read': '通話イベントの取得', 'rpc.voice.write': '音声設定の変更', 'rpc.video.read': '映像状態の取得', 'rpc.video.write': 'カメラの操作', 'rpc.screenshare.read': '画面共有状態の取得', 'rpc.screenshare.write': '画面共有の操作', voice: '音声へのアクセス' },
  stages: { validation: '入力確認', load_credentials: '保存済み認証の読み込み', connect: 'Discordデスクトップへの接続', authorize: 'Discordへの認可要求', token_exchange: 'トークン取得', authenticate: 'トークンでの接続確認', save_credentials: '認証情報の保存', save_settings: '設定の保存' },
  errors: { KEYRING_LOCKED: 'キーリングのロックを解除して、もう一度接続してください。', KEYRING_UNAVAILABLE: 'OSキーリングを利用できません。 キーリングの設定を確認してください。', INVALID_CONFIG: '入力内容とキーリングの設定を確認してください。', OAUTH_REJECTED: 'Discordが認証を拒否しました。 公開クライアント、リダイレクトURL、要求権限を確認してください。', INTERNAL_ERROR: '接続できませんでした。 ローカルの設定を確認してください。', SETUP_BUSY: '接続処理が進行中です。 完了してからもう一度お試しください。', BRIDGE_CLOSED: 'セットアップが終了しました。 Agentにもう一度セットアップを頼んでください。', SCOPE_REQUIRED: '必要な権限が不足しています。 要求権限を確認して、もう一度承認してください。' }
 }
};
const form = document.getElementById('form'), status = document.getElementById('status'), button = document.getElementById('submit');
const heading = document.querySelector('h1'), steps = document.querySelector('ol'), intro = document.querySelector('.intro');
let language = /^ja(?:-|$)/i.test(navigator.language || navigator.languages?.[0] || '') ? 'ja' : 'en';
let state = 'idle', failure, copyState;
form.clientId.value = defaults.clientId || '';
document.getElementById('redirectUri').textContent = defaults.redirectUri;
document.getElementById('allowControl').checked = defaults.allowControl;
for (const scope of scopes) {
 const label = document.createElement('label'), input = document.createElement('input'), caption = document.createElement('span'), description = document.createElement('span'), scopeName = document.createElement('code');
 input.type = 'checkbox'; input.name = 'scope'; input.value = scope; input.checked = defaults.scopes.includes(scope);
 caption.dataset.scope = scope; scopeName.className = 'scope-name'; scopeName.textContent = '(' + scope + ')';
 description.append(caption);
 label.append(input, description, scopeName); document.getElementById('scopes').append(label);
}
function renderStatus() {
 const text = translations[language];
 heading.textContent = state === 'complete' ? text.connected : text.title;
 intro.textContent = state === 'complete' ? text.done : text.ownApp;
 if (state === 'connecting') status.textContent = text.connecting;
 else if (state === 'failed') {
  const message = text.errors[failure.code] || (language === 'ja' && failure.code === 'RPC_ERROR' ? failure.message.replace(/^RPC error /, 'RPCエラー ') : failure.message) || text.failed;
  status.textContent = (text.stages[failure.stage] ? text.failedAt + text.stages[failure.stage] + '\\n' : '') + message + (failure.requestedScopes ? '\\n' + text.requested + failure.requestedScopes.join(', ') : '');
 }
}
function render() {
 const text = translations[language];
 document.documentElement.lang = language; document.title = text.title + ' · Discord RPC MCP';
 for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = text[element.dataset.i18n];
 document.getElementById('createStep').innerHTML = text.create;
 document.getElementById('redirectStep').innerHTML = text.redirect;
 document.getElementById('credentialsStep').innerHTML = text.credentials;
 document.getElementById('botStep').innerHTML = text.bot;
 document.getElementById('approveStep').innerHTML = text.approve;
 document.getElementById('consent').innerHTML = text.consent;
 for (const caption of document.querySelectorAll('[data-scope]')) caption.textContent = text.scopeLabels[caption.dataset.scope];
 for (const radio of document.querySelectorAll('input[name=language]')) radio.checked = radio.value === language;
 document.getElementById('copyStatus').textContent = copyState ? text[copyState] : '';
 renderStatus();
}
for (const radio of document.querySelectorAll('input[name=language]')) radio.onchange = () => { language = radio.value; render(); };
document.getElementById('copyRedirect').onclick = async () => {
 try { await navigator.clipboard.writeText(defaults.redirectUri); copyState = 'copied'; }
 catch { copyState = 'copyFailed'; }
 document.getElementById('copyStatus').textContent = translations[language][copyState];
};
form.onsubmit = async event => {
 event.preventDefault(); button.disabled = true; state = 'connecting'; failure = undefined; renderStatus();
 const input = { clientId: form.clientId.value.trim(), redirectUri: defaults.redirectUri,
  allowControl: document.getElementById('allowControl').checked, scopes: [...document.querySelectorAll('input[name=scope]:checked')].map(input => input.value) };
 try {
  const response = await fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Setup-Token': token }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) { failure = result; throw new Error(); }
  state = 'complete'; steps.hidden = true; form.hidden = true; status.textContent = ''; renderStatus();
 } catch {
  state = 'failed'; failure ||= {}; renderStatus(); button.disabled = false;
 }
};
render();
</script></html>`;
}
