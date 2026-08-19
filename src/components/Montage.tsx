import { useEffect, useState } from "react";
import type {
  ClipRecord,
  EncoderInfo,
  ExportProgress,
  MontageRecord,
  Transition,
} from "../types";
import { OUTPUT_SIZES } from "../types";
import { sanitizeFilename, uid } from "../lib/geometry";
import {
  defaultExportDir,
  detectEncoder,
  exportMontage,
  fileSrc,
  joinPath,
  onExportProgress,
} from "../lib/backend";

export default function Montage({
  clips,
  onCreated,
  onToast,
  exportDir,
}: {
  clips: ClipRecord[];
  onCreated: (m: MontageRecord) => void;
  onToast: (msg: string, error?: boolean) => void;
  exportDir: string;
}) {
  const exported = clips.filter((c) => c.exportPath);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("Montage");
  const [transition, setTransition] = useState<Transition>("fade");
  const [duration, setDuration] = useState(0.4);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [encoder, setEncoder] = useState<EncoderInfo | null>(null);

  useEffect(() => {
    void detectEncoder().then(setEncoder);
    let un: (() => void) | undefined;
    void onExportProgress(setProgress).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  function toggle(id: string) {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 6) {
        onToast("Montages are limited to 6 clips", true);
        return cur;
      }
      return [...cur, id];
    });
  }

  function move(id: string, dir: -1 | 1) {
    setPicked((cur) => {
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function compile() {
    if (picked.length < 2) {
      onToast("Pick at least two exported clips", true);
      return;
    }
    const ordered = picked
      .map((id) => exported.find((c) => c.id === id))
      .filter((c): c is ClipRecord => Boolean(c?.exportPath));
    if (ordered.length < 2) return;
    setBusy(true);
    setProgress({ percent: 0, time: "", message: "Preparing montage…" });
    try {
      const dir = exportDir || (await defaultExportDir());
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const base = `${sanitizeFilename(title)}-${stamp}`;
      const outputPath = await joinPath(dir, `${base}.mp4`);
      const thumbnailPath = await joinPath(dir, `${base}.jpg`);
      const first = ordered[0];
      const size = OUTPUT_SIZES[first.quality][first.outputFormat];
      await exportMontage({
        clipPaths: ordered.map((c) => c.exportPath!),
        outputPath,
        thumbnailPath,
        transition,
        transitionDuration: duration,
        outputWidth: size.width,
        outputHeight: size.height,
        fps: first.fps,
      });
      onCreated({
        id: uid(),
        title,
        clipIds: ordered.map((c) => c.id),
        transition,
        transitionDuration: duration,
        exportPath: outputPath,
        thumbnailPath,
        createdAt: new Date().toISOString(),
      });
      onToast("Montage exported");
    } catch (e) {
      onToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="montage">
      <div className="montage-list">
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Pick clips</h2>
        <p className="tiny" style={{ marginBottom: 12 }}>
          Only compiled clips can be stitched. {picked.length}/6 selected.
        </p>
        {exported.length === 0 && (
          <p className="tiny">Compile at least two clips in the editor first.</p>
        )}
        {exported.map((clip) => (
          <ClipPick
            key={clip.id}
            clip={clip}
            selected={picked.includes(clip.id)}
            onToggle={() => toggle(clip.id)}
          />
        ))}
      </div>
      <div className="montage-stage">
        <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Montage</h2>
        <label className="stack" style={{ maxWidth: 420 }}>
          Title
          <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="form-grid" style={{ maxWidth: 420, marginTop: 12 }}>
          <label className="stack">
            Transition
            <select
              className="field"
              value={transition}
              onChange={(e) => setTransition(e.target.value as Transition)}
            >
              <option value="cut">Cut</option>
              <option value="fade">Fade</option>
              <option value="swipe">Swipe</option>
              <option value="squeeze">Squeeze</option>
            </select>
          </label>
          <label className="stack">
            Duration (sec)
            <input
              className="field"
              type="number"
              min={0.1}
              max={2}
              step={0.1}
              disabled={transition === "cut"}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="section-title">Order</div>
        {picked.map((id, i) => {
          const clip = exported.find((c) => c.id === id);
          if (!clip) return null;
          return (
            <div key={id} className="slot">
              <strong style={{ width: 18 }}>{i + 1}</strong>
              <div style={{ flex: 1 }}>
                <div>{clip.title}</div>
                <div className="tiny">{clip.outputFormat}</div>
              </div>
              <button className="btn-ghost" onClick={() => move(id, -1)}>
                Up
              </button>
              <button className="btn-ghost" onClick={() => move(id, 1)}>
                Down
              </button>
              <button className="btn-danger" onClick={() => toggle(id)}>
                Remove
              </button>
            </div>
          );
        })}
        {encoder && <p className="tiny">Encoder: {encoder.label}</p>}
        {progress && (
          <>
            <div className="progress">
              <div style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="tiny">{progress.message}</div>
          </>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn-accent"
            disabled={busy || picked.length < 2}
            onClick={() => void compile()}
          >
            {busy ? "Creating…" : "Create montage"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClipPick({
  clip,
  selected,
  onToggle,
}: {
  clip: ClipRecord;
  selected: boolean;
  onToggle: () => void;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (clip.thumbnailPath) void fileSrc(clip.thumbnailPath).then(setSrc);
  }, [clip.thumbnailPath]);
  return (
    <button
      className="slot"
      style={{
        width: "100%",
        textAlign: "left",
        borderColor: selected ? "var(--accent)" : undefined,
      }}
      onClick={onToggle}
    >
      {src ? <img src={src} alt="" /> : <div style={{ width: 48, height: 84 }} />}
      <div>
        <div>{clip.title}</div>
        <div className="tiny">{selected ? "Selected" : "Click to add"}</div>
      </div>
    </button>
  );
}
