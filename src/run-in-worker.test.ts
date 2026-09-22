import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInWorker } from "./run-in-worker.ts";

const thisFile = fileURLToPath(import.meta.url);

describe("runInWorker", () => {
  it("resolves a relative require() inside the worker even though eval'd code has no file of its own", async () => {
    function job(name: string) {
      const { greet } = require("./__fixtures__/greeting.cjs");
      return greet(name);
    }

    const result = await runInWorker(job, ["world"], thisFile);
    expect(result).toBe("hello, world");
  });

  it("propagates a thrown error from the worker as a rejection", async () => {
    function job() {
      throw new Error("boom");
    }

    await expect(runInWorker(job, [], thisFile)).rejects.toThrow("boom");
  });
});
