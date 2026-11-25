import { errorMessage, logger } from "@/lib/logger";

/** True once the worker is stopping: a loop finishes its current item and takes no new one. */
export type Stopping = () => boolean;

/** Never stopping: for one-off runs and tests. */
export const neverStopping: Stopping = () => false;

/**
 * Runs `run` now and every `intervalMs`, never twice at once. `run` gets a
 * function that says whether the stop has begun, so that it finishes the
 * item at hand and takes no new one. Returns a function that stops and waits
 * for the current run.
 */
export function startPolling(
  name: string,
  run: (stopping: Stopping) => Promise<unknown>,
  intervalMs: number,
): () => Promise<void> {
  let running: Promise<unknown> | undefined;
  let stopped = false;
  const stopping: Stopping = () => stopped;
  const tick = () => {
    if (running || stopped) return;
    running = run(stopping)
      .catch((error: unknown) => logger.error({ error: errorMessage(error) }, `${name} failed`))
      .finally(() => {
        running = undefined;
      });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
