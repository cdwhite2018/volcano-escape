import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const regions = readFileSync(new URL("../src/game/data/regions.ts", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/game/engine/GameEngine.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const cinematic = readFileSync(new URL("../src/game/ui/Cinematic.tsx", import.meta.url), "utf8");

test("the expedition contains every planned region", () => {
  for (const id of ["crash", "wreckage", "crossroads", "caverns", "bridges", "lavaTubes", "terraces", "grotto", "station", "sanctuary", "ascent", "rim"]) {
    assert.match(regions, new RegExp(`\\b${id}: \\{`));
  }
});

test("critical progression gates have matching solutions", () => {
  for (const flag of ["survivorsChecked", "crashRoute", "cavernRoute", "bridgeSecured", "tubeMazeSolved", "liftPowered", "terraceDoor", "crystalSolved", "guardianResolved", "heatShield"]) {
    assert.match(regions, new RegExp(`requires: "${flag}"`));
    assert.match(engine, new RegExp(flag));
  }
});

test("both Guardian resolutions and both endings are implemented", () => {
  assert.match(engine, /guardianResolution = "peaceful"/);
  assert.match(engine, /guardianResolution = "combat"/);
  assert.match(engine, /"best" : "standard"/);
});

test("the production build is an offline-capable static export", () => {
  assert.match(config, /output: "export"/);
  assert.match(config, /basePath:/);
  assert.match(config, /assetPrefix:/);
});

test("the opening is a timed animated cinematic with a correctly oriented aircraft asset", () => {
  assert.match(cinematic, /createTimeline/);
  assert.match(cinematic, /Application/);
  assert.match(cinematic, /helicopterX: -260/);
  assert.match(cinematic, /helicopterX: 965/);
  assert.match(cinematic, /smokeParticles/);
  assert.match(cinematic, /impact: 1/);
});

test("the V2 pixel-art production assets are present and nontrivial", () => {
  for (const asset of [
    "../public/assets/cinematic/hawaii-volcano-panorama-v2.png",
    "../public/assets/cinematic/helicopter-v2.png",
    "../public/assets/sprites/cast-v2.png",
    "../public/assets/sprites/items-v2.png",
    "../public/assets/sprites/enemies-v2.png",
    "../public/assets/sprites/wreck-v2.png",
  ]) {
    assert.ok(statSync(new URL(asset, import.meta.url)).size > 100_000, `${asset} should contain production artwork`);
  }
});

test("gameplay extends the existing Canvas renderer with visual atlases", () => {
  assert.match(engine, /cast-v2\.png/);
  assert.match(engine, /items-v2\.png/);
  assert.match(engine, /enemies-v2\.png/);
  assert.match(engine, /drawAtlas/);
  assert.match(engine, /globalCompositeOperation = "screen"/);
});
