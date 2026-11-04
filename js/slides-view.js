// 學生手機上的「跟著看簡報」：顯示講者正在播的那一頁；可以往回翻已經播過的頁，或點圖開大圖放大
import { DECKS } from "./slides.js";
import { slideImage } from "./slide-sync.js";
import { h } from "./dom.js";

/**
 * @param {(...children: Node[]) => void} mount 把畫面放進主要區域
 * @param {(listener: (session: object | null) => void) => () => void} onSession 講者換頁時通知；回傳取消函式
 * @returns {() => void} 離開這個畫面時的清理
 */
export function renderSlides(mount, onSession) {
  const kicker = h("p", { class: "kicker" }, "跟著看簡報");
  const img = h("img", { class: "slide-img", alt: "", decoding: "async" });
  const missing = h("p", { class: "slide-missing", hidden: true });
  const frame = h("a", { class: "slide-frame", target: "_blank", rel: "noopener" }, [img, missing]);
  const position = h("p", { class: "slide-pos", "aria-live": "polite" });
  const prev = h("button", { class: "tool", type: "button", onclick: () => move(-1) }, "‹ 上一頁");
  const next = h("button", { class: "tool", type: "button", onclick: () => move(1) }, "下一頁 ›");
  const follow = h("button", { class: "btn follow", type: "button", hidden: true, onclick: () => view(null) }, "回到講者這一頁");
  mount(
    kicker, frame, h("div", { class: "slide-nav" }, [prev, position, next]), follow,
    h("p", { class: "note" }, "點投影片可以開大圖，再用兩指放大"),
  );

  let live = null; // 講者正在播的 { deck, index }
  let viewing = null; // 自己往回翻時在看的頁數；null 是跟著講者

  img.addEventListener("load", () => {
    img.hidden = false;
    missing.hidden = true;
  });
  img.addEventListener("error", () => showMissing("這一頁請看投影幕"));

  function showMissing(text) {
    img.hidden = true;
    missing.hidden = false;
    missing.textContent = text;
    frame.removeAttribute("href");
  }

  function draw() {
    if (!live) {
      showMissing("講者還沒開始放投影片");
      position.textContent = "";
      prev.disabled = true;
      next.disabled = true;
      follow.hidden = true;
      return;
    }
    const deck = DECKS[live.deck];
    const shown = viewing ?? live.index;
    const src = slideImage(DECKS, live.deck, shown);
    kicker.textContent = deck?.title ?? "跟著看簡報";
    if (src) {
      frame.href = src;
      img.alt = `${deck.title} 第 ${shown} 頁`;
      img.hidden = false;
      missing.hidden = true;
      if (img.getAttribute("src") !== src) img.src = src;
    } else {
      showMissing(deck?.count === 0 ? "這一節請看投影幕" : "這一頁請看投影幕");
    }
    const browsable = Boolean(deck?.count);
    position.textContent = viewing === null ? `第 ${shown} 頁` : `第 ${shown} 頁 · 講者在第 ${live.index} 頁`;
    prev.disabled = !browsable || shown <= 1;
    next.disabled = !browsable || shown >= live.index;
    follow.hidden = viewing === null;
  }

  /** 往回翻已經播過的頁；翻到講者這一頁就恢復跟著講者 */
  function move(step) {
    const target = (viewing ?? live.index) + step;
    view(target >= live.index ? null : Math.max(1, target));
  }

  function view(index) {
    viewing = index;
    draw();
  }

  return onSession((session) => {
    const slide = session?.slide ?? null;
    // 換了一份簡報，或講者往回翻到自己看的這頁之前：恢復跟著講者
    if (!slide || slide.deck !== live?.deck || (viewing !== null && viewing >= slide.index)) viewing = null;
    live = slide;
    draw();
    // 先抓下一頁，講者換頁時比較快出現
    const upcoming = slide && slideImage(DECKS, slide.deck, slide.index + 1);
    if (upcoming) new Image().src = upcoming;
  });
}
