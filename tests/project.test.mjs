import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const regions = readFileSync(new URL("../src/game/data/regions.ts", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/game/engine/GameEngine.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

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
