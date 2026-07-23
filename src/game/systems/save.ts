import { DEFAULT_SETTINGS, SAVE_KEY, SAVE_SLOTS } from "../config";
import type { GameSettings, SaveData } from "../types";

export function newSave(slot = 0, heroName = "Ari"): SaveData {
  return {
    schema: 2, slot, heroName, region: "crash", safeZone: "crash", x: 120, y: 274,
    hp: 6, maxHp: 6, tools: [], selectedTool: null, lavaRocks: 3, diamonds: [],
    solved: {}, observations: [], visited: ["crash"], survivorStage: 0, playtime: 0,
    guardianResolution: "none", ending: "none", settings: { ...DEFAULT_SETTINGS },
    updatedAt: Date.now(),
  };
}

function storageKey(slot: number) {
  return `${SAVE_KEY}:${slot}`;
}

export function loadSave(slot: number): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.schema !== 2 || !parsed.region) return null;
    const fresh = newSave(slot, parsed.heroName || "Ari");
    return {
      ...fresh,
      ...parsed,
      slot,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } as GameSettings,
      solved: parsed.solved || {},
      tools: parsed.tools || [],
      observations: parsed.observations || [],
      visited: parsed.visited || ["crash"],
      diamonds: parsed.diamonds || [],
    };
  } catch {
    return null;
  }
}

export function saveGame(data: SaveData) {
  if (typeof window === "undefined") return;
  const copy = { ...data, updatedAt: Date.now() };
  localStorage.setItem(storageKey(data.slot), JSON.stringify(copy));
}

export function listSaves() {
  return Array.from({ length: SAVE_SLOTS }, (_, slot) => loadSave(slot));
}

export function deleteSave(slot: number) {
  if (typeof window !== "undefined") localStorage.removeItem(storageKey(slot));
}
