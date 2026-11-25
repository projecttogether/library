import { describe, expect, it } from "vitest";
import { startPolling, type Stopping } from "./poll";

describe("startPolling", () => {
  it("tells the run at hand that the stop has begun, waits for it, and starts no other", async () => {
    let finish!: () => void;
    let seen: Stopping | undefined;
    let runs = 0;
    const stop = startPolling(
      "test",
      (stopping) => {
        runs += 1;
        seen = stopping;
        return new Promise<void>((resolve) => (finish = resolve));
      },
      5,
    );
    expect(runs).toBe(1);
    expect(seen!()).toBe(false);

    let stopped = false;
    const stopping = stop().then(() => (stopped = true));
    expect(seen!()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    finish();
    await stopping;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runs).toBe(1);
  });

  it("keeps polling after a failed run", async () => {
    let runs = 0;
    const stop = startPolling(
      "test",
      async () => {
        runs += 1;
        throw new Error("down");
      },
      5,
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    await stop();
    expect(runs).toBeGreaterThan(1);
  });
});
