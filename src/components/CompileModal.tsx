import { useEffect, useState } from "react";
import type { EncoderInfo, ExportProgress, Fps, Quality } from "../types";
import { cancelExport } from "../lib/backend";

export default function CompileModal({
  title,
  quality,
  fps,
  encoder,
  busy,
  progress,
  error,
  onTitle,
  onQuality,
  onFps,
  onStart,
  onClose,
}: {
  title: string;
  quality: Quality;
  fps: Fps;
  encoder: EncoderInfo | null;
  busy: boolean;
  progress: ExportProgress | null;
  error: string | null;
  onTitle: (t: string) => void;
  onQuality: (q: Quality) => void;
  onFps: (f: Fps) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (progress && progress.percent >= 100 && !busy) setDone(true);
  }, [progress, busy]);

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{done ? "Clip ready" : "Compile clip"}</h2>
        <p>
          {encoder
            ? `Encoder: ${encoder.label}`
            : "Local FFmpeg render. No watermark, no upload."}
        </p>
        <div className="form-grid">
          <label className="stack full">
            Title
            <input
              className="title-input"
              value={title}
              disabled={busy}
              onChange={(e) => onTitle(e.target.value)}
            />
          </label>
          <label className="stack">
            Quality
            <select
              className="field"
              value={quality}
              disabled={busy}
              onChange={(e) => onQuality(e.target.value as Quality)}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
          <label className="stack">
            Frames per second
            <select
              className="field"
              value={fps}
              disabled={busy}
              onChange={(e) => onFps(Number(e.target.value) as Fps)}
            >
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
        </div>
        {(busy || progress) && (
          <>
            <div className="progress">
              <div style={{ width: `${progress?.percent ?? 0}%` }} />
            </div>
            <div className="tiny">
              {progress?.message || "Starting…"}{" "}
              {progress?.time ? `· ${progress.time}` : ""}
            </div>
          </>
        )}
        {error && <p className="tiny" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          {busy ? (
            <button className="btn-danger" onClick={() => void cancelExport()}>
              Cancel
            </button>
          ) : (
            <>
              <button className="btn-ghost" onClick={onClose}>
                {done ? "Close" : "Cancel"}
              </button>
              {!done && (
                <button className="btn-accent" onClick={onStart}>
                  Start compilation
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
