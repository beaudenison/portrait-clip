import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coverCrop,
  pixelAspectOf,
  resizeAspectRect,
  snapRectToAspect,
} from "../src/lib/geometry";
import {
  BUILTIN_LAYOUTS,
  layerListClose,
  snapLayers,
} from "../src/lib/layouts";
import type { Layer } from "../src/types";

const SRC_W = 1920;
const SRC_H = 1080;
const OUT_W = 1080;
const OUT_H = 1920;

function close(actual: number, expected: number, eps = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`,
  );
}

test("portrait split keeps one pixel aspect and fills the frame", () => {
  const split = BUILTIN_LAYOUTS.find((l) => l.id === "portrait-split");
  assert.ok(split);
  const [camera, content] = split.layers;
  assert.equal(camera.aspect, 16 / 9);
  close(pixelAspectOf(camera.input, SRC_W, SRC_H), 16 / 9);
  close(pixelAspectOf(camera.output, OUT_W, OUT_H), 16 / 9);
  assert.equal(camera.output.w, 1);
  assert.equal(camera.output.y, 0);
  assert.equal(content.output.w, 1);
  assert.equal(content.output.x, 0);
  close(content.output.h + camera.output.h, 1);
  close(content.output.y, camera.output.h);
  close(pixelAspectOf(content.input, SRC_W, SRC_H), content.aspect ?? 0);
  close(pixelAspectOf(content.output, OUT_W, OUT_H), content.aspect ?? 0);
  assert.ok((content.aspect ?? 0) < 1, "content region is taller than it is wide");
});

test("portrait crop input is a 9:16 window", () => {
  const crop = BUILTIN_LAYOUTS.find((l) => l.id === "portrait-crop");
  assert.ok(crop);
  const content = crop.layers[0];
  assert.equal(content.aspect, 9 / 16);
  assert.deepEqual(content.output, { x: 0, y: 0, w: 1, h: 1 });
  close(pixelAspectOf(content.input, SRC_W, SRC_H), 9 / 16);
});

test("full blur layers stay 16:9", () => {
  const blur = BUILTIN_LAYOUTS.find((l) => l.id === "full-blur");
  assert.ok(blur);
  for (const layer of blur.layers) {
    assert.equal(layer.aspect, 16 / 9);
    close(pixelAspectOf(layer.input, SRC_W, SRC_H), 16 / 9);
    close(pixelAspectOf(layer.output, OUT_W, OUT_H), 16 / 9);
    assert.ok(layer.output.y + layer.output.h <= 1 + 1e-6);
  }
});

test("resizing the input zoom keeps the aspect and a move keeps the size", () => {
  const start = { x: 0.66, y: 0.02, w: 0.32, h: 0.32 };
  const zoomed = resizeAspectRect(start, "se", -0.08, -0.05, SRC_W, SRC_H, 16 / 9);
  close(pixelAspectOf(zoomed, SRC_W, SRC_H), 16 / 9, 1e-4);
  assert.ok(zoomed.w < start.w);
  assert.equal(zoomed.x, start.x);
  assert.equal(zoomed.y, start.y);

  const moved = resizeAspectRect(start, "body", -0.1, 0.05, SRC_W, SRC_H, 16 / 9);
  assert.equal(moved.w, start.w);
  assert.equal(moved.h, start.h);
  close(moved.x, 0.56);
  close(moved.y, 0.07);
});

test("output resize on a portrait frame stays 16:9", () => {
  const start = { x: 0, y: 175 / 256, w: 1, h: 81 / 256 };
  const next = resizeAspectRect(start, "n", 0, 0.05, OUT_W, OUT_H, 16 / 9);
  close(pixelAspectOf(next, OUT_W, OUT_H), 16 / 9, 1e-4);
  assert.ok(next.h < start.h);
});

test("an old stretched camera snaps once and then stays put", () => {
  const old: Layer = {
    id: "cam",
    name: "Camera",
    color: "#3dd68c",
    input: { x: 0.72, y: 0.02, w: 0.26, h: 0.36 },
    output: { x: 0, y: 0.62, w: 1, h: 0.38 },
    locked: false,
    lockAspect: true,
    visible: true,
  };
  const once = snapLayers([old], SRC_W, SRC_H, OUT_W, OUT_H);
  const twice = snapLayers(once, SRC_W, SRC_H, OUT_W, OUT_H);
  assert.equal(once[0].aspect, 16 / 9);
  close(pixelAspectOf(once[0].input, SRC_W, SRC_H), 16 / 9, 1e-4);
  close(pixelAspectOf(once[0].output, OUT_W, OUT_H), 16 / 9, 1e-4);
  assert.equal(layerListClose(once, twice), true);
});

test("content keeps its output shape and the input crop matches it", () => {
  const old: Layer = {
    id: "content",
    name: "Content",
    color: "#4ea1ff",
    input: { x: 0.18, y: 0, w: 0.64, h: 1 },
    output: { x: 0, y: 0, w: 1, h: 0.62 },
    locked: false,
    lockAspect: true,
    visible: true,
  };
  const [snapped] = snapLayers([old], SRC_W, SRC_H, OUT_W, OUT_H);
  assert.deepEqual(snapped.output, old.output);
  close(pixelAspectOf(snapped.input, SRC_W, SRC_H), snapped.aspect ?? 0, 1e-4);
  close(pixelAspectOf(snapped.output, OUT_W, OUT_H), snapped.aspect ?? 0, 1e-4);
  const again = snapLayers([snapped], SRC_W, SRC_H, OUT_W, OUT_H);
  assert.equal(layerListClose([snapped], again), true);
});

test("cover crop trims the wide axis instead of stretching", () => {
  const wide = coverCrop(0, 0, 160, 90, 90, 160);
  assert.ok(wide.sw < 160);
  close(wide.sw / wide.sh, 90 / 160, 1e-6);
  const match = coverCrop(10, 20, 32, 18, 160, 90);
  assert.deepEqual(match, { sx: 10, sy: 20, sw: 32, sh: 18 });
});

test("an unlocked layer is not snapped", () => {
  const old: Layer = {
    id: "cam",
    name: "Camera",
    color: "#3dd68c",
    input: { x: 0.72, y: 0.02, w: 0.26, h: 0.36 },
    output: { x: 0, y: 0.62, w: 1, h: 0.38 },
    locked: false,
    lockAspect: false,
    visible: true,
  };
  const [same] = snapLayers([old], SRC_W, SRC_H, OUT_W, OUT_H);
  assert.equal(same, old);
});

test("snapRectToAspect is stable", () => {
  const once = snapRectToAspect({ x: 0.72, y: 0.02, w: 0.26, h: 0.36 }, SRC_W, SRC_H, 16 / 9);
  const twice = snapRectToAspect(once, SRC_W, SRC_H, 16 / 9);
  assert.deepEqual(twice, once);
});
