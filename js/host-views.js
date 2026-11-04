// 講者頁每一題的畫面：大廳 QR code、投票長條圖、文字雲、留言牆、Q&A 排行
import { CLOUD, DISCUSSIONS, EVENT, POLL, QA } from "./questions.js";
import { DECKS, SLIDES_VERSION } from "./slides.js";
import { slideImage } from "./slide-sync.js";
import { countPoll, newestFirst, rankQuestions, wordFrequencies } from "./tally.js";
import { wordKey } from "./text.js";
import { drawQr } from "./qr.js";
import { h } from "./dom.js";

const LETTERS = "ABCDEFGHIJ";
// 一次來很多筆時，文字雲最多每 1.2 秒重排一次；字太多會擠不下，只畫前 80 個
const CLOUD_DELAY_MS = 1200;
const CLOUD_MAX_WORDS = 80;
// 最多人寫的是青色、一半以上的是白色；其他的輪流用三種顏色，中文詞並排時才分得出邊界。
// 用詞本身決定顏色，重排時同一個詞的顏色不會跳來跳去
const CLOUD_COLORS = { top: "#3EE6C8", high: "#F5F6F8", rest: ["#8A8F98", "#C9CDD4", "#6DA9A0"] };
const restColor = (word) => CLOUD_COLORS.rest[
  Array.from(word).reduce((sum, ch) => sum + ch.codePointAt(0), 0) % CLOUD_COLORS.rest.length
];

/** 投票的一列：字母、選項、長條、票數 */
function barRow(option, letter) {
  const fill = h("span", { class: "fill" });
  const value = h("span", { class: "value" }, "0");
  const el = h("div", { class: "bar-row" }, [
    h("span", { class: "letter" }, letter),
    h("span", { class: "label" }, [h("strong", {}, option.name), h("small", {}, option.desc)]),
    h("span", { class: "track" }, fill),
    value,
  ]);
  return {
    el,
    update(count, total, top) {
      fill.style.transform = `scaleX(${count / top})`;
      value.textContent = total > 0 ? `${count}（${Math.round((count / total) * 100)}%）` : "0";
    },
  };
}

/** 被隱藏的留言／問題／詞收在這裡，按「恢復」可以放回去；保留展開的狀態 */
function createTray(onRestore, unit = "則") {
  const summary = h("summary", {});
  const list = h("ul", {});
  const el = h("details", { class: "tray", hidden: true }, [summary, list]);
  return {
    el,
    update(items) {
      el.hidden = items.length === 0;
      summary.textContent = `已隱藏 ${items.length} ${unit}`;
      list.replaceChildren(...items.map((item) => h("li", {}, [
        h("span", {}, item.text),
        h("button", { class: "tool", type: "button", onclick: () => onRestore(item) }, "恢復"),
      ])));
    },
  };
}

/** 用 vendor/wordcloud2.js 畫文字雲：最多人寫的詞最大、是青色；點一個詞會呼叫 onPick(那個詞) */
function drawCloud(canvas, list, onPick) {
  const box = canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(box.width * ratio);
  canvas.height = Math.round(box.height * ratio);
  const top = list[0]?.[1] ?? 1;
  const biggest = canvas.height / 4.5;
  const smallest = canvas.height / 22;
  window.WordCloud.stop();
  window.WordCloud(canvas, {
    // 給一份副本：放不下的字，wordcloud2 會直接把傳進去的字頻改小
    list: list.map(([word, count]) => [word, count]),
    fontFamily: '"Microsoft JhengHei", "Noto Sans TC", "PingFang TC", sans-serif',
    fontWeight: "700",
    weightFactor: (count) => smallest + (biggest - smallest) * Math.sqrt(count / top),
    color: (word, count) => {
      if (count === top) return CLOUD_COLORS.top;
      return count * 2 >= top ? CLOUD_COLORS.high : restColor(word);
    },
    backgroundColor: "rgba(0, 0, 0, 0)",
    gridSize: Math.round(24 * ratio),
    rotateRatio: 0,
    shrinkToFit: true,
    drawOutOfBound: false,
    click: (item) => onPick(item[0]),
  });
}

/**
 * @param {{ store: import("./store.js").Store, P: ReturnType<typeof import("./store-common.js").paths>,
 *   stage: HTMLElement, audienceUrl: string, shortUrl: string, report: (err: unknown) => void,
 *   onSession: (listener: (session: object | null) => void) => () => void }} deps
 */
