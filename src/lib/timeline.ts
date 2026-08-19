import type { TimelineClip } from "../types";
import { uid } from "./geometry";

const MIN = 0.05;

export function fullClip(duration: number): TimelineClip[] {
  return [{ id: uid(), start: 0, end: Math.max(duration, MIN) }];
}

export function migrateClips(
  duration: number,
  clips?: TimelineClip[],
  trimStart?: number,
  trimEnd?: number,
): TimelineClip[] {
  if (clips && clips.length > 0) {
    return clips.map((c) => ({
      ...c,
      id: c.id || uid(),
      start: c.start,
      end: Math.max(c.start + MIN, c.end),
    }));
  }
  const start = trimStart ?? 0;
  const end = trimEnd ?? duration;
  return [{ id: uid(), start, end: Math.max(start + MIN, end || duration) }];
}

export function totalDuration(clips: TimelineClip[]): number {
  return clips.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0);
}

export function sourceToTimeline(clips: TimelineClip[], sourceTime: number): number {
  let t = 0;
  for (const c of clips) {
    if (sourceTime < c.start) return t;
    if (sourceTime <= c.end) return t + (sourceTime - c.start);
    t += c.end - c.start;
  }
  return t;
}

export function timelineToSource(clips: TimelineClip[], timelineTime: number): number {
  let t = timelineTime;
  for (const c of clips) {
    const d = c.end - c.start;
    if (t <= d) return c.start + Math.max(0, t);
    t -= d;
  }
  return clips[clips.length - 1]?.end ?? 0;
}

export function clipAtSource(clips: TimelineClip[], sourceTime: number): TimelineClip | null {
  return (
    clips.find((c) => sourceTime >= c.start - 0.001 && sourceTime <= c.end + 0.001) ?? null
  );
}

export function clipAtTimeline(
  clips: TimelineClip[],
  timelineTime: number,
): TimelineClip | null {
  let t = timelineTime;
  for (const c of clips) {
    const d = c.end - c.start;
    if (t <= d + 0.0001) return c;
    t -= d;
  }
  return clips[clips.length - 1] ?? null;
}

export function splitAtSource(clips: TimelineClip[], sourceTime: number): TimelineClip[] {
  const i = clips.findIndex(
    (c) => sourceTime > c.start + MIN && sourceTime < c.end - MIN,
  );
  if (i < 0) return clips;
  const c = clips[i];
  const left: TimelineClip = { id: c.id, start: c.start, end: sourceTime };
  const right: TimelineClip = { id: uid(), start: sourceTime, end: c.end };
  return [...clips.slice(0, i), left, right, ...clips.slice(i + 1)];
}

export function removeClip(clips: TimelineClip[], id: string): TimelineClip[] {
  if (clips.length <= 1) return clips;
  const next = clips.filter((c) => c.id !== id);
  return next.length > 0 ? next : clips;
}

export function trimClip(
  clips: TimelineClip[],
  id: string,
  start: number,
  end: number,
  sourceDuration: number,
): TimelineClip[] {
  return clips.map((c, i) => {
    if (c.id !== id) return c;
    const minStart = i === 0 ? 0 : clips[i - 1].end;
    const maxEnd = i === clips.length - 1 ? sourceDuration : clips[i + 1].start;
    let s = Math.max(minStart, Math.min(start, end - MIN));
    let e = Math.min(maxEnd, Math.max(end, start + MIN));
    if (e - s < MIN) e = s + MIN;
    return { ...c, start: s, end: e };
  });
}
