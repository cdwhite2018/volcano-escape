export type RegionId =
  | "crash"
  | "wreckage"
  | "crossroads"
  | "caverns"
  | "bridges"
  | "lavaTubes"
  | "terraces"
  | "grotto"
  | "station"
  | "sanctuary"
  | "ascent"
  | "rim";

export type ToolId =
  | "firstAid"
  | "flashlight"
  | "rope"
  | "multiTool"
  | "flare"
  | "water"
  | "blanket"
  | "carabiners"
  | "battery"
  | "radioPart"
  | "mapFragment"
  | "lavaRock";

export type EnemyKind = "crawler" | "spitter" | "stalker" | "guardian";
export type GameMode = "title" | "intro" | "playing" | "dialogue" | "paused" | "gameover" | "ending";

export type Rect = { x: number; y: number; w: number; h: number };
export type Exit = Rect & { to: RegionId; spawn: [number, number]; requires?: string; note?: string };
export type WorldObject = {
  id: string;
  kind: "tool" | "clue" | "puzzle" | "survivor" | "diamond" | "safeZone" | "journal";
  x: number;
  y: number;
  label: string;
  tool?: ToolId;
  requires?: string;
  observation: string;
  journal?: string;
};

export type EnemySpawn = { kind: EnemyKind; x: number; y: number };
export type Region = {
  id: RegionId;
  name: string;
  subtitle: string;
  palette: [string, string, string, string];
  objective: string;
  exits: Exit[];
  walls: Rect[];
  lava: Rect[];
  objects: WorldObject[];
  enemies: EnemySpawn[];
  safeSpawn: [number, number];
  ambience: "crash" | "cave" | "lava" | "crystal" | "guardian";
};

export type EnemyState = EnemySpawn & {
  id: string;
  hp: number;
  maxHp: number;
  cooldown: number;
  telegraph: number;
  alive: boolean;
  vx: number;
  vy: number;
};

export type Projectile = { x: number; y: number; vx: number; vy: number; friendly: boolean; life: number };

export type SaveData = {
  schema: 2;
  slot: number;
  heroName: string;
  region: RegionId;
  safeZone: RegionId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tools: ToolId[];
  selectedTool: ToolId | null;
  lavaRocks: number;
  diamonds: string[];
  solved: Record<string, boolean>;
  observations: string[];
  visited: RegionId[];
  survivorStage: number;
  playtime: number;
  guardianResolution: "none" | "combat" | "peaceful";
  ending: "none" | "standard" | "best";
  settings: GameSettings;
  updatedAt: number;
};

export type GameSettings = {
  music: number;
  effects: number;
  shake: boolean;
  quality: "low" | "high";
  controlScale: number;
  controlOpacity: number;
  dialogueSpeed: "slow" | "normal" | "fast";
  hints: boolean;
};

export type UISnapshot = {
  mode: GameMode;
  regionName: string;
  objective: string;
  hp: number;
  maxHp: number;
  selectedTool: ToolId | null;
  tools: ToolId[];
  lavaRocks: number;
  diamonds: number;
  dialogue: { speaker: string; text: string } | null;
  prompt: { title: string; text: string; choices: ToolId[] } | null;
  observations: string[];
  visited: RegionId[];
  safeZone: RegionId;
  playtime: number;
  ending: "none" | "standard" | "best";
  guardianResolution: "none" | "combat" | "peaceful";
  settings: GameSettings;
};
