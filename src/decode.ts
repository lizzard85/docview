// Decoding of encoded content: JWT, Base64 and URL encoding. Detection is
// deliberately conservative – normal words, hex strings and short strings are
// never decoded.

export type Encoding = "jwt" | "base64" | "url";

export interface Decoded {
  kind: Encoding;
  /** The decoded text (for a JWT: header and payload as one JSON document). */
  text: string;
  /** JWT only: the decoded payload. */
  payload?: Record<string, unknown>;
}

export const ENCODING_LABEL: Record<Encoding, string> = {
  jwt: "JWT",
  base64: "Base64",
  url: "URL encoding",
};

/** Texts larger than this are not inspected. */
const MAX_DECODE_CHARS = 10 * 1024 * 1024;
/** Base64 shorter than this (without line breaks) is not decoded. */
export const MIN_BASE64_CHARS = 16;

// ------------------------------------------------------------------ Base64

/** Decodes Base64 or base64url to UTF-8 text. Returns null if it is not valid Base64 or not readable text. */
export function decodeBase64Text(b64: string): string | null {
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.indexOf("=");
  const body = pad < 0 ? s : s.slice(0, pad);
  if (!/^[A-Za-z0-9+/]*$/.test(body) || body.length % 4 === 1) return null;
  if (pad >= 0 && (!/^=+$/.test(s.slice(pad)) || s.length % 4 !== 0)) return null;
  s = body + "=".repeat((4 - (body.length % 4)) % 4);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return isReadable(text) ? text : null;
}

/** True when the text contains no control characters other than tabs and line breaks. */
function isReadable(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return text.length > 0 && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F�]/.test(text);
}

function decodeBase64(t: string): Decoded | null {
  // Base64 is often wrapped at 64 or 76 characters; other whitespace is not allowed.
  const s = t.replace(/\r?\n/g, "");
  if (s.length < MIN_BASE64_CHARS || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(s)) return null;
  if (/[+/]/.test(s) && /[-_]/.test(s)) return null; // mixes Base64 and base64url alphabets
  if (/^[0-9a-f]+$/i.test(s) || /^[A-Za-z]+$/.test(s) || /^\d+$/.test(s)) return null; // hex, words, numbers
  const text = decodeBase64Text(s);
  return text === null ? null : { kind: "base64", text };
}

// ------------------------------------------------------------------ JWT

const JWT = /^(eyJ[A-Za-z0-9_-]+)\.(eyJ[A-Za-z0-9_-]+)\.([A-Za-z0-9_-]*)$/;

function decodeJsonPart(part: string): Record<string, unknown> | null {
  const text = decodeBase64Text(part);
  if (text === null) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function decodeJwt(t: string): Decoded | null {
  const m = JWT.exec(t);
  if (!m) return null;
  const header = decodeJsonPart(m[1]);
  const payload = decodeJsonPart(m[2]);
  if (!header || !payload) return null;
  return { kind: "jwt", text: JSON.stringify({ header, payload }, null, 2), payload };
}

export interface JwtTime {
  claim: "exp" | "iat" | "nbf";
  date: Date;
}

/** The time claims of a JWT payload (seconds since 1970) as dates. */
export function jwtTimes(payload: Record<string, unknown>): JwtTime[] {
  const out: JwtTime[] = [];
  for (const claim of ["exp", "iat", "nbf"] as const) {
    const v = payload[claim];
    if (typeof v === "number" && Number.isFinite(v)) out.push({ claim, date: new Date(v * 1000) });
  }
  return out;
}

/** Whether the token is expired at `now`; undefined when it has no `exp`. */
export function jwtExpired(payload: Record<string, unknown>, now: Date = new Date()): boolean | undefined {
  const exp = payload.exp;
  return typeof exp === "number" ? exp * 1000 <= now.getTime() : undefined;
}

/** Notice text for a decoded JWT. */
export function jwtSummary(payload: Record<string, unknown>, now: Date = new Date(), fmt = (d: Date) => d.toLocaleString()): string {
  const parts = jwtTimes(payload).map((t) => `${t.claim}: ${fmt(t.date)}`);
  const expired = jwtExpired(payload, now);
  const status = expired === undefined ? "No expiry (exp)." : expired ? "The token is EXPIRED." : "The token is not expired.";
  return `Decoded JWT – the signature is not verified. ${status}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

// ------------------------------------------------------------------ URL encoding

const PAIR = "[^=&\\s?#]+=[^&\\s#]*";
const QUERY = new RegExp(`^${PAIR}(?:&${PAIR})*$`);

function decodeComponent(s: string, plusIsSpace: boolean): string | null {
  try {
    return decodeURIComponent(plusIsSpace ? s.replace(/\+/g, " ") : s);
  } catch {
    return null;
  }
}

function decodeUrl(t: string): Decoded | null {
  if (/\s/.test(t) || /^[{["'<]/.test(t)) return null;
  const hasEscapes = /%[0-9A-Fa-f]{2}/.test(t);

  // A query string, alone or after a URL / "?": one "key=value" per line.
  const q = t.indexOf("?");
  const base = q >= 0 ? t.slice(0, q) : "";
  const query = q >= 0 ? t.slice(q + 1) : t;
  if (QUERY.test(query) && (hasEscapes || q >= 0 || query.includes("&"))) {
    const lines: string[] = [];
    if (base) {
      const b = decodeComponent(base, false);
      if (b === null) return null;
      lines.push(b);
    }
    for (const pair of query.split("&")) {
      const eq = pair.indexOf("=");
      const k = decodeComponent(pair.slice(0, eq), true);
      const v = decodeComponent(pair.slice(eq + 1), true);
      if (k === null || v === null) return null;
      lines.push(`${k}=${v}`);
    }
    return { kind: "url", text: lines.join("\n") };
  }

  if (!hasEscapes) return null;
  const text = decodeComponent(t, false);
  return text === null || text === t || !isReadable(text) ? null : { kind: "url", text };
}

// ------------------------------------------------------------------ public

/** Decodes the whole text if it is a JWT, Base64 or URL-encoded. Returns null otherwise. */
export function decodeText(text: string): Decoded | null {
  const t = text.trim();
  if (!t || t.length > MAX_DECODE_CHARS) return null;
  return decodeJwt(t) ?? decodeBase64(t) ?? decodeUrl(t);
}
