import type {
  AppSettings,
  EncoderInfo,
  ExportProgress,
  Fps,
  Layout,
  LibraryState,
  Quality,
} from "../types";
import { BUILTIN_LAYOUTS } from "./layouts";

export interface ExportClipArgs {
  sourcePath: string;
  outputPath: string;
  thumbnailPath: string;
  segments: { start: number; end: number }[];
  outputWidth: number;
  outputHeight: number;
  fps: number;
  blurBackground: boolean;
  layers: {
    input: { x: number; y: number; w: number; h: number };
    output: { x: number; y: number; w: number; h: number };
    visible: boolean;
  }[];
}

export const defaultSettings = (): AppSettings => ({
  quality: "1080p" as Quality,
  fps: 30 as Fps,
  exportDir: "",
});

export interface ExportMontageArgs {
  clipPaths: string[];
  outputPath: string;
  thumbnailPath: string;
  transition: string;
  transitionDuration: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
}

type Unlisten = () => void;

const emptyLibrary = (): LibraryState => ({
  clips: [],
  montages: [],
  layouts: [],
  libraryDir: "",
});

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function tauri() {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return { invoke, listen, convertFileSrc };
}

export async function fileSrc(path: string): Promise<string> {
  if (!path) return "";
  if (!isTauri()) return path;
  const { convertFileSrc } = await tauri();
  return convertFileSrc(path);
}

export async function pickVideo(): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await tauri();
  return invoke<string | null>("pick_video");
}

export async function pickSavePath(
  defaultName: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await tauri();
  return invoke<string | null>("pick_save_path", { defaultName });
}

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await tauri();
  return invoke<string | null>("pick_folder");
}

export async function loadSettings(): Promise<AppSettings> {
  if (!isTauri()) {
    const raw = localStorage.getItem("portrait-clip-settings");
    if (!raw) return defaultSettings();
    try {
      return { ...defaultSettings(), ...(JSON.parse(raw) as AppSettings) };
    } catch {
      return defaultSettings();
    }
  }
  const { invoke } = await tauri();
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem("portrait-clip-settings", JSON.stringify(settings));
    return;
  }
  const { invoke } = await tauri();
  await invoke("save_settings", { settings });
}

export async function loadLibrary(): Promise<LibraryState> {
  if (!isTauri()) {
    const raw = localStorage.getItem("portrait-clip-library");
    if (!raw) return emptyLibrary();
    try {
      return JSON.parse(raw) as LibraryState;
    } catch {
      return emptyLibrary();
    }
  }
  const { invoke } = await tauri();
  return invoke<LibraryState>("load_library");
}

export async function saveLibrary(state: LibraryState): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem("portrait-clip-library", JSON.stringify(state));
    return;
  }
  const { invoke } = await tauri();
  await invoke("save_library", { state });
}

export async function probeVideo(path: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> {
  if (!isTauri()) {
    return { duration: 0, width: 1920, height: 1080, fps: 30 };
  }
  const { invoke } = await tauri();
  return invoke("probe_video", { path });
}

export async function detectEncoder(): Promise<EncoderInfo> {
  if (!isTauri()) return { encoder: "libx264", label: "Software (preview)" };
  const { invoke } = await tauri();
  return invoke("detect_encoder");
}

export async function exportClip(args: ExportClipArgs): Promise<void> {
  const { invoke } = await tauri();
  await invoke("export_clip", { args });
}

export async function exportMontage(args: ExportMontageArgs): Promise<void> {
  const { invoke } = await tauri();
  await invoke("export_montage", { args });
}

export async function cancelExport(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await tauri();
  await invoke("cancel_export");
}

export async function onExportProgress(
  cb: (p: ExportProgress) => void,
): Promise<Unlisten> {
  if (!isTauri()) return () => undefined;
  const { listen } = await tauri();
  const un = await listen<ExportProgress>("export-progress", (e) => cb(e.payload));
  return () => {
    un();
  };
}

export async function openPath(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await tauri();
  await invoke("open_path", { path });
}

export async function revealPath(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await tauri();
  await invoke("reveal_path", { path });
}

export async function defaultExportDir(): Promise<string> {
  if (!isTauri()) return "";
  const { invoke } = await tauri();
  return invoke("default_export_dir");
}

export async function joinPath(...parts: string[]): Promise<string> {
  if (!isTauri()) return parts.join("/");
  const { invoke } = await tauri();
  return invoke("join_path", { parts });
}

export async function fileExists(path: string): Promise<boolean> {
  if (!isTauri()) return true;
  const { invoke } = await tauri();
  return invoke("file_exists", { path });
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function toggleMaximize(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export function mergeLayouts(saved: Layout[]): Layout[] {
  const custom = saved.filter((l) => !l.builtin);
  return [...BUILTIN_LAYOUTS, ...custom];
}

export { isTauri };
