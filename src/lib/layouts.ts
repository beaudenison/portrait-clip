import type { Layout, Layer, OutputFormat } from "../types";
import { LAYER_COLORS } from "../types";
import { uid } from "./geometry";

function layer(
  name: string,
  color: string,
  input: Layer["input"],
  output: Layer["output"],
  extra: Partial<Layer> = {},
): Omit<Layer, "id"> {
  return {
    name,
    color,
    input,
    output,
    locked: false,
    lockAspect: false,
    visible: true,
    ...extra,
  };
}

export const BUILTIN_LAYOUTS: Layout[] = [
  {
    id: "portrait-split",
    name: "Portrait Split",
    builtin: true,
    outputFormat: "portrait",
    blurBackground: false,
    layers: [
      layer(
        "Content",
        LAYER_COLORS[0],
        { x: 0.18, y: 0.0, w: 0.64, h: 1.0 },
        { x: 0, y: 0, w: 1, h: 0.62 },
      ),
      layer(
        "Camera",
        LAYER_COLORS[1],
        { x: 0.72, y: 0.02, w: 0.26, h: 0.36 },
        { x: 0, y: 0.62, w: 1, h: 0.38 },
      ),
    ],
  },
  {
    id: "portrait-crop",
    name: "Portrait Crop",
    builtin: true,
    outputFormat: "portrait",
    blurBackground: false,
    layers: [
      layer(
        "Content",
        LAYER_COLORS[0],
        { x: 0.22, y: 0.0, w: 0.56, h: 1.0 },
        { x: 0, y: 0, w: 1, h: 1 },
      ),
    ],
  },
  {
    id: "full-blur",
    name: "Full Blur",
    builtin: true,
    outputFormat: "portrait",
    blurBackground: true,
    layers: [
      layer(
        "Content",
        LAYER_COLORS[0],
        { x: 0.12, y: 0.08, w: 0.76, h: 0.84 },
        { x: 0.06, y: 0.18, w: 0.88, h: 0.5 },
      ),
      layer(
        "Camera",
        LAYER_COLORS[1],
        { x: 0.72, y: 0.02, w: 0.26, h: 0.36 },
        { x: 0.28, y: 0.72, w: 0.44, h: 0.22 },
      ),
    ],
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
