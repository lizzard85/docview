// Conversions between JSON, YAML and XML, and minifying. Pure functions.
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import xmlFormat from "xml-formatter";
import YAML from "yaml";
import { stripJsonComments } from "./detect";

export type ConversionId = "json-yaml" | "yaml-json" | "xml-json" | "json-xml" | "json-min" | "xml-min";

export interface Conversion {
  id: ConversionId;
  label: string;
  /** Language of the result. */
  to: string;
}

const CONVERSIONS: Record<string, Conversion[]> = {
  json: [
    { id: "json-yaml", label: "JSON → YAML", to: "yaml" },
    { id: "json-xml", label: "JSON → XML", to: "xml" },
    { id: "json-min", label: "Minify JSON", to: "json" },
  ],
  yaml: [{ id: "yaml-json", label: "YAML → JSON", to: "json" }],
  xml: [
    { id: "xml-json", label: "XML → JSON", to: "json" },
    { id: "xml-min", label: "Minify XML", to: "xml" },
  ],
};

/** The conversions offered for a language (empty when there are none). */
export function conversionsFor(lang: string): Conversion[] {
  return CONVERSIONS[lang] ?? [];
}

// Attributes are "@name" and element text is "#text" in JSON, both ways.
const ATTR_PREFIX = "@";
const TEXT_KEY = "#text";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(stripJsonComments(text)); // JSON with comments / trailing commas
  }
}

const XML_NAME = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;

/**
 * Why `value` cannot be turned into XML cleanly, or null if it can. XML needs
 * an object at the top, element and attribute names that are valid XML names,
 * and no arrays directly inside arrays.
 */
export function jsonToXmlProblem(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "the JSON must be an object at the top level";
  }
  const walk = (v: unknown, inArray: boolean): string | null => {
    if (Array.isArray(v)) {
      if (inArray) return "it contains arrays inside arrays";
      for (const x of v) { const p = walk(x, true); if (p) return p; }
      return null;
    }
    if (v === null || typeof v !== "object") return null;
    for (const [k, x] of Object.entries(v)) {
      if (k === TEXT_KEY) {
        if (x !== null && typeof x === "object") return `"${TEXT_KEY}" must be a simple value`;
        continue;
      }
      const name = k.startsWith(ATTR_PREFIX) ? k.slice(ATTR_PREFIX.length) : k;
      if (!XML_NAME.test(name)) return `"${k}" is not a valid XML name`;
      if (k.startsWith(ATTR_PREFIX) && x !== null && typeof x === "object") return `attribute "${k}" must be a simple value`;
      const p = walk(x, false);
      if (p) return p;
    }
    return null;
  };
  return walk(value, false);
}

function jsonToXml(text: string, indent: number): string {
  const value = parseJson(text) as Record<string, unknown>;
  const problem = jsonToXmlProblem(value);
  if (problem) throw new Error(`Cannot convert to XML: ${problem}.`);
  // XML has exactly one root element; wrap several top-level keys in <root>.
  const keys = Object.keys(value);
  const single = keys.length === 1 && !keys[0].startsWith(ATTR_PREFIX) && keys[0] !== TEXT_KEY && !Array.isArray(value[keys[0]]);
  const doc = single ? value : { root: value };
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    textNodeName: TEXT_KEY,
    format: true,
    indentBy: " ".repeat(indent),
    suppressEmptyNode: true,
  });
  return (builder.build(doc) as string).trimEnd();
}

function xmlToJson(text: string, indent: number): string {
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw new Error(`The XML is not well-formed: ${valid.err.msg} (line ${valid.err.line})`);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    textNodeName: TEXT_KEY,
    ignoreDeclaration: true,
    ignorePiTags: true,
    // Keep values exactly as written ("007" stays a string).
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  return JSON.stringify(parser.parse(text), null, indent);
}

/** Runs a conversion. Throws an Error with a readable message when the input cannot be converted. */
export function convert(id: ConversionId, text: string, indent = 2): string {
  switch (id) {
    case "json-yaml":
      return YAML.stringify(parseJson(text), { indent }).trimEnd();
    case "yaml-json": {
      const doc = YAML.parseDocument(text);
      if (doc.errors.length) throw new Error(doc.errors[0].message);
      return JSON.stringify(doc.toJS(), null, indent);
    }
    case "xml-json":
      return xmlToJson(text, indent);
    case "json-xml":
      return jsonToXml(text, indent);
    case "json-min":
      return JSON.stringify(parseJson(text));
    case "xml-min": {
      const valid = XMLValidator.validate(text);
      if (valid !== true) throw new Error(`The XML is not well-formed: ${valid.err.msg} (line ${valid.err.line})`);
      return xmlFormat.minify(text, { collapseContent: true });
    }
  }
}
