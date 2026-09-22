import { Worker } from "node:worker_threads";
import { rewriteSpecifiersToAbsolute } from "./rewrite-specifiers.ts";

type WorkerMessage<Result> = { ok: true; result: Result } | { ok: false; error: string };

/**
 * Runs `fn` on a fresh worker_threads worker by serializing it with
 * `fn.toString()`. Only plain/arrow/async functions are supported — object
 * and class method shorthand (`foo() {}`) don't stringify to valid
 * standalone expressions and will throw when the worker evaluates them.
 *
 * `fromFile` should be the file `fn` was written in (e.g. `import.meta.url`
 * or `__filename`) — it anchors relative `require`/`import` specifiers
 * inside `fn`, which are rewritten to absolute paths so they still resolve
 * inside the worker.
 */
export function runInWorker<Args extends unknown[], Result>(
  fn: (...args: Args) => Result | Promise<Result>,
  args: Args,
  fromFile: string,
): Promise<Result> {
  const rewritten = rewriteSpecifiersToAbsolute(fn.toString(), fromFile);
  const bootstrap = `
    const { parentPort, workerData } = require("node:worker_threads");
    const fn = (${rewritten});
    Promise.resolve()
      .then(() => fn(...workerData.args))
      .then((result) => parentPort.postMessage({ ok: true, result }))
      .catch((error) => parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  `;

  return new Promise((resolve, reject) => {
    const worker = new Worker(bootstrap, { eval: true, workerData: { args } });
    worker.once("message", (message: WorkerMessage<Result>) => {
      void worker.terminate();
      if (message.ok) resolve(message.result);
      else reject(new Error(message.error));
    });
    worker.once("error", reject);
  });
}
