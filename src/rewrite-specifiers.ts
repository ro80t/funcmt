import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

type SpecifierKind = "require" | "import";

interface SpecifierRef {
  literal: ts.StringLiteral;
  kind: SpecifierKind;
}

function findSpecifierRef(node: ts.Node): SpecifierRef | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return { literal: node.moduleSpecifier, kind: "import" };
  }
  if (ts.isCallExpression(node)) {
    const [firstArg] = node.arguments;
    if (firstArg && ts.isStringLiteral(firstArg)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
        return { literal: firstArg, kind: "import" };
      if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        return { literal: firstArg, kind: "require" };
      }
    }
  }
  return undefined;
}

/**
 * Resolves a module specifier to an absolute location.
 * Node builtins resolve to themselves (require.resolve("fs") === "fs") and are left untouched.
 */
function resolveAbsolute(require: NodeJS.Require, specifier: string): string | undefined {
  try {
    const resolved = require.resolve(specifier);
    return resolved === specifier ? undefined : resolved;
  } catch {
    return undefined;
  }
}

/**
 * Parses `code` and rewrites every `require(...)`, dynamic `import(...)`, and
 * static import/export module specifier to an absolute location, resolved as
 * if `fromFile` were doing the requiring/importing.
 *
 * This lets a function's source (via `fn.toString()`) be shipped to a
 * worker_threads worker — which has no idea where the original file lived —
 * while its relative imports and bare package imports still resolve.
 *
 * `require(...)` specifiers become raw absolute paths; `import(...)` /
 * `import ... from` specifiers become `file://` URLs, since Node's ESM loader
 * (unlike CJS) does not accept a bare Windows-style absolute path.
 */
export function rewriteSpecifiersToAbsolute(code: string, fromFile: string): string {
  const sourceFile = ts.createSourceFile(
    "funcmt-source.ts",
    code,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const require = createRequire(fromFile);

  const edits: { start: number; end: number; text: string }[] = [];

  const visit = (node: ts.Node): void => {
    const ref = findSpecifierRef(node);
    if (ref) {
      const absolute = resolveAbsolute(require, ref.literal.text);
      if (absolute !== undefined) {
        const replacement = ref.kind === "import" ? pathToFileURL(absolute).href : absolute;
        edits.push({
          start: ref.literal.getStart(sourceFile),
          end: ref.literal.getEnd(),
          text: JSON.stringify(replacement),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  edits.sort((a, b) => b.start - a.start);
  let result = code;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}
