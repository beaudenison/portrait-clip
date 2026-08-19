import { useRef } from "react";
import type { Layer, RectNorm } from "../types";
import { clampRect } from "../lib/geometry";

type Handle = "body" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export default function CropOverlay({
  frame,
  layers,
  selectedId,
  showBorders,
  dimUnselected,
  which,
  onSelect,
  onChange,
}: {
  frame: { x: number; y: number; w: number; h: number };
  layers: Layer[];
  selectedId: string | null;
  showBorders: boolean;
  dimUnselected: boolean;
  which: "input" | "output";
  onSelect: (id: string) => void;
  onChange: (id: string, rect: RectNorm) => void;
}) {
  const start = useRef<{
    handle: Handle;
    id: string;
    rect: RectNorm;
    px: number;
    py: number;
  } | null>(null);

  if (!showBorders || frame.w <= 0) return null;

  function onPointerDown(
    e: React.PointerEvent,
    id: string,
    handle: Handle,
    rect: RectNorm,
    locked: boolean,
  ) {
    if (locked) {
      onSelect(id);
      return;
    }
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(id);
    start.current = { handle, id, rect: { ...rect }, px: e.clientX, py: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent, lockAspect: boolean) {
    const s = start.current;
    if (!s) return;
    const dx = (e.clientX - s.px) / frame.w;
    const dy = (e.clientY - s.py) / frame.h;
    let { x, y, w, h } = s.rect;
    const ratio = s.rect.w / s.rect.h;
    const apply = (nx: number, ny: number, nw: number, nh: number) => {
      if (lockAspect && s.handle !== "body") {
        if (s.handle === "e" || s.handle === "w") {
          nh = nw / ratio;
          ny = s.rect.y + (s.rect.h - nh) / 2;
        } else if (s.handle === "n" || s.handle === "s") {
          nw = nh * ratio;
          nx = s.rect.x + (s.rect.w - nw) / 2;
        } else {
          nh = nw / ratio;
        }
      }
      onChange(s.id, clampRect({ x: nx, y: ny, w: nw, h: nh }));
    };

    switch (s.handle) {
      case "body":
        apply(x + dx, y + dy, w, h);
        break;
      case "e":
        apply(x, y, w + dx, h);
        break;
      case "w":
        apply(x + dx, y, w - dx, h);
        break;
      case "s":
        apply(x, y, w, h + dy);
        break;
      case "n":
        apply(x, y + dy, w, h - dy);
        break;
      case "se":
        apply(x, y, w + dx, h + dy);
        break;
      case "ne":
        apply(x, y + dy, w + dx, h - dy);
        break;
      case "sw":
        apply(x + dx, y, w - dx, h + dy);
        break;
      case "nw":
        apply(x + dx, y + dy, w - dx, h - dy);
        break;
    }
  }

  function end() {
    start.current = null;
  }

  const handles: Handle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  return (
    <div
      className="crop-layer"
      style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
    >
      {layers
        .filter((l) => l.visible)
        .map((layer) => {
          const rect = layer[which];
          const selected = layer.id === selectedId;
          return (
            <div
              key={layer.id}
              className={`crop-box${selected ? " selected" : ""}${
                dimUnselected && !selected ? " dim" : ""
              }`}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                // @ts-expect-error CSS custom prop
                "--box": layer.color,
                cursor: layer.locked ? "default" : "move",
                zIndex: selected ? 3 : 1,
              }}
              onPointerDown={(e) =>
                onPointerDown(e, layer.id, "body", rect, layer.locked)
              }
              onPointerMove={(e) => onPointerMove(e, layer.lockAspect)}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <span className="box-label">{layer.name}</span>
              {selected &&
                !layer.locked &&
                handles.map((h) => (
                  <div
                    key={h}
                    className={`handle ${h}`}
                    onPointerDown={(e) =>
                      onPointerDown(e, layer.id, h, rect, false)
                    }
                  />
                ))}
            </div>
          );
        })}
    </div>
  );
}
