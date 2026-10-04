// チャシー：どのページでも右下にいて、読んでいる人の「わからない」に答えるAIのお友達。
// このファイルと assets/chat-config.js を読み込むだけで、ページにチャシーが現れます。
(() => {
  "use strict";
  const { esc, store } = window.Site;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- 設定 ---------- */
  // サーバー方式：CHACY_API_URL が書いてあるとき（自分のパソコンで worker/dev-server.mjs を動かしているときも）
  // キー入力方式：それ以外。使う人が入れた APIキーで、ブラウザから直接 OpenAI に送る
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname) && window.CHACY_MODE !== "key";
  const API_URL = window.CHACY_API_URL || (isLocal ? "/chat" : "");
  const KEY_MODE = !API_URL;
  const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
  const MODEL = window.CHACY_MODEL || "gpt-5.4-mini";
  const HISTORY_STORE = "chacy-history";
  const API_KEY_STORE = "chacy-openai-key";
  const MAX_SEND = 20;  // 送る会話の数（直近20件）
  const MAX_KEEP = 60;  // ブラウザに残しておく会話の数

  /* ---------- いま読んでいるページ ---------- */
  const PAGE_INFO = {
    "page-hub": { id: "top", name: "トップページ", chips: ["アプリとWebアプリってちがうの？", "サーバーって、どこにあるの？", "コードはどこに書くの？"] },
    "page-ai": { id: "ai", name: "AIアプリのしくみ", chips: ["ChatGPTとAIのちがいが、まだよくわからない", "指示書の「#」って必ず使うの？", "APIキーは、なんで隠さないといけないの？"] },
    "page-git": { id: "git", name: "GitHubってなに？", chips: ["コミットとプッシュのちがいを図で教えて", "ブランチは、どんなときに使うの？", "GitHubは無料で使えるの？"] },
    "page-net": { id: "net", name: "オンライン通信に対応しているアプリ", chips: ["リクエストとレスポンスを図で教えて", "データベースって、どんなもの？", "WebSocketってなに？"] },
  };
  const page = Object.entries(PAGE_INFO).find(([cls]) => document.body.classList.contains(cls))?.[1] || { id: "", name: "このサイト", chips: ["アプリ作りは、何から始めればいい？"] };

  // 画面に出ている章の見出し（「Chapter 3 なぜ…」など）
  function currentSection() {
    let found = null;
    for (const ch of $$("[data-chapter]")) {
      if (ch.getBoundingClientRect().top < window.innerHeight * 0.45) found = ch;
    }
    if (!found) return "";
    const label = $(".chapno, .zero-badge", found)?.textContent.trim() || "";
    const title = $("h2", found)?.textContent.trim() || "";
    return [label, title].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 80);
  }

  /* ---------- 部品を作る ---------- */
  const MASCOT = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="chacy" viewBox="0 0 64 64">
    <path class="cy-antenna" d="M32 13 V6" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <circle class="cy-ball" cx="32" cy="6" r="3.6"/>
    <path class="cy-body" d="M32 12c14.4 0 25 9.6 25 23.5S47.3 59 32 59 7 49.4 7 35.5 17.6 12 32 12z"/>
    <ellipse class="cy-belly" cx="32" cy="44" rx="13" ry="9"/>
    <ellipse class="cy-eye" cx="23.5" cy="32" rx="3.2" ry="4.2"/>
    <ellipse class="cy-eye" cx="40.5" cy="32" rx="3.2" ry="4.2"/>
    <circle class="cy-shine" cx="24.6" cy="30.4" r="1.2"/>
    <circle class="cy-shine" cx="41.6" cy="30.4" r="1.2"/>
    <ellipse class="cy-cheek" cx="16.5" cy="39" rx="4" ry="2.6"/>
    <ellipse class="cy-cheek" cx="47.5" cy="39" rx="4" ry="2.6"/>
    <path class="cy-mouth" d="M28.5 38.5q3.5 3.4 7 0" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  </symbol></svg>`;

  const root = document.createElement("div");
  root.className = "chacy";
  root.innerHTML = `${document.getElementById("chacy") ? "" : MASCOT}
    <button type="button" class="cy-fab" aria-expanded="false" aria-controls="cyPanel">
      <svg aria-hidden="true"><use href="#chacy"/></svg>
      <span class="cy-fab-label">わからないこと、ある？</span>
      <span class="visually-hidden">チャシーに質問する</span>
    </button>
    <section class="cy-panel" id="cyPanel" role="dialog" aria-label="チャシーに質問" hidden>
      <header class="cy-head">
        <svg class="cy-head-face" aria-hidden="true"><use href="#chacy"/></svg>
        <div class="cy-head-text"><b>チャシー</b><span class="cy-where"></span></div>
        <button type="button" class="cy-icon cy-new" title="新しい会話">新しい会話</button>
        <button type="button" class="cy-icon cy-close" aria-label="閉じる">×</button>
      </header>
      <div class="cy-scroll">
        <section class="key-card cy-key" hidden>
          <h2>はじめに：APIキーを入れてね</h2>
          <p>チャシーとお話しするには、<b>OpenAIのAPIキー</b>が必要です。このサイトを紹介してくれた人から受け取ったキーを、下に貼り付けてください。</p>
          <form class="key-form cy-key-form">
            <label class="visually-hidden" for="cyApiKey">OpenAIのAPIキー</label>
            <input type="password" id="cyApiKey" autocomplete="off" spellcheck="false" placeholder="sk- で始まるキー">
            <button class="btn" type="submit">保存してはじめる</button>
          </form>
          <p class="key-msg cy-key-msg" aria-live="polite"></p>
          <ul class="key-notes">
            <li>キーは<b>このブラウザの中にだけ</b>保存されます。OpenAI以外には送りません。</li>
            <li>キーはお金のかかる大事なものです。ほかの人に見せないでね。</li>
          </ul>
        </section>
        <div class="cy-log" aria-live="polite">
          <div class="turn chacy cy-greeting">
            <svg class="avatar" aria-hidden="true"><use href="#chacy"/></svg>
            <div class="bubble-c md"></div>
          </div>
          <div class="chips cy-chips" aria-label="質問の例"></div>
        </div>
      </div>
      <form class="cy-composer">
        <label class="visually-hidden" for="cyInput">チャシーへの質問</label>
        <textarea id="cyInput" rows="1" maxlength="2000" placeholder="チャシーに質問してね"></textarea>
        <button class="btn send cy-send" type="submit">送る</button>
      </form>
      <div class="cy-foot">
        <span>Enterで送信、Shift＋Enterで改行。AIなので、まちがえることもあります。</span>
        <button type="button" class="linkish cy-clear-key" hidden>キーを消す</button>
      </div>
    </section>`;
  document.body.appendChild(root);

  const fab = $(".cy-fab", root);
  const panel = $(".cy-panel", root);
  const body = $(".cy-scroll", root);
  const log = $(".cy-log", root);
  const input = $("#cyInput");
  const sendBtn = $(".cy-send", root);
  const chips = $(".cy-chips", root);

  let history = (store.get(HISTORY_STORE) || []).filter((m) => m && typeof m.content === "string");
  let controller = null;
  let diagramSeq = 0;
  let rendered = false;

  const save = () => store.set(HISTORY_STORE, history.slice(-MAX_KEEP));
  const scrollDown = () => { body.scrollTop = body.scrollHeight; };
  const session = {
    get() { try { return sessionStorage.getItem("chacy-open") === "1"; } catch { return false; } },
    set(v) { try { sessionStorage.setItem("chacy-open", v ? "1" : "0"); } catch { /* なくても動く */ } },
  };

  /* ---------- ライブラリ（開いたときに読み込む） ---------- */
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(src + " を読み込めませんでした"));
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }
  const loadMarkdown = () => Promise.all([loadScript("assets/vendor/marked.umd.js"), loadScript("assets/vendor/purify.min.js")])
    .then(() => window.marked.setOptions({ gfm: true, breaks: true }));
  let mermaidReady = null;
  function loadMermaid() {
    if (!mermaidReady) {
      mermaidReady = loadScript("assets/vendor/mermaid.min.js").then(() => {
        const r = document.documentElement;
        const dark = r.dataset.theme === "dark" || (r.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
        window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", fontFamily: getComputedStyle(document.body).fontFamily });
        return window.mermaid;
      });
    }
    return mermaidReady;
  }

  /* ---------- Markdown と図 ---------- */
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
      fitSvg($("svg", box));
      box.classList.add("ok");
      box.tabIndex = 0;
      box.setAttribute("role", "button");
      box.setAttribute("aria-label", "図を大きく表示する");
      box.insertAdjacentHTML("beforeend", '<span class="zoom-hint" aria-hidden="true">タップで大きく見る</span>');
    } catch {
      document.getElementById(id)?.remove();
      document.getElementById("d" + id)?.remove();
      box.innerHTML = `<p class="diagram-note">図をうまく描けなかったよ。図のもとになった文字だけ見せるね。</p><pre><code>${esc(code)}</code></pre>`;
    }
  }

  // 日本語のかぎかっこの前後だと **太字** が効かないことがあるので、コードの外だけ先に太字にしておく
  function fixBold(text) {
    return text.split(/(```[\s\S]*?(?:```|$))/).map((part, i) =>
      i % 2 ? part : part.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")).join("");
  }

  // final=false のあいだ（返事が届いている途中）は、図の代わりに「描いているよ」を出す
  function renderMarkdown(el, text, final) {
    el.innerHTML = DOMPurify.sanitize(marked.parse(fixBold(text)));
    $$("a[href^='http']", el).forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
    $$("pre > code.language-mermaid", el).forEach((code) => {
      const box = document.createElement("div");
      box.className = "diagram";
      box.innerHTML = '<p class="diagram-note">図を描いているよ…</p>';
      const src = code.textContent;
      code.parentElement.replaceWith(box);
      if (final) drawDiagram(box, src);
    });
    $$("table", el).forEach((t) => {
      const wrap = document.createElement("div");
      wrap.className = "md-table";
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
  }

  /* ---------- 図を大きく見る（タップで全画面・ピンチやボタンで拡大） ---------- */
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "図を大きく表示");
  lb.innerHTML = `
    <div class="lb-stage"><div class="lb-canvas"></div></div>
    <div class="lb-bar">
      <button type="button" data-z="out" aria-label="小さくする">－</button>
      <button type="button" data-z="fit">全体</button>
      <button type="button" data-z="in" aria-label="大きくする">＋</button>
      <button type="button" data-z="close" class="lb-close">閉じる</button>
    </div>
    <p class="lb-hint">指でつまんで拡大・ドラッグで移動できるよ</p>`;
  root.appendChild(lb);
  const stage = $(".lb-stage", lb);
  const canvas = $(".lb-canvas", lb);
  const view = { s: 1, x: 0, y: 0 };
  let base = { w: 0, h: 0 };
  let opened = null; // { box, svg, spacer }

  // 拡大は図そのものの大きさを変えて描き直す（文字がぼやけない）。移動だけ transform で行う
  const applyView = () => {
    if (opened) {
      opened.svg.style.width = base.w * view.s + "px";
      opened.svg.style.height = base.h * view.s + "px";
    }
    canvas.style.transform = `translate(${view.x}px, ${view.y}px)`;
  };
  const zoomTo = (s) => { view.s = Math.min(6, Math.max(0.5, s)); applyView(); };
  const resetView = () => { view.s = 1; view.x = 0; view.y = 0; applyView(); };

  function openDiagram(box) {
    const svg = $("svg", box);
    if (!svg || opened) return;
    const [, , w, h] = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    if (!w || !h) return;
    const spacer = document.createElement("div");
    spacer.style.height = box.getBoundingClientRect().height + "px";
    box.style.display = "none";
    box.after(spacer);
    lb.hidden = false;
    const fit = Math.min((stage.clientWidth - 24) / w, (stage.clientHeight - 24) / h, 3);
    base = { w: w * fit, h: h * fit };
    svg.dataset.inlineStyle = svg.getAttribute("style") || "";
    svg.setAttribute("style", "max-width:none");
    canvas.appendChild(svg);
    opened = { box, svg, spacer };
    resetView();
    $(".lb-close", lb).focus();
  }
  function closeDiagram() {
    if (!opened) return;
    const { box, svg, spacer } = opened;
    svg.setAttribute("style", svg.dataset.inlineStyle);
    box.prepend(svg);
    box.style.display = "";
    spacer.remove();
    lb.hidden = true;
    opened = null;
    box.focus({ preventScroll: true });
  }

  log.addEventListener("click", (e) => {
    const box = e.target.closest(".diagram.ok");
    if (box) openDiagram(box);
  });
  log.addEventListener("keydown", (e) => {
    const box = e.target.closest(".diagram.ok");
    if (box && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDiagram(box); }
  });
  lb.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-z]");
    if (!b) return;
    const z = b.dataset.z;
    if (z === "close") closeDiagram();
    else if (z === "fit") resetView();
    else zoomTo(view.s * (z === "in" ? 1.4 : 1 / 1.4));
  });
  stage.addEventListener("wheel", (e) => { e.preventDefault(); zoomTo(view.s * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  stage.addEventListener("dblclick", () => (view.s > 1.2 ? resetView() : zoomTo(2.5)));

  // 1本指でドラッグ移動、2本指でピンチ拡大
  const pointers = new Map();
  let gesture = null;
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = null;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      view.x += e.clientX - prev.x;
      view.y += e.clientY - prev.y;
      applyView();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (!gesture) gesture = { dist, s: view.s };
      else zoomTo(gesture.s * (dist / gesture.dist));
    }
  });
  const endPointer = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) gesture = null; };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

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
    $(".retry", turn).addEventListener("click", () => { turn.remove(); ask(); });
  }

  function renderGreeting() {
    const sec = currentSection();
    const greet = page.id
      ? `<p><b>チャシー</b>だよ！「${esc(page.name)}」を読んでいるんだね。</p><p>わからないところがあったら、なんでも聞いてね。しくみの話は、図にして説明することもできるよ。</p>`
      : "<p><b>チャシー</b>だよ！わからないことがあったら、なんでも聞いてね。</p>";
    $(".cy-greeting .bubble-c", root).innerHTML = greet;
    const list = sec ? [`いま読んでいる「${sec}」がよくわからない`, ...page.chips] : page.chips;
    chips.innerHTML = list.map((c) => `<button type="button">${esc(c)}</button>`).join("");
    $(".cy-where", root).textContent = sec ? `いま：${sec}` : `${page.name}を読んでいるね`;
  }

  function renderAll() {
    $$(".turn:not(.cy-greeting)", log).forEach((t) => t.remove());
    history.forEach((m) => {
      if (m.role === "user") addUser(m.content);
      else renderMarkdown($(".bubble-c", addChacy()), m.content, true);
    });
    chips.hidden = history.length > 0;
  }

  /* ---------- 送り先（サーバー方式 / キー入力方式） ---------- */
  let promptModule = null;
  async function systemPrompt(section) {
    if (!promptModule) promptModule = await import(new URL("worker/src/system-prompt.js", document.baseURI).href);
    return promptModule.buildSystemPrompt(page.id, section);
  }

  async function request(messages, signal) {
    const section = currentSection();
    if (!KEY_MODE) {
      return fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, page: page.id, section }),
        signal,
      });
    }
    // キー入力方式：指示書（読んでいるページの要約つき）と会話とキーで注文票を作り、OpenAI に直接送る
    return fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey()}` },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_completion_tokens: 2000,
        reasoning_effort: "low",
        messages: [{ role: "system", content: await systemPrompt(section) }, ...messages],
      }),
      signal,
    });
  }

  async function errorMessage(res) {
    let data = {};
    try { data = await res.json(); } catch { /* 中身がなくてもよい */ }
    if (!KEY_MODE) return data.error ? `ごめんね、${data.error}。` : "うまくつながらなかったよ。少し待ってから、もう一度送ってみてね。";
    const code = data.error && data.error.code;
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
  function showKeySetup(show, message) {
    $(".cy-key", root).hidden = !show;
    const msg = $(".cy-key-msg", root);
    msg.textContent = message || "";
    msg.classList.toggle("bad", Boolean(message));
    $(".cy-clear-key", root).hidden = !KEY_MODE || !apiKey() || show;
    input.placeholder = show ? "先にAPIキーを入れてね" : "チャシーに質問してね";
    if (show) body.scrollTop = 0;
  }
  $(".cy-key-form", root).addEventListener("submit", (e) => {
    e.preventDefault();
    const field = $("#cyApiKey");
    const key = field.value.trim();
    const msg = $(".cy-key-msg", root);
    if (!/^sk-[\w-]{10,}$/.test(key)) {
      msg.textContent = "sk- で始まるキーを、まるごと貼り付けてね。";
      msg.classList.add("bad");
      return;
    }
    store.set(API_KEY_STORE, key);
    field.value = "";
    if (!apiKey()) {
      msg.textContent = "このブラウザではキーを保存できなかったよ。プライベートブラウズをやめてから、もう一度試してね。";
      msg.classList.add("bad");
      return;
    }
    showKeySetup(false);
    input.focus();
  });
  $(".cy-clear-key", root).addEventListener("click", () => {
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
        if (!streaming) return;
        const near = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
        renderMarkdown(bubble, text, false);
        if (near) scrollDown();
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
    chips.hidden = true;
    input.value = "";
    autosize();
    scrollDown();
    ask();
  }

  /* ---------- 開く・閉じる ---------- */
  async function open(auto = false) {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    root.classList.add("is-open");
    session.set(true);
    renderGreeting();
    if (KEY_MODE) showKeySetup(!apiKey());
    if (!rendered) {
      rendered = true;
      try {
        await loadMarkdown();
        renderAll();
      } catch {
        log.insertAdjacentHTML("beforeend", '<p class="diagram-note">表示の準備がうまくいかなかったよ。ページを読み込み直してみてね。</p>');
      }
    }
    scrollDown();
    if (auto) return; // ページを開いたときに自動で開く場合は、キーボードを出さない
    if (!$(".cy-key", root).hidden) $("#cyApiKey").focus();
    else input.focus({ preventScroll: true });
  }
  function close() {
    if (controller) controller.abort();
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    root.classList.remove("is-open");
    session.set(false);
    fab.focus();
  }
  fab.addEventListener("click", () => open());
  $(".cy-close", root).addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (opened) closeDiagram();
    else if (!panel.hidden) close();
  });

  /* ---------- 入力欄 ---------- */
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send(input.value);
    }
  });
  $(".cy-composer", root).addEventListener("submit", (e) => {
    e.preventDefault();
    if (controller) controller.abort();
    else send(input.value);
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const t = b.textContent;
    send(t.startsWith("いま読んでいる「") ? `${t}です。このページのたとえを使って、やさしく説明して。` : t);
  });

  // 「新しい会話」は2回押すと消える（うっかり防止）
  const newChat = $(".cy-new", root);
  let confirmTimer = 0;
  newChat.addEventListener("click", () => {
    if (controller) return;
    if (!newChat.classList.contains("confirm")) {
      newChat.classList.add("confirm");
      newChat.textContent = "もう一度押すと消えます";
      confirmTimer = setTimeout(() => { newChat.classList.remove("confirm"); newChat.textContent = "新しい会話"; }, 4000);
      return;
    }
    clearTimeout(confirmTimer);
    newChat.classList.remove("confirm");
    newChat.textContent = "新しい会話";
    history = [];
    save();
    renderAll();
    renderGreeting();
    body.scrollTop = 0;
  });

  // 開いたままスクロールしたら、「いま：〇〇」と質問の例を読んでいる章に合わせる
  let whereQueued = false;
  let lastSection = null;
  window.addEventListener("scroll", () => {
    if (panel.hidden || whereQueued) return;
    whereQueued = true;
    requestAnimationFrame(() => {
      whereQueued = false;
      const sec = currentSection();
      if (sec !== lastSection) { lastSection = sec; renderGreeting(); }
    });
  }, { passive: true });

  // ほかのページから「チャシーを開く」ボタンなどで使えるようにする
  window.Chacy = { open: () => open() };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-chacy]")) { e.preventDefault(); open(); }
  });

  // ページを移動しても開いたまま。#chacy 付きのアドレスで来たときも開く
  if (location.hash === "#chacy" || session.get()) open(true);
})();
