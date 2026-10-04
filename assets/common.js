// どのページでも使う小さな道具（進捗バー・章ナビ・クイズ）
window.Site = (() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 保存できなくても動く */ } },
  };

  /* 進捗バーと、いま読んでいる章のハイライト */
  function initNav() {
    const progress = $("#progress");
    const navLinks = $$(".chapnav a");
    const chapters = $$("[data-chapter]");
    if (!progress) return;
    function onScroll() {
      const h = document.documentElement;
      const ratio = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      progress.style.width = (ratio * 100).toFixed(1) + "%";
      let current = null;
      for (const ch of chapters) {
        if (ch.getBoundingClientRect().top < window.innerHeight * 0.4) current = ch.id;
      }
      navLinks.forEach((a) => {
        const on = a.getAttribute("href") === "#" + current;
        if (on && !a.classList.contains("is-active")) {
          const nav = a.parentElement;
          nav.scrollLeft = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2;
        }
        a.classList.toggle("is-active", on);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* 選択式クイズ。items: [{ q, opts, a, why }] */
  function quiz({ items, box, score, perfect }) {
    const state = items.map(() => null);
    function render() {
      box.innerHTML = items.map((item, qi) => {
        const answered = state[qi] !== null;
        return `<div class="q">
          <p class="q-title"><span>Q${qi + 1}</span>${item.q}</p>
          <div class="q-opts">${item.opts.map((o, oi) => {
            let cls = "";
            if (answered && oi === item.a) cls = "correct";
            else if (answered && oi === state[qi]) cls = "wrong";
            return `<button type="button" data-q="${qi}" data-o="${oi}" class="${cls}"${answered ? " disabled" : ""}>${o}</button>`;
          }).join("")}</div>
          ${answered ? `<p class="q-explain">${state[qi] === item.a ? "正解！" : "おしい！"} ${item.why}</p>` : ""}
        </div>`;
      }).join("");
      const done = state.filter((x) => x !== null).length;
      const right = state.filter((x, i) => x === items[i].a).length;
      score.innerHTML = done === items.length
        ? `${right} / ${items.length} 問正解${right === items.length ? "　" + perfect : "　解説の章を読み返してみましょう。"} <button class="btn ghost quiz-reset" type="button">もう一度</button>`
        : "";
    }
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-q]");
      if (!b) return;
      state[Number(b.dataset.q)] = Number(b.dataset.o);
      render();
    });
    score.addEventListener("click", (e) => {
      if (!e.target.closest(".quiz-reset")) return;
      state.fill(null);
      render();
    });
    render();
  }

  /* 押すと aria-pressed が切り替わるボタン群 */
  function segmented(root, onPick) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !root.contains(b)) return;
      $$("button", root).forEach((x) => x.setAttribute("aria-pressed", x === b));
      onPick(b);
    });
  }

  initNav();
  return { $, $$, esc, reduceMotion, wait, store, quiz, segmented };
})();
