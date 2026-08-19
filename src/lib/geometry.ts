import type { RectNorm } from "../types";

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampRect(r: RectNorm, min = 0.04): RectNorm {
  const w = clamp(r.w, min, 1);
  const h = clamp(r.h, min, 1);
  const x = clamp(r.x, 0, 1 - w);
  const y = clamp(r.y, 0, 1 - h);
  return { x, y, w, h };
}

export function containRect(
  containerW: number,
  containerH: number,
  contentW: number,
  contentH: number,
): { x: number; y: number; w: number; h: number } {
  if (!containerW || !containerH || !contentW || !contentH) {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }
  const scale = Math.min(containerW / contentW, containerH / contentH);
  const w = contentW * scale;
  const h = contentH * scale;
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
  };
}

export function coverRect(
  boxW: number,
  boxH: number,
  contentW: number,
  contentH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(boxW / contentW, boxH / contentH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  const sx = (contentW - sw) / 2;
  const sy = (contentH - sh) / 2;
  return { sx, sy, sw, sh };
}

export function uid(): string {
  return crypto.randomUUID();
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs}`;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
  return cleaned || "clip";
}
