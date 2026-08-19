import { useCallback, useEffect, useState } from "react";
import type {
  AppSettings,
  ClipRecord,
  Layout,
  LibraryState,
  MontageRecord,
  Project,
  View,
} from "./types";
import { uid } from "./lib/geometry";
import { defaultProjectLayers } from "./lib/layouts";
import { fullClip, migrateClips } from "./lib/timeline";
import {
  defaultSettings,
  fileExists,
  fileSrc,
  isTauri,
  loadLibrary,
  loadSettings,
  mergeLayouts,
  pickVideo,
  probeVideo,
  saveLibrary,
  saveSettings,
} from "./lib/backend";
import TitleBar from "./components/TitleBar";
import Library from "./components/Library";
import Editor from "./components/Editor";
import Montage from "./components/Montage";
import SettingsPanel from "./components/SettingsPanel";

export default function App() {
  const [view, setView] = useState<View>("library");
  const [library, setLibrary] = useState<LibraryState>({
    clips: [],
    montages: [],
    layouts: [],
    libraryDir: "",
  });
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(
    null,
  );

  const layouts = mergeLayouts(library.layouts);

  const persist = useCallback(async (next: LibraryState) => {
    setLibrary(next);
    try {
      await saveLibrary(next);
    } catch (e) {
      showToast(String(e), true);
    }
  }, []);

  useEffect(() => {
    void loadLibrary().then(setLibrary).catch((e) => showToast(String(e), true));
    void loadSettings()
      .then((s) => setSettings({ ...defaultSettings(), ...s }))
      .catch(() => undefined);
  }, []);

  function showToast(msg: string, error = false) {
    setToast({ msg, error });
    window.setTimeout(() => setToast(null), 4200);
  }

  async function updateSettings(next: AppSettings) {
    setSettings(next);
    try {
      await saveSettings(next);
    } catch (e) {
      showToast(String(e), true);
    }
  }

  async function openPathAsProject(path: string, existing?: ClipRecord) {
    const exists = await fileExists(path);
    if (!exists) {
      showToast("That video is missing from disk.", true);
      return;
    }
    const srcUrl = await fileSrc(path);
    let duration = existing?.duration ?? 0;
    let width = existing?.sourceWidth ?? 1920;
    let height = existing?.sourceHeight ?? 1080;
    try {
      const meta = await probeVideo(path);
      duration = meta.duration || duration;
      width = meta.width || width;
      height = meta.height || height;
    } catch {
      /* video element will fill in */
    }
    const now = new Date().toISOString();
    const clip: Project = existing
      ? {
          ...existing,
          sourcePath: path,
          srcUrl,
          duration: duration || existing.duration,
          sourceWidth: width,
          sourceHeight: height,
          showBorders: existing.showBorders ?? true,
          clips: migrateClips(
            duration || existing.duration,
            existing.clips,
            existing.trimStart,
            existing.trimEnd,
          ),
        }
      : {
          id: uid(),
          title: fileTitle(path),
          sourcePath: path,
          srcUrl,
          createdAt: now,
          updatedAt: now,
          duration,
          sourceWidth: width,
          sourceHeight: height,
          outputFormat: "portrait",
          quality: settings.quality,
          fps: settings.fps,
          clips: fullClip(duration || 0),
          blurBackground: false,
          showBorders: true,
          layers: defaultProjectLayers(),
        };
    setProject(clip);
    setView("editor");
    const clips = existing
      ? library.clips.map((c) => (c.id === clip.id ? stripSrc(clip) : c))
      : [stripSrc(clip), ...library.clips];
    void persist({ ...library, clips });
  }

  async function newClip(droppedPath?: string) {
    const path = droppedPath || (await pickVideo());
    if (!path) {
      if (!isTauri()) {
        showToast("Open this app with the Portrait Clip installer to import files.");
      }
      return;
    }
    await openPathAsProject(path);
  }

  function saveProject(next: Project) {
    setProject(next);
    const clips = library.clips.some((c) => c.id === next.id)
      ? library.clips.map((c) => (c.id === next.id ? stripSrc(next) : c))
      : [stripSrc(next), ...library.clips];
    void persist({ ...library, clips });
  }

  function openClip(clip: ClipRecord) {
    void openPathAsProject(clip.sourcePath, clip);
  }

  function deleteClip(id: string) {
    if (project?.id === id) {
      setProject(null);
      setView("library");
    }
    void persist({
      ...library,
      clips: library.clips.filter((c) => c.id !== id),
    });
  }

  return (
    <div className="app">
      <TitleBar
        view={view}
        onView={setView}
        canEditor={Boolean(project)}
        canMontage={library.clips.some((c) => c.exportPath)}
        onSettings={() => setShowSettings(true)}
      />
      <div className="body">
        {view === "library" && (
          <Library
            clips={library.clips}
            montages={library.montages}
            onNew={(p) => void newClip(p)}
            onOpen={openClip}
            onDelete={deleteClip}
            onMontage={() => setView("montage")}
          />
        )}
        {view === "editor" && project && (
          <Editor
            project={project}
            layouts={layouts}
            exportDir={settings.exportDir}
            onChange={saveProject}
            onSaveLayout={(layout: Layout) =>
              void persist({ ...library, layouts: [...library.layouts, layout] })
            }
            onDeleteLayout={(id) =>
              void persist({
                ...library,
                layouts: library.layouts.filter((l) => l.id !== id),
              })
            }
            onExported={(clip, exportPath, thumbnailPath) => {
              const updated = { ...clip, exportPath, thumbnailPath };
              setProject({ ...project, exportPath, thumbnailPath });
              void persist({
                ...library,
                clips: library.clips.map((c) =>
                  c.id === updated.id ? stripSrc({ ...project, ...updated }) : c,
                ),
              });
              showToast("Clip compiled");
            }}
            onToast={showToast}
          />
        )}
        {view === "montage" && (
          <Montage
            clips={library.clips}
            exportDir={settings.exportDir}
            onCreated={(m: MontageRecord) => {
              void persist({ ...library, montages: [m, ...library.montages] });
              setView("library");
            }}
            onToast={showToast}
          />
        )}
      </div>
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={(s) => void updateSettings(s)}
          onClose={() => setShowSettings(false)}
        />
      )}
      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`}>{toast.msg}</div>
      )}
    </div>
  );
}

function stripSrc(p: Project): ClipRecord {
  const { srcUrl: _srcUrl, ...rest } = p;
  return rest;
}

function fileTitle(path: string): string {
  const name = path.split(/[/\\]/).pop() || "Clip";
  return name.replace(/\.[^.]+$/, "") || "Clip";
}
