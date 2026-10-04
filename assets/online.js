(() => {
  "use strict";
  const { $, $$, esc, wait, reduceMotion } = window.Site;

  /* ---------- 第0章: 機内モード ---------- */
  const APPS = [
    ["電卓", false], ["カメラ", false], ["アラーム", false], ["メモ", false], ["写真", false],
    ["LINE", true], ["天気", true], ["地図", true], ["オンラインゲーム", true], ["動画サイト", true],
  ];
  const grid = $("#appGrid");
  const plane = $("#planeMode");
  function renderPlane() {
    const off = plane.checked;
    $("#airplane").classList.toggle("offline", off);
    grid.innerHTML = APPS.map(([name, net]) =>
      `<div class="app-ico${net ? " net" : ""}"><i aria-hidden="true">${esc(name[0])}</i>${esc(name)}<small>${off && net ? "つながりません" : ""}</small></div>`).join("");
    $("#planeNote").textContent = off
      ? "電卓やカメラは動きますが、LINEや天気は使えなくなりました。これらは、インターネットの向こうとやり取りしないと動かないアプリです。"
      : "いまはインターネットにつながっていて、全部のアプリが使えます。上のスイッチを入れてみてください。";
  }
  plane.addEventListener("change", renderPlane);
  renderPlane();

  /* ---------- 第1章: リクエストとレスポンス ---------- */
  const REQS = [
    { server: "天気の会社", req: "宛先：https://weather.example.com\nください：東京の、今日の天気", res: "どうぞ：\n東京　晴れ\n最高24℃　最低16℃",
      note: "スマホは天気を知りません。天気の会社のサーバーに聞いて、返事を画面に出しているだけです。" },
    { server: "SNSの会社", req: "宛先：https://sns.example.com\nください：友達の新しい投稿\n本人のしるし：あなたのログイン情報", res: "どうぞ：\n・さくら「カフェに来た」\n・けんた「明日テストだ…」",
      note: "友達の投稿は、友達のスマホではなくSNSの会社のサーバーにしまってあります。だから、友達のスマホの電源が切れていても見られます。" },
    { server: "ネットショップ", req: "宛先：https://shop.example.com\nお願い：ふわふわタオルを1個買います\n本人のしるし：あなたのログイン情報", res: "どうぞ：\n注文を受け付けました（注文番号 1042）\n在庫：残り2個",
      note: "「ください」だけでなく「これを買います」のようなお願いもリクエストです。サーバーが在庫を減らして、結果を返します。" },
  ];
  let reqI = 0;
  let busy = false;
  const letter = $("#letter");
  function renderReq() {
    const r = REQS[reqI];
    $("#serverName").textContent = r.server;
    $("#reqText").textContent = r.req;
    $("#resText").textContent = r.res;
    $("#reqNote").textContent = r.note;
  }
  async function moveLetter(toRight) {
    letter.style.left = toRight ? "100%" : "0%";
    letter.style.transform = toRight ? "translate(-100%, -50%)" : "translate(0, -50%)";
    await wait(950);
  }
  Site.segmented($("#reqPicks"), (b) => {
    if (busy) return;
    reqI = Number(b.dataset.i);
    renderReq();
  });
  $("#reqSend").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    $("#reqSend").disabled = true;
    letter.style.transition = reduceMotion ? "none" : "left .9s cubic-bezier(.5,0,.2,1), transform .9s cubic-bezier(.5,0,.2,1)";
    $("#reqCard").classList.remove("dim");
    $("#resCard").classList.add("dim");
    $("#endClient").classList.add("active");
    letter.hidden = false;
    letter.classList.remove("back");
    letter.textContent = "リクエスト";
    await moveLetter(true);
    $("#endClient").classList.remove("active");
    $("#endServer").classList.add("active");
    letter.textContent = "準備中…";
    await wait(600);
    letter.classList.add("back");
    letter.textContent = "レスポンス";
    $("#endServer").classList.remove("active");
    await moveLetter(false);
    $("#endClient").classList.add("active");
    $("#resCard").classList.remove("dim");
    await wait(500);
    $("#endClient").classList.remove("active");
    letter.hidden = true;
    busy = false;
    $("#reqSend").disabled = false;
  });
  renderReq();

  /* ---------- 第2章: データはサーバーにある ---------- */
  const YOU_TEXTS = ["おはよう", "今日ひま？", "了解！", "またね"];
  const FR_TEXTS = ["やっほー", "ひまだよ", "どこ行く？", "またね"];
  let db, youList, friendList, signal, yI, fI;
  const note = (t) => { $("#chatNote").textContent = t; };
  function chatReset() {
    db = []; youList = []; friendList = []; signal = true; yI = 0; fI = 0;
    note("「送る」を押すと、メッセージがサーバーを通って友達に届きます。");
    chatRender();
  }
  function bubbles(list, me) {
    return list.length
      ? list.map((m) => `<div class="msg${m.from === me ? " mine" : ""}${m.pending ? " pending" : ""}">${esc(m.text)}${m.pending ? "<small>送信待ち</small>" : ""}</div>`).join("")
      : '<p class="muted" style="font-size:0.8rem">メッセージはまだありません</p>';
  }
  function chatRender() {
    $("#msgsYou").innerHTML = bubbles(youList, "you");
    $("#msgsFriend").innerHTML = bubbles(friendList, "friend");
    $("#dbRows").innerHTML = db.length
      ? db.map((m, i) => `<div class="db-row">#${i + 1} ${m.from === "you" ? "あなた→友達" : "友達→あなた"}：${esc(m.text)}</div>`).join("")
      : '<p class="muted" style="font-size:0.8rem">データベースは空っぽです</p>';
    $("#sigYou").textContent = signal ? "電波あり" : "圏外";
    $("#sigYou").classList.toggle("off", !signal);
    $("#toggleSig").textContent = signal ? "電波を切る" : "電波を戻す";
    $("#sendYou").textContent = `「${YOU_TEXTS[yI % YOU_TEXTS.length]}」を送る`;
    $("#sendFriend").textContent = `「${FR_TEXTS[fI % FR_TEXTS.length]}」と送る`;
  }
  $("#sendYou").addEventListener("click", () => {
    const text = YOU_TEXTS[yI++ % YOU_TEXTS.length];
    if (signal) {
      const m = { from: "you", text };
      db.push(m); youList.push(m); friendList.push(m);
      note("メッセージはまずサーバーのデータベースにしまわれ、そこから友達のスマホに届きました。");
    } else {
      youList.push({ from: "you", text, pending: true });
      note("電波がないので、サーバーに届けられません。メッセージは「送信待ち」でスマホの中に残っています。電波を戻すとどうなるでしょう？");
    }
    chatRender();
  });
  $("#sendFriend").addEventListener("click", () => {
    const m = { from: "friend", text: FR_TEXTS[fI++ % FR_TEXTS.length] };
    db.push(m); friendList.push(m);
    if (signal) {
      youList.push(m);
      note("友達のメッセージも、サーバーを通ってあなたに届きました。");
    } else {
      note("友達のメッセージはサーバーに届きましたが、あなたのスマホは圏外なので、まだ受け取れていません。");
    }
    chatRender();
  });
  $("#toggleSig").addEventListener("click", () => {
    signal = !signal;
    if (signal) {
      const waiting = youList.filter((m) => m.pending);
      waiting.forEach((m) => { const sent = { from: "you", text: m.text }; db.push(sent); friendList.push(sent); });
      youList = db.slice();
      note(waiting.length
        ? "電波が戻ったので、送信待ちのメッセージをサーバーに送り直しました。圏外の間に届いていたメッセージも受け取りました。"
        : "電波が戻りました。圏外の間にサーバーに届いていたメッセージも、まとめて受け取りました。");
    } else {
      note("あなたのスマホが圏外になりました。メッセージを送ってみてください。");
    }
    chatRender();
  });
  $("#newPhone").addEventListener("click", async () => {
    const lost = youList.filter((m) => m.pending).length;
    youList = [];
    signal = true;
    note("新しいスマホには、まだ何も入っていません…");
    chatRender();
    await wait(1100);
    youList = db.slice();
    note(lost
      ? `サーバーのデータベースから、これまでのメッセージを受け取り直しました。ただし「送信待ち」だった${lost}件は、サーバーに届いていなかったので消えてしまいました。`
      : "サーバーのデータベースから、これまでのメッセージを全部受け取り直しました。データがスマホではなくサーバーにあるからです。");
    chatRender();
  });
  chatReset();

  /* ---------- 第3章: リアルタイム通信 ---------- */
  const RT_TEXTS = ["今どこ？", "もう着くよ", "了解", "改札の前にいるね"];
  let count, asks, queue, rtI;
  function rtReset() {
    count = 3; asks = 0; queue = []; rtI = 0;
    $("#pollInbox").innerHTML = "";
    $("#liveInbox").innerHTML = "";
    rtRender();
  }
  function rtRender() {
    $("#pollCount").textContent = count;
    $("#pollAsks").textContent = asks;
    $("#pollWait").textContent = queue.length ? `サーバーで${queue.length}件が待っています。聞きに来るまで届きません…` : "";
    $("#liveWait").textContent = "";
  }
  setInterval(() => {
    count--;
    if (count <= 0) {
      asks++;
      queue.forEach((q) => {
        $("#pollInbox").insertAdjacentHTML("beforeend", `<div class="msg">${esc(q.text)}<small>届くまで ${q.delay}秒</small></div>`);
      });
      queue = [];
      count = 3;
    }
    rtRender();
  }, 1000);
  $("#rtSend").addEventListener("click", () => {
    const text = RT_TEXTS[rtI++ % RT_TEXTS.length];
    queue.push({ text, delay: count });
    $("#liveInbox").insertAdjacentHTML("beforeend", `<div class="msg">${esc(text)}<small>すぐ届いた</small></div>`);
    $("#liveWait").textContent = "サーバーがすぐに知らせてくれました。";
    $("#pollWait").textContent = `サーバーで${queue.length}件が待っています。聞きに来るまで届きません…`;
  });
  $("#rtReset").addEventListener("click", rtReset);
  rtReset();

  /* ---------- クイズ ---------- */
  Site.quiz({
    box: $("#quizBox"),
    score: $("#quizScore"),
    perfect: "オンラインアプリの仕組みはばっちりです。",
    items: [
      { q: "機内モードでも使えるのはどれ？", opts: ["LINE", "電卓", "天気予報"], a: 1, why: "電卓は手順もデータも全部スマホの中にあるので、インターネットがなくても動きます（第0章）。" },
      { q: "スマホがサーバーに出す「ください」の手紙を何という？", opts: ["レスポンス", "リクエスト", "データベース"], a: 1, why: "「ください」がリクエスト、「どうぞ」がレスポンスです（第1章）。" },
      { q: "機種変更しても、LINEの会話が戻ってくるのはなぜ？", opts: ["会話がサーバーのデータベースにしまってあるから", "古いスマホから自動で電波が飛ぶから", "AIが会話を思い出すから"], a: 0, why: "大事なデータはサーバーにあり、新しいスマホはそこから受け取り直します（第2章）。" },
      { q: "チャットで、メッセージがすぐ届くようにするしくみは？", opts: ["1時間ごとに聞きに行く", "つなぎっぱなしにして、サーバーからすぐ知らせてもらう", "手紙を2回送る"], a: 1, why: "リアルタイム通信（WebSocketなど）を使います（第3章）。" },
      { q: "URLが https で始まるのは、どういうしるし？", opts: ["無料のサイトというしるし", "通信が封筒に入れて鍵をかけたように守られているしるし", "スマホ専用のサイトというしるし"], a: 1, why: "HTTPSは、途中で盗み見されないように守られた通信です（第4章）。" },
    ],
  });
})();
