import { describe, expect, it } from "vitest";
import { decodeBase64Text, decodeText, jwtExpired, jwtSummary, jwtTimes } from "../src/decode";
import { detectLanguage } from "../src/detect";

const bytesToB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const b64 = (s: string) => bytesToB64(new TextEncoder().encode(s));
const b64url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function jwt(header: object, payload: object, sig = "c2lnbmF0dXJl") {
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${sig}`;
}

describe("JWT", () => {
  const payload = { sub: "1234", name: "Ærø Øst", iat: 1_700_000_000, exp: 1_700_003_600 };
  const token = jwt({ alg: "HS256", typ: "JWT" }, payload);

  it("decodes header and payload into one JSON document", () => {
    const d = decodeText(token);
    expect(d?.kind).toBe("jwt");
    expect(JSON.parse(d!.text)).toEqual({ header: { alg: "HS256", typ: "JWT" }, payload });
    expect(detectLanguage(d!.text).lang).toBe("json");
  });

  it("accepts a token without signature and surrounding whitespace", () => {
    expect(decodeText(`  ${jwt({ alg: "none" }, { a: 1 }, "")}\n`)?.kind).toBe("jwt");
  });

  it("reads time claims and expiry", () => {
    expect(jwtTimes(payload).map((t) => [t.claim, t.date.toISOString()])).toEqual([
      ["exp", "2023-11-14T23:13:20.000Z"],
      ["iat", "2023-11-14T22:13:20.000Z"],
    ]);
    expect(jwtExpired(payload, new Date("2023-11-14T23:00:00Z"))).toBe(false);
    expect(jwtExpired(payload, new Date("2023-11-15T00:00:00Z"))).toBe(true);
    expect(jwtExpired({ sub: "x" })).toBeUndefined();
  });

  it("summarizes the token and says the signature is not verified", () => {
    const iso = (d: Date) => d.toISOString();
    const s = jwtSummary(payload, new Date("2024-01-01T00:00:00Z"), iso);
    expect(s).toContain("signature is not verified");
    expect(s).toContain("EXPIRED");
    expect(s).toContain("exp: 2023-11-14T23:13:20.000Z");
    expect(jwtSummary({ a: 1 }, new Date(), iso)).toContain("No expiry");
  });

  it("does not take dotted text for a JWT", () => {
    expect(decodeText("eyJhbGciOi.eyJzdWIi.abc")?.kind).not.toBe("jwt");
    expect(decodeText("com.example.app")).toBeNull();
  });
});

describe("Base64", () => {
  it("decodes Base64 of JSON, which is then detected as JSON", () => {
    const d = decodeText(b64('{"id": 1, "name": "test"}'));
    expect(d).toEqual({ kind: "base64", text: '{"id": 1, "name": "test"}' });
    expect(detectLanguage(d!.text).lang).toBe("json");
  });

  it("decodes wrapped Base64, base64url and UTF-8", () => {
    const text = "Line one with æøå and some more text to make it wrap\n".repeat(3);
    const wrapped = b64(text).replace(/.{76}/g, "$&\n");
    expect(decodeText(wrapped)?.text).toBe(text);
    expect(decodeText(b64url("<root><a>ÆØÅ ?>?</a></root>"))?.text).toBe("<root><a>ÆØÅ ?>?</a></root>");
  });

  it("does not decode normal words, hex, numbers or short strings", () => {
    for (const s of [
      "SGVsbG8=", // "Hello" – too short
      "Supercalifragilisticexpialidocious",
      "ThisIsSomeIdentifierName",
      "d41d8cd98f00b204e9800998ecf8427e", // hex (MD5)
      "DEADBEEFCAFEBABE0123456789",
      "12345678901234567890",
      "myVariable2Name3Other",
      "/usr/local/bin/something",
      "hello world this is text",
      "SELECT * FROM t",
      "550e8400-e29b-41d4-a716-446655440000",
    ]) {
      expect(decodeText(s), s).toBeNull();
    }
  });

  it("rejects binary content", () => {
    expect(decodeBase64Text(bytesToB64(new Uint8Array([0, 1, 2, 255, 254, 3, 4, 5, 6, 7, 8, 9])))).toBeNull();
  });
});

describe("URL encoding", () => {
  it("decodes a query string to one key=value per line", () => {
    expect(decodeText("name=John+Smith&city=K%C3%B8benhavn&empty=")).toEqual({
      kind: "url",
      text: "name=John Smith\ncity=København\nempty=",
    });
  });

  it("decodes a URL with a query", () => {
    expect(decodeText("https://example.com/search?q=a%20b&filter=%7B%22x%22%3A1%7D")?.text).toBe(
      'https://example.com/search\nq=a b\nfilter={"x":1}',
    );
  });

  it("decodes a single encoded value and detects the result", () => {
    const d = decodeText("%7B%22id%22%3A1%2C%22tags%22%3A%5B%22a%22%5D%7D");
    expect(d?.text).toBe('{"id":1,"tags":["a"]}');
    expect(detectLanguage(d!.text).lang).toBe("json");
  });

  it("leaves text without encoding alone", () => {
    expect(decodeText("a=b")).toBeNull();
    expect(decodeText("https://example.com/path")).toBeNull();
    expect(decodeText('{"a":"%20"}')).toBeNull();
    expect(decodeText("100% sure")).toBeNull();
    expect(decodeText("%ZZ")).toBeNull();
    expect(decodeText("x == y && z")).toBeNull();
  });
});
