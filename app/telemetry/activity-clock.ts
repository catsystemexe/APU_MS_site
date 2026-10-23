import type { Phase } from "./contract.ts";
export type ActivityInterval = { start_ms: number; end_ms: number; last_interaction_ms: number; phase: Phase };
/** Interaction proxy only. Event values/targets are never read. All times are monotonic offsets. */
export function createActivityClock() {
  let cursor: number | null = null, wall: number | null = null, last: number | null = null;
  let visible = false, focused = false, phase: Phase = "F1";
  function advance(now: number, civil: number): ActivityInterval[] {
    const result: ActivityInterval[] = [];
    const gap = cursor === null ? 0 : now - cursor;
    const suspended = gap < 0 || gap > 20000 || (wall !== null && Math.abs((civil - wall) - gap) > 5000);
    if (suspended) last = null; // Never interpolate a sleep/wall-clock jump into activity.
    if (!suspended && cursor !== null && last !== null && visible && focused) {
      const end = Math.min(now, last + 60000);
      for (let start = cursor; start < end;) {
        const stop = Math.min(start + 15000, end);
        result.push({ start_ms: start, end_ms: stop, last_interaction_ms: last, phase }); start = stop;
      }
    }
    cursor = now; wall = civil; return result;
  }
  return {
    tick: advance,
    interaction(now: number, civil: number) {
      // Update the real-interaction anchor without producing an event for every keystroke/scroll.
      if (cursor === null || last === null || !visible || !focused) {
        cursor = now; wall = civil; last = now; return [];
      }
      if (now < cursor || now - cursor >= 15000 || (wall !== null && Math.abs((civil - wall) - (now - cursor)) > 5000) || now - last >= 60000) {
        const result = advance(now, civil); last = now; return result;
      }
      last = now; return [];
    },
    view(now: number, civil: number, nextVisible: boolean, nextFocused: boolean) {
      const result = advance(now, civil); visible = nextVisible; focused = nextFocused; return result;
    },
    phase(now: number, civil: number, next: Phase) { const result = advance(now, civil); phase = next; return result; },
    reset(nextPhase: Phase = phase) { cursor = null; wall = null; last = null; phase = nextPhase; },
  };
}
