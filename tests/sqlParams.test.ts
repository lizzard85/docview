import { describe, expect, it } from "vitest";
import { efLiteral, inlineSqlParams, parseSqlWithParams, substituteParams } from "../src/sqlParams";

describe("sp_executesql", () => {
  it("inlines parameters of several types", () => {
    const text =
      "exec sp_executesql N'SELECT * FROM Orders WHERE Id = @p0 AND Name = @p1 AND Note IS @p2 AND Created > @p3 AND Ref = @p4 AND Active = @p5'," +
      "N'@p0 int,@p1 nvarchar(4000),@p2 nvarchar(max),@p3 datetime2(7),@p4 uniqueidentifier,@p5 bit'," +
      "@p0=42,@p1=N'O''Brien',@p2=NULL,@p3='2024-01-31 10:00:00',@p4='0f8fad5b-d9cb-469f-a165-70867728950e',@p5=1";
    expect(inlineSqlParams(text)).toEqual({
      kind: "sp_executesql",
      sql:
        "SELECT * FROM Orders WHERE Id = 42 AND Name = N'O''Brien' AND Note IS NULL AND Created > '2024-01-31 10:00:00'" +
        " AND Ref = '0f8fad5b-d9cb-469f-a165-70867728950e' AND Active = 1",
    });
  });

  it("does not replace @p1 inside @p10", () => {
    const decl = Array.from({ length: 11 }, (_, i) => `@p${i} int`).join(",");
    const vals = Array.from({ length: 11 }, (_, i) => `@p${i}=${i * 100}`).join(",");
    const text = `EXEC sp_executesql N'SELECT @p1, @p10, @P1', N'${decl}', ${vals}`;
    expect(inlineSqlParams(text)?.sql).toBe("SELECT 100, 1000, 100");
  });

  it("unescapes doubled quotes in the SQL text and keeps string literals intact", () => {
    const text = "exec sp_executesql N'SELECT ''@p0 is here'', @p0 -- @p0\nFROM [@p0]',N'@p0 int',@p0=7";
    expect(inlineSqlParams(text)?.sql).toBe("SELECT '@p0 is here', 7 -- @p0\nFROM [@p0]");
  });

  it("handles decimal declarations, negative numbers, positional values and OUTPUT", () => {
    const text = "exec sp_executesql N'SELECT @a, @b, @c', N'@a decimal(18,2), @b int, @c int OUTPUT', -1.5, @b = 3, @c = @c OUTPUT;";
    const parsed = parseSqlWithParams(text);
    expect(parsed?.params.get("@a")).toBe("-1.5");
    expect(parsed?.params.get("@b")).toBe("3");
  });

  it("handles sp_executesql without parameters", () => {
    expect(inlineSqlParams("exec sp_executesql N'SELECT ''x'''")?.sql).toBe("SELECT 'x'");
  });

  it("fails on malformed calls", () => {
    expect(parseSqlWithParams("exec sp_executesql N'SELECT 1")).toBeNull();
    expect(parseSqlWithParams("exec sp_executesql N'SELECT @p0', N'@p0 int', @p0 42")).toBeNull();
  });
});

describe("EF Core logs", () => {
  const log = [
    "info: Microsoft.EntityFrameworkCore.Database.Command[20101]",
    "      Executed DbCommand (3ms) [Parameters=[@__id_0='42' (Nullable = true), @__name_1='It's \"ok\"' (Size = 4000), @__ref_2=NULL (DbType = Guid), @__active_3='True', @__from_4='2024-01-31T00:00:00.0000000' (DbType = DateTime2), @__code_5='007' (Size = 10) (DbType = AnsiString)], CommandType='Text', CommandTimeout='30']",
    "      SELECT [o].[Id]",
    "      FROM [Orders] AS [o]",
    "      WHERE [o].[Id] = @__id_0 AND [o].[Name] = @__name_1 AND [o].[Ref] = @__ref_2 AND [o].[Active] = @__active_3 AND [o].[From] >= @__from_4 AND [o].[Code] = @__code_5",
  ].join("\n");

  it("inlines multiple parameters including quotes and NULL", () => {
    const r = inlineSqlParams(log);
    expect(r?.kind).toBe("efcore");
    expect(r?.sql).toBe(
      [
        "SELECT [o].[Id]",
        "FROM [Orders] AS [o]",
        "WHERE [o].[Id] = 42 AND [o].[Name] = N'It''s \"ok\"' AND [o].[Ref] = NULL AND [o].[Active] = 1 AND [o].[From] >= '2024-01-31T00:00:00.0000000' AND [o].[Code] = '007'",
      ].join("\n"),
    );
  });

  it("handles a log without parameters", () => {
    const r = inlineSqlParams("Executed DbCommand (1ms) [Parameters=[], CommandType='Text', CommandTimeout='30']\nSELECT 1");
    expect(r?.sql).toBe("SELECT 1");
  });

  it("does not inline hidden values (sensitive data logging off)", () => {
    expect(inlineSqlParams("Executed DbCommand (1ms) [Parameters=[@p0='?' (DbType = Int32)], CommandType='Text', CommandTimeout='30']\nSELECT @p0")).toBeNull();
  });

  it("converts values to literals", () => {
    expect(efLiteral("42", "")).toBe("42");
    expect(efLiteral("42", " (Size = 4000)")).toBe("N'42'");
    expect(efLiteral("False", "")).toBe("0");
    expect(efLiteral(null, "")).toBe("NULL");
    expect(efLiteral("0f8fad5b-d9cb-469f-a165-70867728950e", " (DbType = Guid)")).toBe("'0f8fad5b-d9cb-469f-a165-70867728950e'");
  });
});

describe("no parameters", () => {
  it("leaves plain SQL untouched", () => {
    expect(parseSqlWithParams("SELECT * FROM t WHERE id = @id")).toBeNull();
    expect(inlineSqlParams("DECLARE @x int = 1; SELECT @x")).toBeNull();
  });

  it("only replaces known parameters", () => {
    expect(substituteParams("SELECT @@ROWCOUNT, @x, @y, email@host", new Map([["@x", "1"]]))).toBe("SELECT @@ROWCOUNT, 1, @y, email@host");
  });
});