export function createViews({ store, P, stage, audienceUrl, shortUrl, report, onSession }) {
  const scene = (className, children) => stage.replaceChildren(h("section", { class: `scene ${className}` }, children));
  const heading = (kicker, title) => [h("p", { class: "kicker" }, kicker), h("h1", { class: "scene-title" }, title)];
  const setFlag = (path, fields) => store.update(path, fields).catch(report);

  function lobby() {
    const canvas = h("canvas", { class: "qr-big", role: "img", "aria-label": `QR code，網址 ${shortUrl}` });
    scene("lobby", [
      h("div", { class: "lobby-text" }, [
        h("p", { class: "kicker" }, EVENT.section),
        h("h1", { class: "display" }, EVENT.titleLines.map((line) => h("span", { class: "line" }, line))),
        h("p", { class: "lead" }, "用手機掃 QR code 加入，全程匿名"),
        h("p", { class: "url" }, shortUrl),
      ]),
      h("div", { class: "qr-card" }, canvas),
    ]);
    drawQr(canvas, audienceUrl, { size: 900 });
  }

  /** 跟著看簡報：學生手機正在看的那一頁 */
  function slides() {
    const img = h("img", { class: "host-slide", alt: "" });
    const label = h("p", { class: "count" });
    scene("slides", [
      h("p", { class: "kicker" }, "跟著看簡報"),
      h("h1", { class: "scene-title" }, "學生手機正在跟著看投影片"),
      img, label,
    ]);
    return onSession((session) => {
      const slide = session?.slide ?? null;
      const deck = slide ? DECKS[slide.deck] : null;
      const src = slide ? slideImage(DECKS, slide.deck, slide.index, SLIDES_VERSION) : null;
      img.hidden = !src;
      if (src && img.getAttribute("src") !== src) img.src = src;
      if (!slide) label.textContent = "還沒開始放投影片";
      else if (deck?.count === 0) label.textContent = `${deck.title}　第 ${slide.index} 頁（這一節不公開，手機上顯示「請看投影幕」）`;
      else label.textContent = `${deck?.title ?? slide.deck}　第 ${slide.index} 頁`;
    });
  }

  function poll() {
    const rows = POLL.options.map((option, i) => barRow(option, LETTERS[i]));
    const total = h("p", { class: "count" }, "0 人作答");
    scene("poll", [...heading(POLL.label, POLL.question), h("div", { class: "bars" }, rows.map((row) => row.el)), total]);
    return store.watchQuery(P.poll, [], (docs) => {
      const { counts, total: n } = countPoll(docs, POLL.options.length);
      const top = Math.max(1, ...counts);
      rows.forEach((row, i) => row.update(counts[i], n, top));
      total.textContent = `${n} 人作答`;
    }, report);
  }

  function cloud() {
    const canvas = h("canvas", { class: "cloud-canvas", role: "img", "aria-label": "大家的回答組成的文字雲" });
    const empty = h("p", { class: "empty" }, "等大家送出…");
    const count = h("p", { class: "count" }, "0 個回答");
    // 不適當的詞：點一下就把同一個詞的回答都隱藏（全半形、大小寫算同一個），收在「已隱藏」可以恢復
    let docs = [];
    const setWordHidden = (key, hidden) => docs
      .filter((doc) => wordKey(doc.text) === key && Boolean(doc.hidden) !== hidden)
      .forEach((doc) => setFlag(`${P.cloud}/${doc.id}`, { hidden }));
    const tray = createTray((item) => setWordHidden(item.key, false), "個詞");
    scene("cloud", [
      ...heading(CLOUD.label, CLOUD.prompt),
      h("div", { class: "cloud-box" }, [canvas, empty]),
      h("div", { class: "scene-foot" }, [count, h("p", { class: "count" }, "點詞可以隱藏"), tray.el]),
    ]);
    let words = [];
    let timer = null;
    let painted = false;
    const paint = () => {
      timer = null;
      painted = true;
      empty.hidden = words.length > 0;
      drawCloud(canvas, words, (word) => setWordHidden(wordKey(word), true));
    };
    const later = (delay) => {
      timer ??= setTimeout(paint, delay);
    };
    const onResize = () => later(CLOUD_DELAY_MS);
    const stop = store.watchQuery(P.cloud, [], (next) => {
      docs = next;
      const shown = docs.filter((doc) => !doc.hidden);
      words = wordFrequencies(shown).slice(0, CLOUD_MAX_WORDS);
      count.textContent = `${shown.length} 個回答`;
      tray.update(wordFrequencies(docs.filter((doc) => doc.hidden))
        .map(([word, n]) => ({ text: `${word}（${n}）`, key: wordKey(word) })));
      later(painted ? CLOUD_DELAY_MS : 0);
    }, report);
    window.addEventListener("resize", onResize);
    return () => {
      stop();
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.WordCloud.stop();
    };
  }

  function discussion({ id, title, question }) {
    const wall = h("ul", { class: "wall" });
    const count = h("p", { class: "count" }, "0 則留言");
    const tray = createTray((item) => setFlag(`${P.comments}/${item.id}`, { hidden: false }));
    // 已經出現過的卡片不再播進場動畫
    const seen = new Set();
    scene("discussion", [...heading(title, question), wall, h("div", { class: "scene-foot" }, [count, tray.el])]);
    return store.watchQuery(P.comments, [["topic", id]], (docs) => {
      const sorted = newestFirst(docs);
      const shown = sorted.filter((comment) => !comment.hidden);
      wall.replaceChildren(...shown.map((comment) => {
        const fresh = !seen.has(comment.id);
        seen.add(comment.id);
        return h("li", { class: fresh ? "card fresh" : "card" }, [
          h("p", {}, comment.text),
          h("button", {
            class: "hide", type: "button", title: "隱藏這則", "aria-label": "隱藏這則留言",
            onclick: () => setFlag(`${P.comments}/${comment.id}`, { hidden: true }),
          }, "×"),
        ]);
      }));
      count.textContent = `${shown.length} 則留言`;
      tray.update(sorted.filter((comment) => comment.hidden));
    }, report);
  }

  function qa() {
    const list = h("ol", { class: "qa-list" });
    const count = h("p", { class: "count" }, "0 個問題");
    const tray = createTray((item) => setFlag(`${P.questions}/${item.id}`, { hidden: false }));
    scene("qa", [...heading(QA.title, QA.prompt), list, h("div", { class: "scene-foot" }, [count, tray.el])]);
    let questions = [];
    let votes = [];
    const row = (question) => h("li", { class: question.answered ? "qa-row answered" : "qa-row" }, [
      h("span", { class: "qa-votes", "aria-label": `${question.votes} 個讚` }, String(question.votes)),
      h("p", { class: "qa-text" }, question.text),
      h("div", { class: "row-tools" }, [
        h("button", {
          class: "tool", type: "button", onclick: () => setFlag(`${P.questions}/${question.id}`, { answered: !question.answered }),
        }, question.answered ? "改回未回答" : "已回答"),
        h("button", {
          class: "tool", type: "button", onclick: () => setFlag(`${P.questions}/${question.id}`, { hidden: true }),
        }, "隱藏"),
      ]),
    ]);
    const draw = () => {
      const shown = rankQuestions(questions.filter((question) => !question.hidden), votes);
      list.replaceChildren(...shown.map(row));
      count.textContent = `${shown.length} 個問題`;
      tray.update(questions.filter((question) => question.hidden));
    };
    const stops = [
      store.watchQuery(P.questions, [], (docs) => {
        questions = docs;
        draw();
      }, report),
      store.watchQuery(P.votes, [], (docs) => {
        votes = docs;
        draw();
      }, report),
    ];
    return () => stops.forEach((stop) => stop());
  }

  function end() {
    scene("end", [h("p", { class: "kicker" }, EVENT.name), h("h1", { class: "display" }, "謝謝大家")]);
  }

  const scenes = new Map([
    ["lobby", lobby],
    ["slides", slides],
    ["poll", poll],
    ["cloud", cloud],
    ...DISCUSSIONS.map((item) => [item.id, () => discussion(item)]),
    ["qa", qa],
    ["end", end],
  ]);

  /** 畫出某一題的畫面；回傳離開這一題時要做的清理 */
  return { render: (id) => (scenes.get(id) ?? lobby)() ?? (() => {}) };
}
