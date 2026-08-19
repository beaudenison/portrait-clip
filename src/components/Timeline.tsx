import { useRef } from "react";
import type { TimelineClip } from "../types";
import { formatTime } from "../lib/geometry";
import { sourceToTimeline, timelineToSource, totalDuration } from "../lib/timeline";

export default function Timeline({
  clips,
  selectedId,
  currentSource,
  playing,
  muted,
  onSeekSource,
  onSelect,
  onTrim,
  onSplit,
  onDelete,
  onTogglePlay,
  onToggleMute,
}: {
  clips: TimelineClip[];
  selectedId: string | null;
  currentSource: number;
  playing: boolean;
  muted: boolean;
  onSeekSource: (t: number) => void;
  onSelect: (id: string) => void;
  onTrim: (id: string, start: number, end: number) => void;
  onSplit: () => void;
  onDelete: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const total = Math.max(totalDuration(clips), 0.001);
  const play = (sourceToTimeline(clips, currentSource) / total) * 100;
  const canDelete = clips.length > 1;

  function timeFromClientX(clientX: number): number {
    const rail = railRef.current;
    if (!rail) return 0;
    const r = rail.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return timelineToSource(clips, x * total);
  }

  return (
    <div className="timeline">
      <div className="time-row">
        <button className="btn" onClick={onTogglePlay}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="btn-ghost" onClick={onToggleMute}>
          {muted ? "Unmute" : "Mute"}
        </button>
        <button className="btn" onClick={onSplit} title="Split at playhead (S)">
          Split
        </button>
        <button className="btn-danger" onClick={onDelete} disabled={!canDelete}>
          Delete clip
        </button>
        <span className="clock">
          {formatTime(sourceToTimeline(clips, currentSource))} / {formatTime(total)}
        </span>
        <div
          ref={railRef}
          className="rail packed"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest(".clip-block")) return;
            onSeekSource(timeFromClientX(e.clientX));
          }}
        >
          {clips.map((clip) => {
            const width = ((clip.end - clip.start) / total) * 100;
            const selected = clip.id === selectedId;
            return (
              <div
                key={clip.id}
                className={`clip-block${selected ? " selected" : ""}`}
                style={{ width: `${width}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(clip.id);
                  const t = timeFromClientX(e.clientX);
                  onSeekSource(t);
                }}
              >
                {selected && (
                  <>
                    <div
                      className="clip-edge left"
                      onPointerDown={(e) => startTrim(e, clip, "start", clips, onTrim)}
                    />
                    <div
                      className="clip-edge right"
                      onPointerDown={(e) => startTrim(e, clip, "end", clips, onTrim)}
                    />
                  </>
                )}
              </div>
            );
          })}
          <div className="playhead" style={{ left: `${play}%` }} />
        </div>
      </div>
    </div>
  );
}

function startTrim(
  e: React.PointerEvent,
  clip: TimelineClip,
  edge: "start" | "end",
  clips: TimelineClip[],
  onTrim: (id: string, start: number, end: number) => void,
) {
  e.stopPropagation();
  e.preventDefault();
  const rail = (e.currentTarget as HTMLElement).closest(".rail") as HTMLElement | null;
  if (!rail) return;
  const total = Math.max(totalDuration(clips), 0.001);
  const startX = e.clientX;
  const orig = { ...clip };

  const move = (ev: PointerEvent) => {
    const r = rail.getBoundingClientRect();
    const dx = ((ev.clientX - startX) / r.width) * total;
    if (edge === "start") {
      onTrim(clip.id, orig.start + dx, orig.end);
    } else {
      onTrim(clip.id, orig.start, orig.end + dx);
    }
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
