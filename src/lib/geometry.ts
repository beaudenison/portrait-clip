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

export type BoxHandle = "body" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Pixel width / height of a normalized rect inside a frame. */
export function pixelAspectOf(rect: RectNorm, frameW: number, frameH: number): number {
  const ph = rect.h * frameH;
  if (!(ph > 0) || !(rect.w > 0) || !(frameW > 0)) return 0;
  return (rect.w * frameW) / ph;
}

/** Normalized width / height that produces `aspect` (pixel width / height) in this frame. */
export function normRatioFor(aspect: number, frameW: number, frameH: number): number {
  return (aspect * frameH) / frameW;
}

function aspectClose(actual: number, expected: number): boolean {
  if (!(actual > 0) || !(expected > 0)) return false;
  return Math.abs(actual - expected) / expected < 0.002;
}

/** Keep a rect inside the frame without changing its aspect. `ratio` is normalized w/h. */
export function clampAspectRect(rect: RectNorm, ratio: number, min = 0.04): RectNorm {
  let w = rect.w;
  let h = rect.h;
  if (!(w > 0) || !(h > 0) || !(ratio > 0)) {
    w = min;
    h = min;
  } else {
    h = w / ratio;
    if (h < min) {
      h = min;
      w = h * ratio;
    }
    if (w < min) {
      w = min;
      h = w / ratio;
    }
    if (w > 1) {
      w = 1;
      h = w / ratio;
    }
    if (h > 1) {
      h = 1;
      w = h * ratio;
    }
    if (w > 1) {
      w = 1;
      h = w / ratio;
    }
  }
  return {
    x: clamp(rect.x, 0, Math.max(0, 1 - w)),
    y: clamp(rect.y, 0, Math.max(0, 1 - h)),
    w,
    h,
  };
}

/**
 * Fit `rect` to `aspect` (pixel width / height) inside the frame.
 * A rect that already matches is returned unchanged so repeated snaps stay put.
 * Otherwise the box shrinks around its center until the ratio matches.
 */
export function snapRectToAspect(
  rect: RectNorm,
  frameW: number,
  frameH: number,
  aspect: number,
): RectNorm {
  if (!(frameW > 0) || !(frameH > 0) || !(aspect > 0)) return clampRect(rect);
  const inside =
    rect.x >= -1e-6 &&
    rect.y >= -1e-6 &&
    rect.x + rect.w <= 1 + 1e-6 &&
    rect.y + rect.h <= 1 + 1e-6;
  if (inside && aspectClose(pixelAspectOf(rect, frameW, frameH), aspect)) {
    return rect;
  }
  const ratio = normRatioFor(aspect, frameW, frameH);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let w = rect.w;
  let h = rect.h;
  if (!(w > 0) || !(h > 0)) {
    w = 0.4;
    h = w / ratio;
  } else if (w / h > ratio) {
    w = h * ratio;
  } else {
    h = w / ratio;
  }
  return clampAspectRect({ x: cx - w / 2, y: cy - h / 2, w, h }, ratio);
}

/** Move or resize a normalized rect without preserving aspect. */
export function resizeFreeRect(
  start: RectNorm,
  handle: BoxHandle,
  dx: number,
  dy: number,
): RectNorm {
  const { x, y, w, h } = start;
  switch (handle) {
    case "body":
      return clampRect({ x: x + dx, y: y + dy, w, h });
    case "e":
      return clampRect({ x, y, w: w + dx, h });
    case "w":
      return clampRect({ x: x + dx, y, w: w - dx, h });
    case "s":
      return clampRect({ x, y, w, h: h + dy });
    case "n":
      return clampRect({ x, y: y + dy, w, h: h - dy });
    case "se":
      return clampRect({ x, y, w: w + dx, h: h + dy });
    case "ne":
      return clampRect({ x, y: y + dy, w: w + dx, h: h - dy });
    case "sw":
      return clampRect({ x: x + dx, y, w: w - dx, h: h + dy });
    case "nw":
      return clampRect({ x: x + dx, y: y + dy, w: w - dx, h: h - dy });
  }
}

/** Move or resize a normalized rect while keeping `aspect` in this frame's pixels. */
export function resizeAspectRect(
  start: RectNorm,
  handle: BoxHandle,
  dx: number,
  dy: number,
  frameW: number,
  frameH: number,
  aspect: number,
): RectNorm {
  const ratio = normRatioFor(aspect, frameW, frameH);
  if (handle === "body" || !(ratio > 0)) {
    const w = start.w;
    const h = start.h;
    return {
      x: clamp(start.x + dx, 0, Math.max(0, 1 - w)),
      y: clamp(start.y + dy, 0, Math.max(0, 1 - h)),
      w,
      h,
    };
  }

  const min = 0.04;
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  if (handle === "e" || handle === "w") {
    const w = Math.max(min, handle === "e" ? start.w + dx : start.w - dx);
    const h = w / ratio;
    const x = handle === "w" ? right - w : start.x;
    const y = start.y + (start.h - h) / 2;
    return clampAspectRect({ x, y, w, h }, ratio, min);
  }

  if (handle === "n" || handle === "s") {
    const h = Math.max(min, handle === "s" ? start.h + dy : start.h - dy);
    const w = h * ratio;
    const y = handle === "n" ? bottom - h : start.y;
    const x = start.x + (start.w - w) / 2;
    return clampAspectRect({ x, y, w, h }, ratio, min);
  }

  const leftAnchored = handle === "se" || handle === "ne";
  const topAnchored = handle === "se" || handle === "sw";
  const ax = leftAnchored ? start.x : right;
  const ay = topAnchored ? start.y : bottom;
  const px = leftAnchored ? right + dx : start.x + dx;
  const py = topAnchored ? bottom + dy : start.y + dy;
  let w = Math.max(min, leftAnchored ? px - ax : ax - px);
  let h = Math.max(min, topAnchored ? py - ay : ay - py);
  const hFromW = w / ratio;
  const wFromH = h * ratio;
  if (Math.abs(hFromW - h) <= Math.abs(wFromH - w)) h = hFromW;
  else w = wFromH;
  const x = leftAnchored ? ax : ax - w;
  const y = topAnchored ? ay : ay - h;
  return clampAspectRect({ x, y, w, h }, ratio, min);
}

/** Center-crop a source rect so it covers a destination without stretching. */
export function coverCrop(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!(sw > 0) || !(sh > 0) || !(dw > 0) || !(dh > 0)) return { sx, sy, sw, sh };
  const srcAspect = sw / sh;
  const dstAspect = dw / dh;
  if (Math.abs(srcAspect - dstAspect) < 0.0001) return { sx, sy, sw, sh };
  if (srcAspect > dstAspect) {
    const cropW = sh * dstAspect;
    return { sx: sx + (sw - cropW) / 2, sy, sw: cropW, sh };
  }
  const cropH = sw / dstAspect;
  return { sx, sy: sy + (sh - cropH) / 2, sw, sh: cropH };
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
