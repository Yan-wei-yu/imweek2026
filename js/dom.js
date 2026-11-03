// 組畫面的小工具：使用者寫的字一律當成純文字放進去，不會被當成 HTML

/**
 * 建一個元素。props 裡 on 開頭的函式是事件，true 是沒有值的屬性，false／null 不設定
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {(Node | string | number | null | false)[] | Node | string | number} [children]
 */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith("on") && typeof value === "function") el.addEventListener(name.slice(2), value);
    else if (value === true) el.setAttribute(name, "");
    else if (value !== false && value != null) el.setAttribute(name, String(value));
  }
  el.append(...[children].flat().filter((child) => child != null && child !== false));
  return el;
}
