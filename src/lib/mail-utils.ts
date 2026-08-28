/** Shared, dependency-light helpers for mail handling (safe on client + server). */

export interface Addr {
  name?: string;
  email: string;
}

/** Parse a header address list: `"Jane Doe <jane@x.com>, bob@y.com"`. */
export function parseAddressList(input: string | string[] | null | undefined): Addr[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join(",") : input;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAddress);
}

export function parseAddress(s: string): Addr {
  const m = s.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: m[1]?.trim() || undefined, email: m[2].trim().toLowerCase() };
  return { email: s.trim().toLowerCase() };
}

export function formatAddr(a: Addr): string {
  return a.name ? `${a.name} <${a.email}>` : a.email;
}

/** Strip `Re:` / `Fwd:` prefixes and whitespace for thread matching. */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

export function forwardSubject(subject: string): string {
  return /^fwd:/i.test(subject.trim()) ? subject : `Fwd: ${subject}`;
}

/** Very small allowlist HTML sanitizer for rendering inbound mail bodies. */
export function sanitizeEmailHtml(html: string): string {
  let out = html;
  out = out.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  out = out.replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
  return out;
}

export function snippetFromText(text: string | null, html: string | null, max = 140): string {
  const source = text ?? (html ? html.replace(/<[^>]+>/g, " ") : "");
  return source.replace(/\s+/g, " ").trim().slice(0, max);
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
