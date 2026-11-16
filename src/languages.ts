// Supported languages. `hljs` is the highlight.js grammar used for colouring.
export interface LangInfo {
  id: string;
  label: string;
  hljs: string;
  ext: string; // default file extension (used for "open in editor")
}

export const LANGUAGES: LangInfo[] = [
  { id: "plaintext", label: "Plain text", hljs: "plaintext", ext: "txt" },
  { id: "json", label: "JSON", hljs: "json", ext: "json" },
  { id: "sql", label: "SQL", hljs: "sql", ext: "sql" },
  { id: "xml", label: "XML", hljs: "xml", ext: "xml" },
  { id: "html", label: "HTML", hljs: "xml", ext: "html" },
  { id: "css", label: "CSS", hljs: "css", ext: "css" },
  { id: "scss", label: "SCSS", hljs: "scss", ext: "scss" },
  { id: "less", label: "LESS", hljs: "less", ext: "less" },
  { id: "javascript", label: "JavaScript", hljs: "javascript", ext: "js" },
  { id: "typescript", label: "TypeScript", hljs: "typescript", ext: "ts" },
  { id: "yaml", label: "YAML", hljs: "yaml", ext: "yaml" },
  { id: "markdown", label: "Markdown", hljs: "markdown", ext: "md" },
  { id: "graphql", label: "GraphQL", hljs: "graphql", ext: "graphql" },
  { id: "csharp", label: "C#", hljs: "csharp", ext: "cs" },
  { id: "java", label: "Java", hljs: "java", ext: "java" },
  { id: "python", label: "Python", hljs: "python", ext: "py" },
  { id: "powershell", label: "PowerShell", hljs: "powershell", ext: "ps1" },
  { id: "bash", label: "Shell", hljs: "bash", ext: "sh" },
  { id: "php", label: "PHP", hljs: "php", ext: "php" },
  { id: "ini", label: "INI / TOML", hljs: "ini", ext: "ini" },
  { id: "dockerfile", label: "Dockerfile", hljs: "dockerfile", ext: "dockerfile" },
  { id: "diff", label: "Diff", hljs: "diff", ext: "diff" },
];

export const LANG_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export const EXTENSIONS: Record<string, string> = {
  json: "json", jsonc: "json", json5: "json", geojson: "json", har: "json",
  sql: "sql", ddl: "sql", dml: "sql",
  xml: "xml", xsd: "xml", xsl: "xml", xslt: "xml", xaml: "xml", config: "xml",
  csproj: "xml", vbproj: "xml", props: "xml", targets: "xml", resx: "xml",
  svg: "xml", wsdl: "xml", rss: "xml", atom: "xml", plist: "xml", nuspec: "xml",
  html: "html", htm: "html", xhtml: "html", vue: "html", cshtml: "html", razor: "html",
  css: "css", scss: "scss", sass: "scss", less: "less",
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  yaml: "yaml", yml: "yaml",
  md: "markdown", markdown: "markdown",
  graphql: "graphql", gql: "graphql",
  cs: "csharp", csx: "csharp",
  java: "java", kt: "java",
  py: "python", pyw: "python",
  ps1: "powershell", psm1: "powershell", psd1: "powershell",
  sh: "bash", bash: "bash", zsh: "bash",
  php: "php",
  ini: "ini", toml: "ini", cfg: "ini", conf: "ini", properties: "ini", env: "ini",
  diff: "diff", patch: "diff",
  txt: "plaintext", log: "plaintext", csv: "plaintext",
};

export function languageFromFilename(name: string): string | undefined {
  const base = name.split(/[\\/]/).pop() ?? name;
  const lower = base.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === ".env" || lower.startsWith(".env.")) return "ini";
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return undefined;
  return EXTENSIONS[lower.slice(dot + 1)];
}
