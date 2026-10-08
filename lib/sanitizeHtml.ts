// Minimal allow-list HTML sanitizer for the free-text health history: only simple formatting tags survive,
// every attribute is dropped, and scripts/styles/other elements are removed with their content.
const ALLOWED = new Set(["b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li", "h2", "h3", "div", "span"]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[\s\S]*?<\/\1\s*>/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, name: string) => {
      const n = name.toLowerCase();
      if (!ALLOWED.has(n)) return "";
      return tag.startsWith("</") ? `</${n}>` : n === "br" ? "<br>" : `<${n}>`;
    })
    .replace(/<(?![a-z/])/gi, "&lt;"); // a stray "<" that is not a tag
}
