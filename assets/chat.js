(() => {
  "use strict";
  const { $, $$, esc, store } = window.Site;

  // サーバー方式：CHACY_API_URL が書いてあるとき（自分のパソコンで worker/dev-server.mjs を動かしているときも）
  // キー入力方式：それ以外。使う人が入れた APIキーで、ブラウザから直接 OpenAI に送る
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname) && window.CHACY_MODE !== "key";
  const API_URL = window.CHACY_API_URL || (isLocal ? "/chat" : "");
  const KEY_MODE = !API_URL;
  const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
  const MODEL = window.CHACY_MODEL || "gpt-5.4-mini";
  const API_KEY_STORE = "chacy-openai-key";
  const KEY = "chacy-history";
  const MAX_SEND = 20;   // サーバーに送る会話の数（直近20件）
  const MAX_KEEP = 60;   // ブラウザに残しておく会話の数

  const log = $("#chatLog");
  const input = $("#chatInput");
  const sendBtn = $("#sendBtn");
  let history = (store.get(KEY) || []).filter((m) => m && typeof m.content === "string");
  let controller = null;
  let diagramSeq = 0;

  const save = () => store.set(KEY, history.slice(-MAX_KEEP));
  const scrollDown = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  /* ---------- Markdown と図 ---------- */
  marked.setOptions({ gfm: true, breaks: true });

  let mermaidReady = null;
  function loadMermaid() {
    if (!mermaidReady) {
      mermaidReady = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "assets/vendor/mermaid.min.js";
        s.onload = () => {
          const root = document.documentElement;
          const dark = root.dataset.theme === "dark" || (root.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: dark ? "dark" : "neutral",
            fontFamily: getComputedStyle(document.body).fontFamily,
          });
          resolve(window.mermaid);
        };
        s.onerror = () => reject(new Error("mermaid を読み込めませんでした"));
        document.head.appendChild(s);
      });
    }
    return mermaidReady;
  }

  // Mermaid が計算する描画範囲がずれて端が切れることがあるので、実際の絵の大きさで測り直す
  function fitSvg(svg) {
    if (!svg) return;
    const b = svg.getBBox();
    if (!b.width || !b.height) return;
    const pad = 12;
    svg.setAttribute("viewBox", `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
    svg.style.maxWidth = `${Math.ceil(b.width + pad * 2)}px`;
  }

  async function drawDiagram(box, code) {
    const id = "chacy-diagram-" + ++diagramSeq;
    try {
      const mermaid = await loadMermaid();
      const { svg } = await mermaid.render(id, code);
      box.innerHTML = svg;
      fitSvg(box.querySelector("svg"));
      box.classList.add("ok");
    } catch {
      document.getElementById(id)?.remove();
      document.getElementById("d" + id)?.remove();
      box.innerHTML = `<p class="diagram-note">図をうまく描けなかったよ。図のもとになった文字だけ見せるね。</p><pre><code>${esc(code)}</code></pre>`;
    }
  }

  // final=false のあいだ（返事が届いている途中）は、図の代わりに「描いているよ」を出す
  // 日本語のかぎかっこの前後だと **太字** が効かないことがあるので、コードの外だけ先に太字にしておく
  function fixBold(text) {
    return text.split(/(```[\s\S]*?(?:```|$))/).map((part, i) =>
      i % 2 ? part : part.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")).join("");
  }

  function renderMarkdown(el, text, final) {
    el.innerHTML = DOMPurify.sanitize(marked.parse(fixBold(text)));
    $$("a[href^='http']", el).forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
    $$("pre > code.language-mermaid", el).forEach((code) => {
      const box = document.createElement("div");
      box.className = "diagram";
      const src = code.textContent;
      code.parentElement.replaceWith(box);
      if (final) {
        box.innerHTML = '<p class="diagram-note">図を描いているよ…</p>';
        drawDiagram(box, src);
      } else {
        box.innerHTML = '<p class="diagram-note">図を描いているよ…</p>';
      }
    });
    $$("table", el).forEach((t) => {
      if (t.parentElement.classList.contains("md-table")) return;
      const wrap = document.createElement("div");
      wrap.className = "md-table";
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
  }

  /* ---------- 吹き出し ---------- */
  function addUser(text) {
    log.insertAdjacentHTML("beforeend", `<div class="turn me"><div class="bubble-u">${esc(text)}</div></div>`);
  }
  function addChacy() {
    const wrap = document.createElement("div");
    wrap.className = "turn chacy";
    wrap.innerHTML = '<svg class="avatar" aria-hidden="true"><use href="#chacy"/></svg><div class="bubble-c md"></div>';
    log.appendChild(wrap);
    return wrap;
  }
  function thinking(turn, on) {
    turn.classList.toggle("thinking", on);
    if (on) $(".bubble-c", turn).innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span><span class="visually-hidden">チャシーが考えています</span>';
  }
  function showError(turn, message) {
    turn.classList.add("error");
    $(".bubble-c", turn).innerHTML = `<p>${esc(message)}</p><button type="button" class="btn ghost retry">もう一度送る</button>`;
    $(".retry", turn).addEventListener("click", () => {
      turn.remove();
      ask();
    });
  }

  function renderAll() {
    $$(".turn:not(#greeting)", log).forEach((t) => t.remove());
    history.forEach((m) => {
      if (m.role === "user") addUser(m.content);
      else renderMarkdown($(".bubble-c", addChacy()), m.content, true);
    });
    $("#chips").hidden = history.length > 0;
  }

  /* ---------- 送り先（サーバー方式 / キー入力方式） ---------- */
  let systemPrompt = null;
  async function loadSystemPrompt() {
    if (!systemPrompt) {
      const url = new URL("worker/src/system-prompt.js", document.baseURI).href;
      systemPrompt = (await import(url)).SYSTEM_PROMPT;
    }
    return systemPrompt;
  }

  async function request(messages, signal) {
    if (!KEY_MODE) {
      return fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal,
      });
    }
    // キー入力方式：指示書と会話とキーで注文票を作り、OpenAI に直接送る
    return fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey()}` },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_completion_tokens: 2000,
        reasoning_effort: "low",
        messages: [{ role: "system", content: await loadSystemPrompt() }, ...messages],
      }),
      signal,
    });
  }

  async function errorMessage(res) {
    let body = {};
    try { body = await res.json(); } catch { /* 中身がなくてもよい */ }
    if (!KEY_MODE) return body.error ? `ごめんね、${body.error}。` : "うまくつながらなかったよ。少し待ってから、もう一度送ってみてね。";
    const code = body.error && body.error.code;
    if (res.status === 401) {
      showKeySetup(true, "このAPIキーは使えないみたい。キーをもう一度確かめて、入れ直してね。");
      return "ごめんね、APIキーがまちがっているか、使えなくなっているみたい。上でキーを入れ直してね。";
    }
    if (code === "insufficient_quota") return "ごめんね、このAPIキーの利用上限に達しているみたい。キーをくれた人に伝えてね。";
    if (res.status === 429) return "ちょっと混み合っているみたい。少し待ってから、もう一度送ってみてね。";
    return "AIとうまくお話しできなかったよ。少し待ってから、もう一度送ってみてね。";
  }

  /* ---------- APIキーの入力 ---------- */
  const apiKey = () => (KEY_MODE ? store.get(API_KEY_STORE) || "" : "");
  function showKeySetup(show, message, scroll = true) {
    $("#keySetup").hidden = !show;
    $("#keyMsg").textContent = message || "";
    $("#keyMsg").classList.toggle("bad", Boolean(message));
    $("#keyStatus").hidden = !KEY_MODE || !apiKey() || show;
    input.placeholder = show ? "先にAPIキーを入れてね" : "チャシーに質問してね";
    if (show && scroll) $("#keySetup").scrollIntoView({ block: "center", behavior: "smooth" });
  }
  $("#keyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = $("#apiKey").value.trim();
    if (!/^sk-[\w-]{10,}$/.test(key)) {
      $("#keyMsg").textContent = "sk- で始まるキーを、まるごと貼り付けてね。";
      $("#keyMsg").classList.add("bad");
      return;
    }
    store.set(API_KEY_STORE, key);
    $("#apiKey").value = "";
    if (!apiKey()) {
      $("#keyMsg").textContent = "このブラウザではキーを保存できなかったよ。プライベートブラウズをやめてから、もう一度試してね。";
      $("#keyMsg").classList.add("bad");
      return;
    }
    showKeySetup(false);
    input.focus();
  });
  $("#clearKey").addEventListener("click", () => {
    try { localStorage.removeItem(API_KEY_STORE); } catch { /* 消せなくても表示は戻す */ }
    showKeySetup(true, "キーを消したよ。また使うときは、キーを入れてね。");
  });

  /* ---------- 送信と、少しずつ届く返事 ---------- */
  function setBusy(on) {
    sendBtn.textContent = on ? "止める" : "送る";
    sendBtn.classList.toggle("stop", on);
    input.disabled = on;
  }

  async function ask() {
    const turn = addChacy();
    thinking(turn, true);
    scrollDown();

    if (KEY_MODE && !apiKey()) {
      thinking(turn, false);
      showError(turn, "先に、上の「APIキーを入れてね」のところにキーを入れてね。");
      showKeySetup(true);
      return;
    }

    controller = new AbortController();
    setBusy(true);
    let text = "";
    let streaming = true;
    try {
      const res = await request(history.slice(-MAX_SEND), controller.signal);
      if (!res.ok) throw Object.assign(new Error(await errorMessage(res)), { friendly: true });

      const bubble = $(".bubble-c", turn);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let queued = false;
      const paint = () => {
        queued = false;
        if (streaming) renderMarkdown(bubble, text, false);
      };
      thinking(turn, false);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try { text += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ""; } catch { /* 途中で切れた行は飛ばす */ }
        }
        if (!queued) { queued = true; requestAnimationFrame(paint); }
      }
      streaming = false;
      if (!text.trim()) throw Object.assign(new Error("ごめんね、うまく返事が作れなかったみたい。もう一度送ってみてね。"), { friendly: true });
      renderMarkdown(bubble, text, true);
      history.push({ role: "assistant", content: text });
      save();
    } catch (err) {
      streaming = false;
      if (err.name === "AbortError") {
        if (text.trim()) {
          text += "\n\n（ここで止めたよ）";
          renderMarkdown($(".bubble-c", turn), text, true);
          history.push({ role: "assistant", content: text });
          save();
        } else {
          thinking(turn, false);
          showError(turn, "止めたよ。");
        }
      } else {
        thinking(turn, false);
        showError(turn, err.friendly ? err.message : "うまくつながらなかったよ。インターネットにつながっているか確かめて、もう一度送ってみてね。");
      }
    } finally {
      controller = null;
      setBusy(false);
      input.focus();
    }
  }

  function send(text) {
    text = text.trim();
    if (!text || controller) return;
    if (KEY_MODE && !apiKey()) {
      showKeySetup(true, "先にAPIキーを入れてね。");
      return;
    }
    history.push({ role: "user", content: text });
    save();
    addUser(text);
    $("#chips").hidden = true;
    input.value = "";
    autosize();
    ask();
  }

  /* ---------- 入力欄 ---------- */
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
  }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send(input.value);
    }
  });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    if (controller) controller.abort();
    else send(input.value);
  });
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) send(b.textContent);
  });

  // 「新しい会話」は2回押すと消える（うっかり防止）
  const newChat = $("#newChat");
  let confirmTimer = 0;
  newChat.addEventListener("click", () => {
    if (controller) return;
    if (!newChat.classList.contains("confirm")) {
      newChat.classList.add("confirm");
      newChat.textContent = "もう一度押すと、会話を消します";
      confirmTimer = setTimeout(() => { newChat.classList.remove("confirm"); newChat.textContent = "新しい会話"; }, 4000);
      return;
    }
    clearTimeout(confirmTimer);
    newChat.classList.remove("confirm");
    newChat.textContent = "新しい会話";
    history = [];
    save();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $$("[data-mode]").forEach((el) => { el.hidden = el.dataset.mode !== (KEY_MODE ? "key" : "server"); });
  if (KEY_MODE) showKeySetup(!apiKey(), "", false);
  renderAll();
  if (history.length) scrollDown();
})();
