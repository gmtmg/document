// チャシーの「お店の奥（サーバー）」。
// 画面から届いた会話に指示書を足して、APIキーを付けて OpenAI に送り、返事をそのまま流して返す。
import { SYSTEM_PROMPT } from "./system-prompt.js";

const MAX_MESSAGES = 20;       // 覚えておく会話の数（直近20件）
const MAX_USER_CHARS = 2000;   // 1回の質問の長さの上限
const MAX_TOTAL_CHARS = 30000; // 1回に送る会話全体の長さの上限
const RATE_LIMIT = 15;         // 1人あたり、1分間に送れる回数
const recent = new Map();      // IPアドレスごとの送信時刻（このサーバーの中だけの簡易的な記録）

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function tooMany(ip, now) {
  const times = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return times.length > RATE_LIMIT;
}

// 画面から届いた会話を点検して、送ってよい形にそろえる
export function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const messages = input.slice(-MAX_MESSAGES).map((m) => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    content: typeof m?.content === "string" ? m.content : "",
  }));
  const last = messages[messages.length - 1];
  if (last.role !== "user" || !last.content.trim() || last.content.length > MAX_USER_CHARS) return null;
  while (messages.length > 1 && messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS) messages.shift();
  return messages;
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = allowed.includes(origin) ? corsHeaders(origin) : {};
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, name: "chacy", configured: Boolean(env.OPENAI_API_KEY) }, 200, cors);
    }
    if (url.pathname !== "/chat") return json({ error: "見つかりません" }, 404, cors);
    if (!allowed.includes(origin)) return json({ error: "このサイトからは使えません" }, 403, {});
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "POST で送ってください" }, 405, cors);
    if (!env.OPENAI_API_KEY) return json({ error: "サーバーにAPIキーが設定されていません" }, 500, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (tooMany(ip, Date.now())) return json({ error: "少し時間をおいてから、もう一度送ってね" }, 429, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "送られてきた形が正しくありません" }, 400, cors); }
    const messages = cleanMessages(body && body.messages);
    if (!messages) return json({ error: `質問は1〜${MAX_USER_CHARS}文字で送ってね` }, 400, cors);

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.MODEL || "gpt-5.4-mini",
        stream: true,
        max_completion_tokens: 2000,
        reasoning_effort: "low",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.log("OpenAI error", upstream.status, detail.slice(0, 500));
      const message = upstream.status === 429
        ? "いまAIが混み合っているか、利用上限に達しているみたい"
        : "AIとうまくお話しできなかったよ";
      return json({ error: message }, 502, cors);
    }

    // OpenAI からの返事（少しずつ届く文章）を、そのまま画面へ流す
    return new Response(upstream.body, {
      status: 200,
      headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    });
  },
};
