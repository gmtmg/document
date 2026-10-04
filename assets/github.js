(() => {
  "use strict";
  const { $, $$, esc } = window.Site;

  /* ---------- 第1章: セーブ（コミット）体験 ---------- */
  const newId = () => Math.random().toString(16).slice(2, 9);
  const commits = [
    { id: newId(), msg: "最初のファイルを作成", text: "名前：たろう\n好きな食べ物：カレー" },
    { id: newId(), msg: "趣味を追加", text: "名前：たろう\n好きな食べ物：カレー\n趣味：散歩" },
  ];
  let selected = commits.length - 1;
  const editor = $("#gitEditor");
  const status = (t) => { $("#gitStatus").textContent = t; };

  // 2つの文章を行ごとに比べて、追加・削除・そのままに分ける
  function lineDiff(a, b) {
    const x = a ? a.split("\n") : [];
    const y = b.split("\n");
    const L = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) { out.push(["same", x[i]]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) out.push(["del", x[i++]]);
      else out.push(["add", y[j++]]);
    }
    while (i < x.length) out.push(["del", x[i++]]);
    while (j < y.length) out.push(["add", y[j++]]);
    return out;
  }

  function renderSaves() {
    $("#gitTimeline").innerHTML = commits.map((c, i) => ({ c, i })).reverse().map(({ c, i }) =>
      `<li><button type="button" data-i="${i}" aria-pressed="${i === selected}"><span>${esc(c.msg)}</span><span class="id">${c.id}</span></button></li>`).join("");
    const prev = selected > 0 ? commits[selected - 1].text : "";
    $("#gitDiff").innerHTML = lineDiff(prev, commits[selected].text)
      .map(([k, line]) => `<div class="${k}">${k === "add" ? "+ " : k === "del" ? "- " : "  "}${esc(line) || " "}</div>`).join("");
    $("#gitRestore").disabled = selected === commits.length - 1 && editor.value === commits[selected].text;
  }
  $("#gitTimeline").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    selected = Number(b.dataset.i);
    renderSaves();
  });
  $("#gitCommit").addEventListener("click", () => {
    const text = editor.value.replace(/\s+$/, "");
    const msg = $("#gitMsg").value.trim();
    if (text === commits[commits.length - 1].text) return status("前のセーブから何も変わっていないので、セーブするものがありません。ファイルを書き換えてみてください。");
    if (!msg) return status("「何をしたか」のメモを書いてください。あとで見返したときの手がかりになります。");
    commits.push({ id: newId(), msg, text });
    selected = commits.length - 1;
    $("#gitMsg").value = "";
    status(`セーブしました（ID：${commits[selected].id}）。右の記録に増えています。`);
    renderSaves();
  });
  $("#gitRestore").addEventListener("click", () => {
    editor.value = commits[selected].text;
    status(`「${commits[selected].msg}」の時点の中身に戻しました。前のセーブは消えずに残っています。`);
    renderSaves();
  });
  editor.addEventListener("input", renderSaves);
  editor.value = commits[selected].text + "\n好きな色：";
  status("例として「好きな色」の行を書きかけています。続きを書いて、メモを付けてセーブしてみましょう。");
  renderSaves();

  /* ---------- 第3章: プッシュとプル ---------- */
  let you, hub, friend, yN, fN;
  const msg = (t) => { $("#syncMsg").textContent = t; };
  const isPrefix = (a, b) => a.length <= b.length && a.every((v, i) => v === b[i]);
  function syncReset() {
    you = ["最初"]; hub = ["最初"]; friend = ["最初"]; yN = 0; fN = 0;
    msg("3台とも同じセーブ「最初」を持っています。まず、あなたのパソコンで「セーブする」を押してみましょう。");
    syncRender();
  }
  function dots(list) {
    return list.map((c) => `<span class="dot${c.startsWith("友") ? " f" : ""}">${c}</span>`).join("");
  }
  function syncRender(flash) {
    $("#dYou").innerHTML = dots(you);
    $("#dHub").innerHTML = dots(hub);
    $("#dFriend").innerHTML = dots(friend);
    if (flash) {
      const el = $(flash);
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 700);
    }
  }
  function push(own, who) {
    if (!isPrefix(hub, own)) {
      const missing = hub.filter((c) => !own.includes(c)).join("・");
      return msg(`プッシュできません。GitHubに、${who}がまだ持っていないセーブ（${missing}）があります。先に「プル」で受け取ってください。`);
    }
    if (own.length === hub.length) return msg(`${who}には、まだGitHubに送っていないセーブがありません。先に「セーブする」を押してみましょう。`);
    hub = own.slice();
    syncRender("#mHub");
    msg(`${who}のセーブをGitHubに送りました（プッシュ）。これで、ほかの人も受け取れます。`);
  }
  function pull(own, who) {
    if (isPrefix(hub, own)) { msg(`GitHubに、${who}の知らない新しいセーブはありません。`); return own; }
    const mine = own.filter((c) => !hub.includes(c));
    const merged = hub.concat(mine);
    msg(mine.length
      ? `GitHubの新しいセーブを受け取り、${who}のまだ送っていないセーブ（${mine.join("・")}）とまとめました。これでプッシュできます。`
      : `GitHubから最新のセーブを受け取りました（プル）。${who}のパソコンも最新になりました。`);
    return merged;
  }
  $("#sync").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    switch (b.dataset.act) {
      case "you-commit": you.push("あ" + (++yN)); msg(`あなたのパソコンでセーブしました（あ${yN}）。まだGitHubには送られていません。「プッシュ」で送りましょう。`); syncRender("#mYou"); break;
      case "fr-commit": friend.push("友" + (++fN)); msg(`友達のパソコンでセーブしました（友${fN}）。まだGitHubには送られていません。`); syncRender("#mFriend"); break;
      case "you-push": push(you, "あなた"); break;
      case "fr-push": push(friend, "友達"); break;
      case "you-pull": you = pull(you, "あなた"); syncRender("#mYou"); break;
      case "fr-pull": friend = pull(friend, "友達"); syncRender("#mFriend"); break;
    }
  });
  $("#syncReset").addEventListener("click", syncReset);
  syncReset();

  /* ---------- 第4章: ブランチとプルリクエスト ---------- */
  const BR = [
    { title: "いまの本番", body: "みんなが使っているアプリです。ここを直接書き換えて壊れたら、使っている人全員が困ります。", analogy: "お店でいま出している、正式なメニュー。", draft: -1, merged: false, pr: null },
    { title: "ブランチを作る", body: "本番をコピーして、下書き用の世界線（ブランチ）を作ります。ここで何をしても、本番には影響しません。", analogy: "新メニューを、営業とは別の場所で試作しはじめる。", draft: 0, merged: false, pr: null },
    { title: "下書きで作業してセーブ", body: "新しい機能（ここでは「お問い合わせページ」）を作り、ブランチの上で何回かコミットします。", analogy: "試作を何度かくり返す。", draft: 2, merged: false, pr: null },
    { title: "プルリクエストを出す", body: "「この下書きを本番に入れていいですか？」とお願いします。仲間が中身をチェックして、コメントをくれます。", analogy: "店長に試作品を味見してもらう。", draft: 2, merged: false, pr: "open1" },
    { title: "指摘を直して、OKをもらう", body: "コメントされたところを直して、もう一度コミットします。チェックした人がOKを出します。", analogy: "「もう少し甘く」と言われて作り直し、合格をもらう。", draft: 3, merged: false, pr: "open2" },
    { title: "マージ（合体）する", body: "OKが出たので、下書きを本番に合体させます。これで、新しい機能が本番のアプリに入りました。", analogy: "試作品が、正式メニューに加わる。", draft: 3, merged: true, pr: "merged" },
  ];
  let br = 0;
  function brRender() {
    const s = BR[br];
    const dotsN = (n) => Array.from({ length: n }, () => '<span class="node-dot"></span>').join("");
    const gaps = (n) => Array.from({ length: n }, () => '<span class="node-gap"></span>').join("");
    $("#laneMain").innerHTML = dotsN(2) + (s.merged ? gaps(s.draft) + '<span class="node-dot merge" title="マージ"></span>' : "");
    $("#laneDraft").parentElement.style.visibility = s.draft < 0 ? "hidden" : "visible";
    $("#laneDraft").innerHTML = gaps(2) + dotsN(Math.max(0, s.draft));
    const comments = {
      open1: [["仲間のさくら", "いいですね！ただ、送信ボタンの色をもう少し目立たせてほしいです。"]],
      open2: [["仲間のさくら", "いいですね！ただ、送信ボタンの色をもう少し目立たせてほしいです。"], ["あなた", "直しました！"], ["仲間のさくら", "ありがとう、OKです。"]],
      merged: [["仲間のさくら", "ありがとう、OKです。"], ["GitHub", "本番（main）にマージされました。"]],
    }[s.pr];
    $("#prArea").innerHTML = s.pr
      ? `<div class="pr-card"><span class="pr-status ${s.pr === "merged" ? "merged" : "open"}">${s.pr === "merged" ? "マージ済み" : "チェック中"}</span><b>プルリクエスト：お問い合わせページを追加</b>${comments.map(([w, t]) => `<span><span class="who">${w}：</span>${t}</span>`).join("")}</div>`
      : "";
    $("#brCount").textContent = `STEP ${br + 1} / ${BR.length}`;
    $("#brTitle").textContent = s.title;
    $("#brBody").textContent = s.body;
    $("#brAnalogy").textContent = s.analogy;
    $("#brPrev").disabled = br === 0;
    $("#brNext").disabled = br === BR.length - 1;
  }
  $("#brPrev").addEventListener("click", () => { br = Math.max(0, br - 1); brRender(); });
  $("#brNext").addEventListener("click", () => { br = Math.min(BR.length - 1, br + 1); brRender(); });
  brRender();

  /* ---------- クイズ ---------- */
  Site.quiz({
    box: $("#quizBox"),
    score: $("#quizScore"),
    perfect: "もうGitHubの話についていけます。",
    items: [
      { q: "GitとGitHubの関係として正しいのは？", opts: ["同じものの別名", "Gitはセーブ機能、GitHubはセーブを預けて共有する場所", "GitHubはゲームの名前"], a: 1, why: "ゲームでいえば、本体のセーブ機能とクラウドセーブの関係です（第2章）。" },
      { q: "「コミット」とは？", opts: ["メモを付けて、いまの状態をセーブすること", "ファイルを削除すること", "アプリを公開すること"], a: 0, why: "コミット＝メモ付きのセーブ。いつでもその時点に戻れます（第1章）。" },
      { q: "自分のセーブをGitHubに送ることを何という？", opts: ["プル", "マージ", "プッシュ"], a: 2, why: "送るのがプッシュ、受け取るのがプルです（第3章）。" },
      { q: "GitHubに友達の新しいセーブがあるとき、プッシュする前にやることは？", opts: ["プルして受け取る", "友達のセーブを消す", "何もしなくていい"], a: 0, why: "先にプルしないと、友達の変更を消してしまうおそれがあるので、プッシュできません（第3章）。" },
      { q: "本番を壊さずに新しい機能を試すには？", opts: ["本番を直接書き換える", "ブランチを作って、そこで作業する", "ファイルをコピーして名前を「最終」にする"], a: 1, why: "ブランチで作り、プルリクエストでチェックしてもらってからマージします（第4章）。" },
    ],
  });
})();
