# funcmt

Run a plain function on a [`worker_threads`](https://nodejs.org/api/worker_threads.html) worker by serializing it with `fn.toString()` — no separate worker file to write and maintain.

The catch with `fn.toString()` is that the worker has no idea where the function originally lived, so any `require(...)` / `import(...)` inside it — relative paths or bare package names — breaks. funcmt parses the function's source with the TypeScript compiler API and rewrites those specifiers to absolute paths before shipping the function off, so they resolve correctly regardless of the worker's own location.

## Install

```sh
npm install funcmt
```

`typescript` (`^5`) is a peer dependency — funcmt uses its compiler API to parse function source.

## Usage

```ts
import { runInWorker } from "funcmt";

function heavyWork(n: number) {
  const { fib } = require("./fib"); // resolved to an absolute path before running
  return fib(n);
}

const result = await runInWorker(heavyWork, [40], import.meta.url);
```

`fromFile` (the third argument — `import.meta.url` or `__filename`) anchors any relative specifiers found inside `fn`.

## API

### `runInWorker(fn, args, fromFile)`

Runs `fn(...args)` on a new worker thread and resolves with its return value (or rejects with whatever it throws).

- `fn` — a plain `function`, arrow, or `async function`. Object/class method shorthand (`foo() {}`) doesn't stringify to a valid standalone expression and isn't supported.
- `args` — arguments passed to `fn` inside the worker.
- `fromFile` — the file `fn` was written in, used to resolve its relative/bare specifiers.

### `rewriteSpecifiersToAbsolute(code, fromFile)`

The lower-level primitive `runInWorker` is built on. Parses `code`, finds every `require(...)`, dynamic `import(...)`, and static `import`/`export` module specifier, and rewrites each one to an absolute location resolved from `fromFile`:

- `require(...)` specifiers become raw absolute filesystem paths.
- `import(...)` / `import ... from` specifiers become `file://` URLs — Node's ESM loader doesn't accept a bare Windows-style absolute path.
- Node builtins (`node:fs`, `path`, ...) and specifiers that can't be resolved (e.g. a variable instead of a string literal) are left untouched.

## Limitations

- Only functions whose `toString()` is a valid standalone expression can be run — no object/class method shorthand.
- Specifiers must be string literals; `require(someVariable)` can't be statically rewritten.
- No built-in worker pool, timeout, or cancellation — `runInWorker` spawns one worker per call.

## Development

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).

## License

MIT
