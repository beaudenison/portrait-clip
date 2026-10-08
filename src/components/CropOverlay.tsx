import { useRef } from "react";
import type { Layer, RectNorm } from "../types";
import { resizeAspectRect, resizeFreeRect, type BoxHandle } from "../lib/geometry";

type Handle = BoxHandle;

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

  function onPointerMove(e: React.PointerEvent, layer: Layer) {
    const s = start.current;
    if (!s || frame.w <= 0 || frame.h <= 0) return;
    const dx = (e.clientX - s.px) / frame.w;
    const dy = (e.clientY - s.py) / frame.h;
    const aspect = layer.aspect && layer.aspect > 0 ? layer.aspect : 16 / 9;
    const next =
      layer.lockAspect === false
        ? resizeFreeRect(s.rect, s.handle, dx, dy)
        : resizeAspectRect(s.rect, s.handle, dx, dy, frame.w, frame.h, aspect);
    onChange(s.id, next);
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
              onPointerMove={(e) => onPointerMove(e, layer)}
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
