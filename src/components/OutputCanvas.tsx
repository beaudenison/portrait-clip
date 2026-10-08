import { useEffect, useRef, useState } from "react";
import type { Layer, OutputFormat } from "../types";
import { containRect, coverCrop, coverRect } from "../lib/geometry";
import CropOverlay from "./CropOverlay";
import type { RectNorm } from "../types";

const ASPECT: Record<OutputFormat, number> = {
  portrait: 9 / 16,
  square: 1,
  landscape: 16 / 9,
};

export default function OutputCanvas({
  video,
  format,
  blur,
  layers,
  selectedId,
  showBorders,
  onSelect,
  onChange,
}: {
  video: HTMLVideoElement | null;
  format: OutputFormat;
  blur: boolean;
  layers: Layer[];
  selectedId: string | null;
  showBorders: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, rect: RectNorm) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      setBox(containRect(r.width, r.height, ASPECT[format] * 1000, 1000));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(wrap);
    return () => obs.disconnect();
  }, [format]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = Math.max(2, Math.round(box.w) || 2);
      const h = Math.max(2, Math.round(box.h) || 2);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (video && video.readyState >= 2 && video.videoWidth) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        if (blur) {
          ctx.filter = "blur(18px)";
          const cover = coverRect(w, h, video.videoWidth, video.videoHeight);
          ctx.drawImage(
            video,
            cover.sx,
            cover.sy,
            cover.sw,
            cover.sh,
            0,
            0,
            w,
            h,
          );
          ctx.filter = "none";
        }
        for (const layer of layers) {
          if (!layer.visible) continue;
          const sx = layer.input.x * video.videoWidth;
          const sy = layer.input.y * video.videoHeight;
          const sw = layer.input.w * video.videoWidth;
          const sh = layer.input.h * video.videoHeight;
          const dx = layer.output.x * w;
          const dy = layer.output.y * h;
          const dw = layer.output.w * w;
          const dh = layer.output.h * h;
          if (sw > 1 && sh > 1 && dw > 1 && dh > 1) {
            const crop = coverCrop(sx, sy, sw, sh, dw, dh);
            ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [video, layers, blur, box]);

  return (
    <div className="preview-frame" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          background: "#000",
        }}
      />
      <CropOverlay
        frame={box}
        layers={layers}
        selectedId={selectedId}
        showBorders={showBorders}
        dimUnselected
        which="output"
        onSelect={onSelect}
        onChange={onChange}
      />
    </div>
  );
}
