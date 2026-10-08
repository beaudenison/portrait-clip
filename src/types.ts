export type OutputFormat = "portrait" | "square" | "landscape";
export type Quality = "720p" | "1080p";
export type Fps = 30 | 60;
export type View = "library" | "editor" | "montage";
export type Transition = "cut" | "fade" | "swipe" | "squeeze";

export interface TimelineClip {
  id: string;
  start: number;
  end: number;
}

export interface AppSettings {
  quality: Quality;
  fps: Fps;
  exportDir: string;
}

export interface RectNorm {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  input: RectNorm;
  output: RectNorm;
  /** Pixel width / height shared by the input crop and the output box. */
  aspect?: number;
  locked: boolean;
  /** @deprecated always locked; kept so older saves still load */
  lockAspect: boolean;
  visible: boolean;
}

export interface Layout {
  id: string;
  name: string;
  builtin: boolean;
  outputFormat: OutputFormat;
  blurBackground: boolean;
  layers: Omit<Layer, "id">[];
}

export interface ClipRecord {
  id: string;
  title: string;
  sourcePath: string;
  exportPath?: string;
  thumbnailPath?: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  sourceWidth: number;
  sourceHeight: number;
  outputFormat: OutputFormat;
  quality: Quality;
  fps: Fps;
  clips: TimelineClip[];
  /** @deprecated migrated into clips */
  trimStart?: number;
  /** @deprecated migrated into clips */
  trimEnd?: number;
  blurBackground: boolean;
  showBorders: boolean;
  layers: Layer[];
}

export interface MontageRecord {
  id: string;
  title: string;
  clipIds: string[];
  transition: Transition;
  transitionDuration: number;
  exportPath?: string;
  thumbnailPath?: string;
  createdAt: string;
}

export interface LibraryState {
  clips: ClipRecord[];
  montages: MontageRecord[];
  layouts: Layout[];
  libraryDir: string;
}

export interface Project extends ClipRecord {
  srcUrl: string;
}

export interface ExportProgress {
  percent: number;
  time: string;
  message: string;
}

export interface EncoderInfo {
  encoder: string;
  label: string;
}

export const OUTPUT_SIZES: Record<
  Quality,
  Record<OutputFormat, { width: number; height: number }>
> = {
  "720p": {
    portrait: { width: 720, height: 1280 },
    square: { width: 720, height: 720 },
    landscape: { width: 1280, height: 720 },
  },
  "1080p": {
    portrait: { width: 1080, height: 1920 },
    square: { width: 1080, height: 1080 },
    landscape: { width: 1920, height: 1080 },
  },
};

export const LAYER_COLORS = [
  "#4ea1ff",
  "#3dd68c",
  "#ff7ab8",
  "#f0c75e",
  "#c084fc",
  "#fb923c",
];
