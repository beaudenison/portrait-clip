import { useEffect, useState } from "react";
import type { ClipRecord, MontageRecord, OutputFormat } from "../types";
import { formatTime } from "../lib/geometry";
import { fileSrc, openPath, revealPath } from "../lib/backend";
import { migrateClips, totalDuration } from "../lib/timeline";

export default function Library({
  clips,
  montages,
  onNew,
  onOpen,
  onDelete,
  onMontage,
}: {
  clips: ClipRecord[];
  montages: MontageRecord[];
  onNew: (path?: string) => void;
  onOpen: (clip: ClipRecord) => void;
  onDelete: (id: string) => void;
  onMontage: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const items = [
    ...clips.map((c) => ({ kind: "clip" as const, rec: c, at: c.createdAt })),
    ...montages.map((m) => ({ kind: "montage" as const, rec: m, at: m.createdAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="library">
      <div className="library-head">
        <div>
          <h1>My Clips</h1>
          <p>Upload a clip · MP4, MOV, MKV, WEBM, or AVI</p>
        </div>
        <div className="row">
          <button className="btn" onClick={onMontage} disabled={clips.filter((c) => c.exportPath).length < 2}>
            New montage
          </button>
          <button className="btn-accent" onClick={() => onNew()}>
            Upload a clip
          </button>
        </div>
      </div>
      <div
        className="clip-grid"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files[0];
          const path = (file as File & { path?: string }).path;
          if (path) onNew(path);
        }}
      >
        {items.length === 0 && (
          <div className={`empty${drag ? " dragover" : ""}`}>
            <h2>Upload a clip</h2>
            <p>MP4, MOV, MKV, WEBM, or AVI</p>
            <button className="btn-accent" onClick={() => onNew()}>
              Upload a clip
            </button>
          </div>
        )}
        {items.map((item) =>
          item.kind === "clip" ? (
            <ClipCard
              key={item.rec.id}
              clip={item.rec}
              onOpen={() => onOpen(item.rec)}
              onDelete={() => onDelete(item.rec.id)}
            />
          ) : (
            <MontageCard key={item.rec.id} montage={item.rec} />
          ),
        )}
      </div>
    </div>
  );
}

function ratioClass(format: OutputFormat): string {
  if (format === "landscape") return "landscape";
  if (format === "square") return "square";
  return "";
}

function ClipCard({
  clip,
  onOpen,
  onDelete,
}: {
  clip: ClipRecord;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [src, setSrc] = useState<string>("");
  useThumb(clip.thumbnailPath || clip.sourcePath, setSrc);

  return (
    <article className="clip-card">
      <button className={`thumb ${ratioClass(clip.outputFormat)}`} onClick={onOpen}>
        {src ? <img src={src} alt="" /> : <div />}
        <span className="badge">
          {formatTime(
            totalDuration(
              migrateClips(clip.duration, clip.clips, clip.trimStart, clip.trimEnd),
            ),
          )}
        </span>
      </button>
      <div className="card-body">
        <h3>{clip.title}</h3>
        <div className="meta">
          {clip.outputFormat} · {clip.quality} · {clip.fps}fps
          {clip.exportPath ? " · exported" : ""}
        </div>
        <div className="card-actions">
          <button className="btn" onClick={onOpen}>
            Edit
          </button>
          {clip.exportPath && (
            <button className="btn-ghost" onClick={() => void openPath(clip.exportPath!)}>
              Play
            </button>
          )}
          {clip.exportPath && (
            <button className="btn-ghost" onClick={() => void revealPath(clip.exportPath!)}>
              Folder
            </button>
          )}
          <button className="btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function MontageCard({ montage }: { montage: MontageRecord }) {
  const [src, setSrc] = useState("");
  useThumb(montage.thumbnailPath, setSrc);
  return (
    <article className="clip-card">
      <div className="thumb">
        {src ? <img src={src} alt="" /> : <div />}
        <span className="badge">montage</span>
      </div>
      <div className="card-body">
        <h3>{montage.title}</h3>
        <div className="meta">
          {montage.clipIds.length} clips · {montage.transition}
        </div>
        <div className="card-actions">
          {montage.exportPath && (
            <button className="btn" onClick={() => void openPath(montage.exportPath!)}>
              Play
            </button>
          )}
          {montage.exportPath && (
            <button className="btn-ghost" onClick={() => void revealPath(montage.exportPath!)}>
              Folder
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function useThumb(path: string | undefined, setSrc: (s: string) => void) {
  useEffect(() => {
    if (!path) return;
    void fileSrc(path).then(setSrc);
  }, [path, setSrc]);
}
