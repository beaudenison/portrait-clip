import { useEffect, useRef, useState } from "react";
import type { Layer, RectNorm } from "../types";
import { containRect } from "../lib/geometry";
import CropOverlay from "./CropOverlay";

export default function InputPreview({
  src,
  videoRef,
  layers,
  selectedId,
  showBorders,
  onSelect,
  onChange,
  onMeta,
}: {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  layers: Layer[];
  selectedId: string | null;
  showBorders: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, rect: RectNorm) => void;
  onMeta: (d: { duration: number; width: number; height: number }) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 0, h: 0 });

  function measure() {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video || !video.videoWidth) return;
    const r = wrap.getBoundingClientRect();
    setFrame(containRect(r.width, r.height, video.videoWidth, video.videoHeight));
  }

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const obs = new ResizeObserver(measure);
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="preview-frame" ref={wrapRef}>
      <video
        ref={videoRef as React.Ref<HTMLVideoElement>}
        src={src}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          onMeta({
            duration: v.duration,
            width: v.videoWidth,
            height: v.videoHeight,
          });
          measure();
        }}
        playsInline
      />
      <CropOverlay
        frame={frame}
        layers={layers}
        selectedId={selectedId}
        showBorders={showBorders}
        dimUnselected={false}
        which="input"
        onSelect={onSelect}
        onChange={onChange}
      />
    </div>
  );
}
