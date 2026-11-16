/** Formatting stored in a task description. Only these tags are kept. */

const ALLOWED = new Set(["STRONG", "EM", "U", "S", "UL", "OL", "LI", "BR", "DIV"])
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META"])

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function tagName(tag: string): string | null {
  if (tag === "B" || tag === "STRONG") return "strong"
  if (tag === "I" || tag === "EM") return "em"
  if (tag === "U") return "u"
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") return "s"
  if (tag === "UL") return "ul"
  if (tag === "OL") return "ol"
  if (tag === "LI") return "li"
  if (tag === "BR") return "br"
  if (tag === "P" || tag === "DIV") return "div"
  return null
}

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText((node.textContent ?? "").replace(/\u00a0/g, " "))
  }
  if (!(node instanceof HTMLElement)) return ""
  if (DROP.has(node.tagName)) return ""
  if (node.tagName === "BR") return "<br>"
  const inner = [...node.childNodes].map(serialize).join("")
  const tag = tagName(node.tagName)
  if (!tag || !ALLOWED.has(tag.toUpperCase())) return inner
  if (tag === "br") return "<br>"
  return `<${tag}>${inner}</${tag}>`
}

/** Keep bold, italic, underline, strike, and lists. Drop every other tag. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild
  if (!root) return ""
  return [...root.childNodes].map(serialize).join("")
}

export function plainText(value: string): string {
  const doc = new DOMParser().parseFromString(value, "text/html")
  return (doc.body.textContent ?? "").replace(/\u00a0/g, " ").trim()
}

function looksFormatted(value: string): boolean {
  return /<(strong|em|u|s|ul|ol|li|br|div)\b/i.test(value)
}

/** HTML the notepad can show. Older plain-text notes stay as text. */
export function toEditorHtml(value: string): string {
  if (!value) return ""
  if (looksFormatted(value)) return sanitizeHtml(value)
  return value
    .split("\n")
    .map((line) => (line ? `<div>${escapeText(line)}</div>` : "<div><br></div>"))
    .join("")
}

export function isBlankNote(value: string): boolean {
  return !plainText(value) && !/<(ul|ol)\b/i.test(value)
}
