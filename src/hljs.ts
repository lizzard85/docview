// highlight.js core with only the grammars we use (keeps the bundle small).
import hljs from "highlight.js/lib/core";
import plaintext from "highlight.js/lib/languages/plaintext";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import less from "highlight.js/lib/languages/less";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import graphql from "highlight.js/lib/languages/graphql";
import csharp from "highlight.js/lib/languages/csharp";
import java from "highlight.js/lib/languages/java";
import python from "highlight.js/lib/languages/python";
import powershell from "highlight.js/lib/languages/powershell";
import bash from "highlight.js/lib/languages/bash";
import php from "highlight.js/lib/languages/php";
import ini from "highlight.js/lib/languages/ini";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import diff from "highlight.js/lib/languages/diff";

const grammars = {
  plaintext, json, sql, xml, css, scss, less, javascript, typescript, yaml,
  markdown, graphql, csharp, java, python, powershell, bash, php, ini,
  dockerfile, diff,
};
for (const [name, fn] of Object.entries(grammars)) hljs.registerLanguage(name, fn);

export default hljs;
