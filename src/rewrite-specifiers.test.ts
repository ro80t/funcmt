import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rewriteSpecifiersToAbsolute } from "./rewrite-specifiers.ts";

const thisFile = fileURLToPath(import.meta.url);

/** Pulls the string-literal argument out of `fn("...")` and decodes it (the replacement is always valid JSON). */
function literalArgOf(code: string): string {
  const match = /\((.*)\)/.exec(code);
  if (!match?.[1]) throw new Error(`no call argument found in: ${code}`);
  return JSON.parse(match[1]) as string;
}

describe("rewriteSpecifiersToAbsolute", () => {
  it("rewrites a relative require() to an absolute path", () => {
    const out = rewriteSpecifiersToAbsolute('require("./__fixtures__/greeting.cjs")', thisFile);
    expect(out).toContain("__fixtures__");
    expect(out).toMatch(/require\("[^"]*greeting\.cjs"\)/);
    expect(out).not.toContain("./__fixtures__");
  });

  it("rewrites a relative dynamic import() to a file:// URL", () => {
    const out = rewriteSpecifiersToAbsolute('import("./__fixtures__/greeting.cjs")', thisFile);
    expect(out).toMatch(/import\("file:\/\/.*greeting\.cjs"\)/);
  });

  it("leaves node builtins untouched", () => {
    const code = 'require("node:path")';
    expect(rewriteSpecifiersToAbsolute(code, thisFile)).toBe(code);
  });

  it("leaves dynamic (non-literal) specifiers untouched", () => {
    const code = "require(moduleName)";
    expect(rewriteSpecifiersToAbsolute(code, thisFile)).toBe(code);
  });

  it("round-trips a filename with quotes, backticks, ${} and unicode through require()", async () => {
    const dir = await mkdtemp(join(tmpdir(), "funcmt-"));
    try {
      const weirdName = "weird `name` with 'quote' and ${curly} and 日本語.cjs";
      const fixturePath = join(dir, weirdName);
      await writeFile(fixturePath, "module.exports = 42;\n");

      const code = `require(${JSON.stringify(`./${weirdName}`)})`;
      const out = rewriteSpecifiersToAbsolute(code, join(dir, "host.js"));

      expect(literalArgOf(out)).toBe(fixturePath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("round-trips the same kind of filename through dynamic import() as a valid file:// URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "funcmt-"));
    try {
      const weirdName = "weird `name` with 'quote' and ${curly} and 日本語.mjs";
      const fixturePath = join(dir, weirdName);
      await writeFile(fixturePath, "export default 42;\n");

      const code = `import(${JSON.stringify(`./${weirdName}`)})`;
      const out = rewriteSpecifiersToAbsolute(code, join(dir, "host.js"));

      expect(fileURLToPath(literalArgOf(out))).toBe(fixturePath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
