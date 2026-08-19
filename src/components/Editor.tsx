import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ClipRecord,
  EncoderInfo,
  ExportProgress,
  Fps,
  Layer,
  Layout,
  OutputFormat,
  Project,
  Quality,
  RectNorm,
} from "../types";
import { LAYER_COLORS, OUTPUT_SIZES } from "../types";
import { sanitizeFilename, uid } from "../lib/geometry";
import { captureLayout, instantiateLayout } from "../lib/layouts";
import {
  clipAtSource,
  fullClip,
  migrateClips,
  removeClip,
  splitAtSource,
  trimClip,
} from "../lib/timeline";
import {
  defaultExportDir,
  detectEncoder,
  exportClip,
  joinPath,
  onExportProgress,
} from "../lib/backend";
import InputPreview from "./InputPreview";
import OutputCanvas from "./OutputCanvas";
import Timeline from "./Timeline";
import CompileModal from "./CompileModal";

export default function Editor({
  project,
  layouts,
  onChange,
  onSaveLayout,
  onDeleteLayout,
  onExported,
  onToast,
  exportDir,
}: {
  project: Project;
  layouts: Layout[];
  onChange: (p: Project) => void;
  onSaveLayout: (l: Layout) => void;
  onDeleteLayout: (id: string) => void;
  onExported: (clip: ClipRecord, exportPath: string, thumb: string) => void;
  onToast: (msg: string, error?: boolean) => void;
  exportDir: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const segments = useMemo(
    () =>
      migrateClips(
        project.duration,
        project.clips,
        project.trimStart,
        project.trimEnd,
      ),
    [project.duration, project.clips, project.trimStart, project.trimEnd],
  );
  const [current, setCurrent] = useState(segments[0]?.start ?? 0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    segments[0]?.id ?? null,
  );
  const [showCompile, setShowCompile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encoder, setEncoder] = useState<EncoderInfo | null>(null);
  const [layoutName, setLayoutName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    project.layers[0]?.id ?? null,
  );

  useEffect(() => {
    setVideoEl(videoRef.current);
  }, [project.srcUrl]);

  useEffect(() => {
    void detectEncoder().then(setEncoder);
  }, []);

  useEffect(() => {
    let un: (() => void) | undefined;
    void onExportProgress(setProgress).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      setCurrent(t);
      const host = clipAtSource(segments, t);
      if (host) setSelectedClipId(host.id);
      if (!host) {
        const next = segments.find((c) => c.start >= t - 0.001);
        if (next) {
          v.currentTime = next.start;
          setCurrent(next.start);
          setSelectedClipId(next.id);
        } else {
          v.pause();
          setPlaying(false);
          const last = segments[segments.length - 1];
          if (last) {
            v.currentTime = last.end - 0.04;
            setCurrent(last.end - 0.04);
          }
        }
        return;
      }
      if (t >= host.end - 0.02) {
        const i = segments.findIndex((c) => c.id === host.id);
        const next = segments[i + 1];
        if (next) {
          v.currentTime = next.start;
          setCurrent(next.start);
          setSelectedClipId(next.id);
        } else {
          v.pause();
          setPlaying(false);
        }
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", () => setPlaying(false));
    return () => {
      v.removeEventListener("timeupdate", onTime);
    };
  }, [playing, segments]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        doSplit();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        doDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function patch(partial: Partial<Project>) {
    onChange({ ...project, ...partial, updatedAt: new Date().toISOString() });
  }

  function updateLayer(id: string, partial: Partial<Layer>) {
    patch({
      layers: project.layers.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  }

  function setRect(which: "input" | "output") {
    return (id: string, rect: RectNorm) => updateLayer(id, { [which]: rect });
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const host = clipAtSource(segments, v.currentTime);
      if (!host) {
        const start = segments[0]?.start ?? 0;
        v.currentTime = start;
        setCurrent(start);
      }
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function addLayer() {
    if (project.layers.length >= 6) {
      onToast("Maximum of 6 layers", true);
      return;
    }
    const n = project.layers.length;
    const layer: Layer = {
      id: uid(),
      name: `Layer ${n + 1}`,
      color: LAYER_COLORS[n % LAYER_COLORS.length],
      input: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      output: { x: 0.15, y: 0.15, w: 0.7, h: 0.4 },
      locked: false,
      lockAspect: false,
      visible: true,
    };
    patch({ layers: [...project.layers, layer] });
    setSelectedId(layer.id);
  }

  function removeLayer(id: string) {
    if (project.layers.length <= 1) return;
    const next = project.layers.filter((l) => l.id !== id);
    patch({ layers: next });
    setSelectedId(next[0]?.id ?? null);
  }

  function doSplit() {
    const next = splitAtSource(segments, current);
    if (next === segments) return;
    patch({ clips: next });
    const hit = clipAtSource(next, current);
    if (hit) setSelectedClipId(hit.id);
  }

  function doDelete() {
    if (!selectedClipId) return;
    const next = removeClip(segments, selectedClipId);
    if (next === segments) {
      onToast("Keep at least one clip", true);
      return;
    }
    patch({ clips: next });
    setSelectedClipId(next[0]?.id ?? null);
    const v = videoRef.current;
    if (v && next[0]) {
      v.currentTime = next[0].start;
      setCurrent(next[0].start);
    }
  }

  function applyLayout(layout: Layout) {
    const inst = instantiateLayout(layout);
    patch({
      outputFormat: inst.outputFormat,
      blurBackground: inst.blurBackground,
      layers: inst.layers,
    });
    setSelectedId(inst.layers[0]?.id ?? null);
  }

  async function startExport() {
    setError(null);
    setBusy(true);
    setProgress({ percent: 0, time: "", message: "Preparing…" });
    try {
      const dir = exportDir || (await defaultExportDir());
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const base = `${sanitizeFilename(project.title)}-${stamp}`;
      const outputPath = await joinPath(dir, `${base}.mp4`);
      const thumbnailPath = await joinPath(dir, `${base}.jpg`);
      const size = OUTPUT_SIZES[project.quality][project.outputFormat];
      await exportClip({
        sourcePath: project.sourcePath,
        outputPath,
        thumbnailPath,
        segments: segments.map((c) => ({ start: c.start, end: c.end })),
        outputWidth: size.width,
        outputHeight: size.height,
        fps: project.fps,
        blurBackground: project.blurBackground,
        layers: project.layers.map((l) => ({
          input: l.input,
          output: l.output,
          visible: l.visible,
        })),
      });
      onExported(project, outputPath, thumbnailPath);
      setProgress({ percent: 100, time: "", message: "Done" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedLayer = project.layers.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="editor">
      <aside className="side">
        <div className="section-title">Output</div>
        <label className="stack">
          Format
          <select
            className="field"
            value={project.outputFormat}
            onChange={(e) => patch({ outputFormat: e.target.value as OutputFormat })}
          >
            <option value="portrait">Portrait 9:16</option>
            <option value="square">Square 1:1</option>
            <option value="landscape">Landscape 16:9</option>
          </select>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={project.blurBackground}
            onChange={(e) => patch({ blurBackground: e.target.checked })}
          />
          Blur background
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={project.showBorders}
            onChange={(e) => patch({ showBorders: e.target.checked })}
          />
          Show input borders
        </label>

        <div className="section-title">Layers</div>
        {project.layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer${layer.id === selectedId ? " selected" : ""}`}
            onClick={() => setSelectedId(layer.id)}
          >
            <div className="layer-top">
              <span className="swatch" style={{ background: layer.color }} />
              <input
                className="layer-name"
                value={layer.name}
                onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
              />
              <button
                className="icon-btn"
                title="Visibility"
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(layer.id, { visible: !layer.visible });
                }}
              >
                {layer.visible ? "◉" : "○"}
              </button>
              <button
                className="icon-btn"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(layer.id);
                }}
              >
                ✕
              </button>
            </div>
            {selectedLayer?.id === layer.id && (
              <div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={layer.locked}
                    onChange={(e) => updateLayer(layer.id, { locked: e.target.checked })}
                  />
                  Lock position
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={layer.lockAspect}
                    onChange={(e) =>
                      updateLayer(layer.id, { lockAspect: e.target.checked })
                    }
                  />
                  Lock aspect ratio
                </label>
              </div>
            )}
          </div>
        ))}
        <button className="btn" style={{ width: "100%" }} onClick={addLayer}>
          Add layer
        </button>

        <div className="section-title">Layouts</div>
        <div className="layout-list">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              className="layout-item"
              onClick={() => applyLayout(layout)}
            >
              {layout.name}
              <small>
                {layout.outputFormat} · {layout.layers.length} layer
                {layout.layers.length === 1 ? "" : "s"}
                {layout.builtin ? "" : " · custom"}
              </small>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="title-input"
            placeholder="Layout name"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => {
              const name = layoutName.trim() || "My layout";
              onSaveLayout(
                captureLayout(
                  name,
                  project.outputFormat,
                  project.blurBackground,
                  project.layers,
                ),
              );
              setLayoutName("");
              onToast("Layout saved");
            }}
          >
            Save
          </button>
        </div>
        {layouts.some((l) => !l.builtin) && (
          <button
            className="btn-ghost"
            style={{ width: "100%", marginTop: 6 }}
            onClick={() => {
              const custom = [...layouts].reverse().find((l) => !l.builtin);
              if (custom) onDeleteLayout(custom.id);
            }}
          >
            Delete last custom layout
          </button>
        )}
      </aside>

      <div className="editor-top">
        <input
          className="title-input"
          value={project.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <select
          className="field"
          style={{ width: 110 }}
          value={project.quality}
          onChange={(e) => patch({ quality: e.target.value as Quality })}
        >
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>
        <select
          className="field"
          style={{ width: 100 }}
          value={project.fps}
          onChange={(e) => patch({ fps: Number(e.target.value) as Fps })}
        >
          <option value={30}>30 fps</option>
          <option value={60}>60 fps</option>
        </select>
        <button className="btn-accent" onClick={() => setShowCompile(true)}>
          Compile
        </button>
      </div>

      <div className="stage">
        <section className="preview-pane">
          <header>
            <span>Input</span>
            <span>{project.sourceWidth}×{project.sourceHeight}</span>
          </header>
          <InputPreview
            src={project.srcUrl}
            videoRef={videoRef}
            layers={project.layers}
            selectedId={selectedId}
            showBorders={project.showBorders}
            onSelect={setSelectedId}
            onChange={setRect("input")}
            onMeta={(m) => {
              if (!project.duration) {
                patch({
                  duration: m.duration,
                  sourceWidth: m.width,
                  sourceHeight: m.height,
                  clips:
                    project.clips?.length
                      ? project.clips
                      : fullClip(m.duration),
                });
              }
            }}
          />
        </section>
        <section className="preview-pane">
          <header>
            <span>Output</span>
            <span>{project.outputFormat}</span>
          </header>
          <OutputCanvas
            video={videoEl}
            format={project.outputFormat}
            blur={project.blurBackground}
            layers={project.layers}
            selectedId={selectedId}
            showBorders={project.showBorders}
            onSelect={setSelectedId}
            onChange={setRect("output")}
          />
        </section>
      </div>

      <Timeline
        clips={segments}
        selectedId={selectedClipId}
        currentSource={current}
        playing={playing}
        muted={muted}
        onSeekSource={(t) => {
          const v = videoRef.current;
          if (v) v.currentTime = t;
          setCurrent(t);
          const host = clipAtSource(segments, t);
          if (host) setSelectedClipId(host.id);
        }}
        onSelect={setSelectedClipId}
        onTrim={(id, start, end) =>
          patch({ clips: trimClip(segments, id, start, end, project.duration || 1) })
        }
        onSplit={doSplit}
        onDelete={doDelete}
        onTogglePlay={togglePlay}
        onToggleMute={() => {
          const v = videoRef.current;
          if (v) v.muted = !v.muted;
          setMuted((m) => {
            if (videoRef.current) videoRef.current.muted = !m;
            return !m;
          });
        }}
      />

      {showCompile && (
        <CompileModal
          title={project.title}
          quality={project.quality}
          fps={project.fps}
          encoder={encoder}
          busy={busy}
          progress={progress}
          error={error}
          onTitle={(t) => patch({ title: t })}
          onQuality={(q) => patch({ quality: q })}
          onFps={(f) => patch({ fps: f })}
          onStart={() => void startExport()}
          onClose={() => {
            if (!busy) {
              setShowCompile(false);
              setProgress(null);
              setError(null);
            }
          }}
        />
      )}
    </div>
  );
}
