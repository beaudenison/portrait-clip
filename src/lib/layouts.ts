import type { Layer, Layout, OutputFormat, RectNorm } from "../types";
import { LAYER_COLORS } from "../types";
import { pixelAspectOf, snapRectToAspect, uid } from "./geometry";

const CAMERA_ASPECT = 16 / 9;
const SOURCE_ASPECT = 16 / 9;

const FORMAT_ASPECT: Record<OutputFormat, number> = {
  portrait: 9 / 16,
  square: 1,
  landscape: 16 / 9,
};

function layer(
  name: string,
  color: string,
  aspect: number,
  input: RectNorm,
  output: RectNorm,
  extra: Partial<Layer> = {},
): Omit<Layer, "id"> {
  return {
    name,
    color,
    aspect,
    input,
    output,
    locked: false,
    lockAspect: true,
    visible: true,
    ...extra,
  };
}

/** Normalized rect of `pixelAspect` inside a frame of `frameAspect` (width / height). */
function placed(
  pixelAspect: number,
  frameAspect: number,
  w: number,
  x: number,
  y: number,
): RectNorm {
  const h = (w * frameAspect) / pixelAspect;
  return { x, y, w, h };
}

function portraitSplit(): Layout["layers"] {
  const frame = FORMAT_ASPECT.portrait;
  const cameraH = frame / CAMERA_ASPECT;
  const contentH = 1 - cameraH;
  const contentAspect = frame / contentH;
  const contentInW = contentAspect / SOURCE_ASPECT;
  return [
    layer(
      "Camera",
      LAYER_COLORS[1],
      CAMERA_ASPECT,
      { x: 0, y: 0, w: 0.32, h: 0.32 },
      { x: 0, y: 0, w: 1, h: cameraH },
    ),
    layer(
      "Content",
      LAYER_COLORS[0],
      contentAspect,
      { x: (1 - contentInW) / 2, y: 0, w: contentInW, h: 1 },
      { x: 0, y: cameraH, w: 1, h: contentH },
    ),
  ];
}

function portraitCrop(): Layout["layers"] {
  const aspect = FORMAT_ASPECT.portrait;
  const w = aspect / SOURCE_ASPECT;
  return [
    layer(
      "Content",
      LAYER_COLORS[0],
      aspect,
      { x: (1 - w) / 2, y: 0, w, h: 1 },
      { x: 0, y: 0, w: 1, h: 1 },
    ),
  ];
}

function fullBlur(): Layout["layers"] {
  const frame = FORMAT_ASPECT.portrait;
  const contentOut = placed(CAMERA_ASPECT, frame, 0.92, 0.04, 0.08);
  const cameraOut = placed(CAMERA_ASPECT, frame, 0.5, 0.25, contentOut.y + contentOut.h + 0.06);
  return [
    layer(
      "Content",
      LAYER_COLORS[0],
      CAMERA_ASPECT,
      { x: 0, y: 0, w: 1, h: 1 },
      contentOut,
    ),
    layer(
      "Camera",
      LAYER_COLORS[1],
      CAMERA_ASPECT,
      { x: 0.66, y: 0.02, w: 0.32, h: 0.32 },
      cameraOut,
    ),
  ];
}

export const BUILTIN_LAYOUTS: Layout[] = [
  {
    id: "portrait-split",
    name: "Portrait Split",
    builtin: true,
    outputFormat: "portrait",
    blurBackground: false,
    layers: portraitSplit(),
  },
  {
    id: "portrait-crop",
    name: "Portrait Crop",
    builtin: true,
    outputFormat: "portrait",
    blurBackground: false,
    layers: portraitCrop(),
  },
  {
    id: "full-blur",
    name: "Full Blur",
    builtin: true,
    outputFormat: "portrait",
    blurBackground: true,
    layers: fullBlur(),
  },
];

export function instantiateLayout(layout: Layout): {
  outputFormat: OutputFormat;
  blurBackground: boolean;
  layers: Layer[];
} {
  return {
    outputFormat: layout.outputFormat,
    blurBackground: layout.blurBackground,
    layers: layout.layers.map((l) => ({ ...l, id: uid() })),
  };
}

export function captureLayout(
  name: string,
  outputFormat: OutputFormat,
  blurBackground: boolean,
  layers: Layer[],
): Layout {
  return {
    id: uid(),
    name,
    builtin: false,
    outputFormat,
    blurBackground,
    layers: layers.map(({ id: _id, ...rest }) => rest),
  };
}

export function defaultProjectLayers(): Layer[] {
  return instantiateLayout(BUILTIN_LAYOUTS[0]).layers;
}

export function resolveAspect(layer: Layer, outW: number, outH: number): number {
  if (typeof layer.aspect === "number" && layer.aspect > 0.05 && layer.aspect < 20) {
    return layer.aspect;
  }
  if (layer.name.trim().toLowerCase() === "camera") return CAMERA_ASPECT;
  const fromOutput = pixelAspectOf(layer.output, outW, outH);
  if (fromOutput > 0.05 && fromOutput < 20) return fromOutput;
  return CAMERA_ASPECT;
}

/** Snap every layer so its input crop and output box share one pixel aspect. */
export function snapLayers(
  layers: Layer[],
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
): Layer[] {
  return layers.map((layer) => {
    if (layer.lockAspect === false) return layer;
    const aspect = resolveAspect(layer, outW, outH);
    return {
      ...layer,
      aspect,
      lockAspect: true,
      input: snapRectToAspect(layer.input, srcW, srcH, aspect),
      output: snapRectToAspect(layer.output, outW, outH, aspect),
    };
  });
}

function rectClose(a: RectNorm, b: RectNorm): boolean {
  return (
    Math.abs(a.x - b.x) < 1e-4 &&
    Math.abs(a.y - b.y) < 1e-4 &&
    Math.abs(a.w - b.w) < 1e-4 &&
    Math.abs(a.h - b.h) < 1e-4
  );
}

export function layerListClose(a: Layer[], b: Layer[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((layer, i) => {
    const other = b[i];
    return (
      layer.id === other.id &&
      Math.abs((layer.aspect ?? 0) - (other.aspect ?? 0)) < 1e-4 &&
      layer.lockAspect === other.lockAspect &&
      rectClose(layer.input, other.input) &&
      rectClose(layer.output, other.output)
    );
  });
}
