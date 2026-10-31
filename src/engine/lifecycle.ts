/**
 * Whether an element has left the document for good. Reading view takes the
 * sections it has scrolled past out of the document and puts them back later,
 * so an element still hanging from such a section (class `el-p`, `el-pre` and
 * so on) may return.
 */
export function isGone(el: Element): boolean {
  if (el.isConnected) return false;
  let top = el;
  while (top.parentElement) top = top.parentElement;
  return !Array.from(top.classList).some((c) => c.startsWith("el-"));
}
