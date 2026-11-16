import { describe, expect, it } from "vitest";
import { detectLanguage } from "../src/detect";

const cases: [string, string, string][] = [
  // [description, expected, snippet]
  ["JSON object", "json", `{"id": 1, "name": "Anna", "tags": ["a", "b"]}`],
  ["JSON array", "json", `[1, 2, 3]`],
  ["JSON with comments", "json", `{\n  // comment\n  "a": 1,\n}`],
  ["JS object literal is not JSON", "javascript", `const x = { a: 1, b: [1, 2] };\nconsole.log(x);`],

  ["single <td>", "html", `<td class="price">42</td>`],
  ["div fragment", "html", `<div class="row"><span>Hej</span><a href="/x">link</a></div>`],
  ["void tag fragment", "html", `<p>Linje 1<br>Linje 2</p>`],
  ["several html roots", "html", `<li>Et</li>\n<li>To</li>\n<li>Tre</li>`],
  ["uppercase legacy html", "html", `<TABLE><TR><TD>1</TD></TR></TABLE>`],
  ["xml element", "xml", `<Order><Id>1</Id><Customer>Anna</Customer></Order>`],
  ["xml lowercase custom", "xml", `<note><to>Tove</to><from>Jani</from><heading>Hi</heading><body>Hello</body></note>`],
  ["xml with namespace", "xml", `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>`],
  ["xml self-closing", "xml", `<add key="Timeout" value="30" />`],
  ["xaml", "xml", `<Grid><Button Content="OK" Width="80"/></Grid>`],
  ["full html doc", "html", `<!DOCTYPE html><html><head><title>x</title></head><body></body></html>`],

  ["simple select lowercase", "sql", `select * from customers where id = 1`],
  ["select with join", "sql", `SELECT c.Name, o.Total FROM Customers c INNER JOIN Orders o ON o.CustomerId = c.Id ORDER BY o.Total DESC`],
  ["insert", "sql", `insert into Users (Name, Email) values ('a', 'b@c.dk')`],
  ["update", "sql", `UPDATE Users SET Active = 0 WHERE LastLogin < '2020-01-01'`],
  ["create table", "sql", `CREATE TABLE dbo.Person (Id INT IDENTITY PRIMARY KEY, Name NVARCHAR(100) NOT NULL)`],
  ["t-sql declare", "sql", `DECLARE @id INT = 5;\nSELECT * FROM T WHERE Id = @id`],
  ["cte", "sql", `with x as (select id from t) select * from x`],

  ["css rule", "css", `.btn { color: red; padding: 4px 8px; }`],
  ["css multiple", "css", `body{margin:0}h1,h2{font-size:2rem;color:#333}`],
  ["scss", "scss", `$main: #333;\n.nav {\n  color: $main;\n  &:hover { color: red; }\n}`],
  ["yaml", "yaml", `name: build\non:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest`],
  ["yaml list", "yaml", `- name: Anna\n  age: 30\n- name: Bo\n  age: 25`],
  ["javascript", "javascript", `function add(a, b) {\n  return a + b;\n}\nconst r = add(1, 2);`],
  ["typescript", "typescript", `interface User { id: number; name: string }\nconst u: User = { id: 1, name: "x" };`],
  ["csharp", "csharp", `using System;\nnamespace App {\n  public class Person {\n    public string Name { get; set; }\n  }\n}`],
  ["csharp linq is not sql", "csharp", `var q = from c in customers where c.Age > 30 select c;\nConsole.WriteLine(q.Count());`],
  ["python", "python", `def hello(name):\n    if name:\n        print("Hej " + name)\n    return None`],
  ["python import is not sql", "python", `from os import path\nimport sys\nprint(path.join("a", "b"))`],
  ["powershell", "powershell", `Get-ChildItem -Path C:\\Temp | Where-Object { $_.Length -gt 1000 }`],
  ["bash", "bash", `#!/bin/bash\nfor f in *.txt; do\n  echo "$f"\ndone`],
  ["markdown", "markdown", `# Overskrift\n\nNoget tekst med [link](http://x.dk) og **fed**.\n\n- punkt`],
  ["ini", "ini", `[database]\nhost = localhost\nport = 5432`],
  ["plain text", "plaintext", `Hej med dig, dette er bare en almindelig sætning.`],
];

describe("detectLanguage (snippets)", () => {
  for (const [desc, expected, snippet] of cases) {
    it(`${desc} → ${expected}`, () => {
      expect(detectLanguage(snippet).lang).toBe(expected);
    });
  }
});

describe("detectLanguage (files)", () => {
  it("uses the file extension", () => {
    expect(detectLanguage("whatever", "C:\\data\\query.SQL").lang).toBe("sql");
    expect(detectLanguage("x", "/home/a/app.config").lang).toBe("xml");
    expect(detectLanguage("x", "Dockerfile").lang).toBe("dockerfile");
  });
  it("falls back to content for unknown extensions", () => {
    expect(detectLanguage(`{"a":1}`, "data.dat").lang).toBe("json");
    expect(detectLanguage(`select 1 from x`, "notes.txt").lang).toBe("sql");
  });
});
