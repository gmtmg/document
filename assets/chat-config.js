// チャシーの設定。
//
// ■ キー入力方式（いまの設定）
//   CHACY_API_URL を空のままにすると、使う人がチャシーの画面で OpenAI の APIキーを入力し、
//   ブラウザから直接 OpenAI に送ります。サーバーは不要です。知り合い数人で使うとき向け。
//
// ■ サーバー方式（広く公開したいとき）
//   worker/README.md の手順で Cloudflare Workers に公開し、そのアドレスの最後に /chat を付けて書きます。
//   例: window.CHACY_API_URL = "https://chacy.あなたの名前.workers.dev/chat";
window.CHACY_API_URL = "";

// 使うAIの種類（キー入力方式のとき）
window.CHACY_MODEL = "gpt-5.4-mini";
