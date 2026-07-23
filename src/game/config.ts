import type { GameSettings, ToolId } from "./types";

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const SAVE_KEY = "volcanoEscapeHostedSaveV2";
export const SAVE_SLOTS = 3;

export const DEFAULT_SETTINGS: GameSettings = {
  music: 0.45,
  effects: 0.72,
  shake: true,
  quality: "high",
  controlScale: 1,
  controlOpacity: 0.78,
  dialogueSpeed: "normal",
  hints: true,
};

export const TOOL_NAMES: Record<ToolId, string> = {
  firstAid: "First-aid kit",
  flashlight: "Flashlight",
  rope: "Climbing rope",
  multiTool: "Multi-tool",
  flare: "Emergency flare",
  water: "Water canteen",
  blanket: "Heat blanket",
  carabiners: "Carabiners",
  battery: "Portable battery",
  radioPart: "Radio component",
  mapFragment: "Survey map",
  lavaRock: "Lava-rock burst",
};

export const TOOL_DESCRIPTIONS: Record<ToolId, string> = {
  firstAid: "Medical supplies for stabilizing injuries and restoring health.",
  flashlight: "A focused beam that reveals markings, reflective minerals, and eyes in darkness.",
  rope: "Strong rescue line for crossing, climbing, lowering, and pulling.",
  multiTool: "Pliers, driver, cutter, and wrench for damaged equipment.",
  flare: "Bright, hot light that reveals airflow and repels some creatures.",
  water: "Drinking water that can also cool dangerously hot metal.",
  blanket: "Reflective emergency fabric that shields against intense heat.",
  carabiners: "Locking clips for creating safe rope systems.",
  battery: "A rugged aviation battery with enough charge for machinery.",
  radioPart: "The intact tuning assembly from the helicopter radio.",
  mapFragment: "A weathered map of the survey tunnels and upper terraces.",
  lavaRock: "Spend one lava rock to launch a short-range heat burst.",
};
