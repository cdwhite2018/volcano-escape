import { TOOL_NAMES, VIEW_HEIGHT, VIEW_WIDTH } from "../config";
import { REGIONS } from "../data/regions";
import { AudioDirector } from "../systems/audio";
import { saveGame } from "../systems/save";
import type { EnemyState, SaveData, ToolId, UISnapshot, WorldObject } from "../types";

type Dialogue = { speaker: string; text: string } | null;
type Prompt = { title: string; text: string; choices: ToolId[]; objectId: string } | null;
type InputState = { x: number; y: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const overlap = (x: number, y: number, radius: number, r: { x: number; y: number; w: number; h: number }) =>
  x + radius > r.x && x - radius < r.x + r.w && y + radius > r.y && y - radius < r.y + r.h;

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private state: SaveData;
  private audio: AudioDirector;
  private onUI: (snapshot: UISnapshot) => void;
  private onGameOver: () => void;
  private running = false;
  private raf = 0;
  private previous = 0;
  private uiClock = 0;
  private input: InputState = { x: 0, y: 0 };
  private keys = new Set<string>();
  private enemies: EnemyState[] = [];
  private particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  private projectiles: { x: number; y: number; vx: number; vy: number; life: number; friendly: boolean }[] = [];
  private dialogue: Dialogue = null;
  private prompt: Prompt = null;
  private paused = false;
  private attackCooldown = 0;
  private invulnerable = 0;
  private stepClock = 0;
  private shake = 0;
  private crystalSequence: string[] = [];
  private lastHint = "";
  private facing = 1;
  private moving = false;
  private visuals: Record<"cast" | "items" | "enemies" | "wreck", HTMLImageElement>;

  constructor(
    canvas: HTMLCanvasElement,
    state: SaveData,
    onUI: (snapshot: UISnapshot) => void,
    onGameOver: () => void,
  ) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is unavailable.");
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.state = state;
    this.audio = new AudioDirector(state.settings);
    this.onUI = onUI;
    this.onGameOver = onGameOver;
    this.visuals = this.loadVisuals();
    this.loadRegion();
    this.emitUI();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.audio.stop();
  }

  getSave() {
    return { ...this.state, solved: { ...this.state.solved }, settings: { ...this.state.settings } };
  }

  setMove(x: number, y: number) { this.input = { x, y }; }
  setPaused(value: boolean) { this.paused = value; this.emitUI(); }
  setTool(tool: ToolId | null) { this.state.selectedTool = tool; this.emitUI(); }
  updateSettings(settings: SaveData["settings"]) {
    this.state.settings = settings;
    this.audio.update(settings);
    this.emitUI();
  }

  key(code: string, down: boolean) {
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (down && !this.paused && !this.dialogue && !this.prompt) {
      const step = 12;
      if (code === "ArrowRight" || code === "KeyD") this.tryMove(step, 0);
      if (code === "ArrowLeft" || code === "KeyA") this.tryMove(-step, 0);
      if (code === "ArrowDown" || code === "KeyS") this.tryMove(0, step);
      if (code === "ArrowUp" || code === "KeyW") this.tryMove(0, -step);
      this.updateExits();
    }
    if (down && (code === "Space" || code === "KeyJ")) this.attack();
    if (down && (code === "KeyE" || code === "Enter")) this.interact();
  }

  attack() {
    if (this.paused || this.dialogue || this.prompt || this.attackCooldown > 0) return;
    this.audio.attack();
    this.attackCooldown = 0.38;
    const closest = this.enemies.filter((e) => e.alive)
      .sort((a, b) => Math.hypot(a.x - this.state.x, a.y - this.state.y) - Math.hypot(b.x - this.state.x, b.y - this.state.y))[0];
    const angle = closest && Math.hypot(closest.x - this.state.x, closest.y - this.state.y) < 250
      ? Math.atan2(closest.y - this.state.y, closest.x - this.state.x)
      : 0;
    const spendRock = this.state.selectedTool === "lavaRock" && this.state.lavaRocks > 0;
    if (spendRock) this.state.lavaRocks--;
    this.projectiles.push({
      x: this.state.x, y: this.state.y,
      vx: Math.cos(angle) * (spendRock ? 430 : 320),
      vy: Math.sin(angle) * (spendRock ? 430 : 320),
      life: spendRock ? 0.9 : 0.32, friendly: true,
    });
    this.emitUI();
  }

  interact() {
    if (this.paused) return;
    if (this.dialogue) { this.dialogue = null; this.emitUI(); return; }
    if (this.prompt) return;
    const object = this.nearestObject();
    if (!object) {
      this.say("Ari", this.lastHint || "Nothing nearby needs attention.");
      return;
    }
    this.audio.interact();
    this.observe(object);
    if (object.kind === "tool") this.pickup(object);
    else if (object.kind === "diamond") this.pickDiamond(object);
    else if (object.kind === "safeZone") this.activateSafeZone();
    else if (object.kind === "puzzle" || (object.kind === "survivor" && object.id === "kai")) this.openPrompt(object);
    else this.say(object.label, object.observation);
  }

  chooseTool(tool: ToolId) {
    if (!this.prompt) return;
    const id = this.prompt.objectId;
    this.prompt = null;
    this.applyTool(id, tool);
  }

  cancelPrompt() { this.prompt = null; this.emitUI(); }

  debugComplete() {
    this.state.tools = ["firstAid", "flashlight", "rope", "multiTool", "flare", "water", "blanket", "carabiners", "battery", "radioPart", "mapFragment", "lavaRock"];
    this.state.diamonds = ["diamondCave", "diamondBridge", "diamondGrotto"];
    ["survivorsChecked", "crashRoute", "cavernRoute", "bridgeSecured", "tubeMazeSolved", "liftPowered", "terraceDoor", "crystalSolved", "guardianResolved", "heatShield"]
      .forEach((flag) => { this.state.solved[flag] = true; });
    this.state.guardianResolution = "peaceful";
    this.emitUI();
  }

  private frame = (time: number) => {
    if (!this.running) return;
    const dt = Math.min(0.034, (time - this.previous) / 1000);
    this.previous = time;
    if (!this.paused && !this.dialogue && !this.prompt) this.update(dt);
    this.render(time / 1000);
    this.uiClock += dt;
    if (this.uiClock > 0.15) { this.uiClock = 0; this.emitUI(); }
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.state.playtime += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shake = Math.max(0, this.shake - dt * 8);
    let mx = this.input.x + (this.keys.has("ArrowRight") || this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0);
    let my = this.input.y + (this.keys.has("ArrowDown") || this.keys.has("KeyS") ? 1 : 0) - (this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0);
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    const speed = 185;
    this.moving = Math.abs(mx) + Math.abs(my) > 0.05;
    if (Math.abs(mx) > 0.05) this.facing = Math.sign(mx);
    if (this.moving) {
      this.tryMove(mx * speed * dt, 0);
      this.tryMove(0, my * speed * dt);
      this.stepClock -= dt;
      if (this.stepClock <= 0) { this.audio.step(); this.stepClock = 0.34; }
    }
    this.updateExits();
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.spawnAtmosphere(dt);
  }

  private tryMove(dx: number, dy: number) {
    const region = REGIONS[this.state.region];
    const nx = clamp(this.state.x + dx, 24, VIEW_WIDTH - 24);
    const ny = clamp(this.state.y + dy, 24, VIEW_HEIGHT - 24);
    const blocked = region.walls.some((wall) => overlap(nx, ny, 14, wall));
    if (!blocked) { this.state.x = nx; this.state.y = ny; }
    if (region.lava.some((lava) => overlap(this.state.x, this.state.y, 10, lava)) && this.invulnerable <= 0) this.hurt(1);
  }

  private updateExits() {
    for (const exit of REGIONS[this.state.region].exits) {
      if (!overlap(this.state.x, this.state.y, 12, exit)) continue;
      if (exit.requires && !this.state.solved[exit.requires]) {
        this.lastHint = exit.note || "The route is blocked.";
        this.state.x = clamp(this.state.x, 42, VIEW_WIDTH - 42);
        this.state.y = clamp(this.state.y, 42, VIEW_HEIGHT - 42);
        if (!this.dialogue) this.say("Route blocked", this.lastHint);
        return;
      }
      this.state.region = exit.to;
      [this.state.x, this.state.y] = exit.spawn;
      if (!this.state.visited.includes(exit.to)) this.state.visited.push(exit.to);
      this.loadRegion();
      this.say(REGIONS[exit.to].name, REGIONS[exit.to].subtitle);
      return;
    }
  }

  private loadRegion() {
    this.enemies = REGIONS[this.state.region].enemies.map((enemy, index) => {
      const id = `${this.state.region}:${index}`;
      const maxHp = enemy.kind === "guardian" ? 12 : enemy.kind === "spitter" ? 4 : 3;
      return { ...enemy, id, hp: maxHp, maxHp, cooldown: 0.5 + index, telegraph: 0, alive: !this.state.solved[`enemy:${id}`], vx: 0, vy: 0 };
    });
    this.projectiles = [];
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive || (enemy.kind === "guardian" && this.state.guardianResolution === "peaceful")) continue;
      const dx = this.state.x - enemy.x, dy = this.state.y - enemy.y, distance = Math.max(1, Math.hypot(dx, dy));
      enemy.cooldown -= dt;
      if (enemy.telegraph > 0) {
        enemy.telegraph -= dt;
        if (enemy.telegraph <= 0) {
          if (enemy.kind === "spitter" || enemy.kind === "guardian") {
            this.projectiles.push({ x: enemy.x, y: enemy.y, vx: dx / distance * 170, vy: dy / distance * 170, life: 3, friendly: false });
          }
          enemy.cooldown = enemy.kind === "guardian" ? 1.1 : 1.7;
        }
        continue;
      }
      if (distance < (enemy.kind === "guardian" ? 300 : 230)) {
        if ((enemy.kind === "spitter" || enemy.kind === "guardian") && enemy.cooldown <= 0) enemy.telegraph = 0.55;
        else if (enemy.kind !== "spitter") {
          const pace = enemy.kind === "guardian" ? 54 : enemy.kind === "stalker" ? 82 : 66;
          enemy.x += dx / distance * pace * dt;
          enemy.y += dy / distance * pace * dt;
        }
        if (distance < 30 && this.invulnerable <= 0) this.hurt(1);
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (const shot of this.projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.friendly) {
        for (const enemy of this.enemies) {
          if (!enemy.alive || Math.hypot(enemy.x - shot.x, enemy.y - shot.y) > 25) continue;
          enemy.hp -= this.state.selectedTool === "lavaRock" ? 3 : 1;
          shot.life = 0;
          this.burst(enemy.x, enemy.y, "#ffd27a");
          if (enemy.hp <= 0) {
            enemy.alive = false;
            this.state.solved[`enemy:${enemy.id}`] = true;
            if (enemy.kind === "guardian") {
              this.state.guardianResolution = "combat";
              this.state.solved.guardianResolved = true;
              this.say("Fire Guardian", "The molten core dims. The ancient giant sinks into a quiet ring of stone.");
            } else if (Math.random() < 0.6) this.state.lavaRocks++;
          }
        }
      } else if (Math.hypot(this.state.x - shot.x, this.state.y - shot.y) < 22 && this.invulnerable <= 0) {
        shot.life = 0; this.hurt(1);
      }
    }
    this.projectiles = this.projectiles.filter((shot) => shot.life > 0 && shot.x > -20 && shot.x < 980 && shot.y > -20 && shot.y < 560);
  }

  private hurt(amount: number) {
    this.state.hp -= amount;
    this.invulnerable = 1.05;
    this.shake = this.state.settings.shake ? 5 : 0;
    this.audio.hurt();
    if (this.state.hp <= 0) {
      this.state.hp = this.state.maxHp;
      this.state.region = this.state.safeZone;
      [this.state.x, this.state.y] = REGIONS[this.state.safeZone].safeSpawn;
      this.loadRegion();
      this.onGameOver();
      this.say("Dr. Lee", "Easy. You made it back to our last shelter. Take a breath—nothing you learned was lost.");
    }
  }

  private nearestObject() {
    return REGIONS[this.state.region].objects
      .filter((object) => !this.state.solved[`collected:${object.id}`])
      .map((object) => ({ object, distance: Math.hypot(object.x - this.state.x, object.y - this.state.y) }))
      .filter(({ distance }) => distance < 72)
      .sort((a, b) => a.distance - b.distance)[0]?.object || null;
  }

  private observe(object: WorldObject) {
    if (object.journal && !this.state.observations.includes(object.journal)) this.state.observations.push(object.journal);
    this.state.solved[`seen:${object.id}`] = true;
    if (object.kind === "survivor") {
      this.state.solved[`checked:${object.id}`] = true;
      const all = ["kai", "lee", "maya", "ben", "guide"].every((id) => this.state.solved[`checked:${id}`]);
      if (all && this.state.solved.kaiTreated) this.state.solved.survivorsChecked = true;
    }
  }

  private pickup(object: WorldObject) {
    if (!object.tool) return;
    if (!this.state.tools.includes(object.tool)) this.state.tools.push(object.tool);
    this.state.selectedTool ||= object.tool;
    this.state.solved[`collected:${object.id}`] = true;
    this.audio.pickup();
    this.say("Equipment found", `${object.label}: ${object.observation}`);
  }

  private pickDiamond(object: WorldObject) {
    if (!this.state.diamonds.includes(object.id)) this.state.diamonds.push(object.id);
    this.state.solved[`collected:${object.id}`] = true;
    this.audio.pickup();
    this.say("Lava diamond recovered", `${object.observation} (${this.state.diamonds.length}/3)`);
  }

  private activateSafeZone() {
    this.state.safeZone = this.state.region;
    this.state.hp = this.state.maxHp;
    this.state.survivorStage = Math.max(this.state.survivorStage, ["crash", "crossroads", "grotto", "station", "rim"].indexOf(this.state.region) + 1);
    saveGame(this.state);
    this.audio.success();
    this.say("Safe zone", "The survivors regroup. Health restored and progress saved.");
  }

  private openPrompt(object: WorldObject) {
    if (object.id.startsWith("crystal")) {
      this.touchCrystal(object.id);
      return;
    }
    const choices = [...this.state.tools];
    if (object.id === "guardianAltar" && this.state.diamonds.length === 3) choices.unshift("lavaRock");
    this.prompt = { title: object.label, text: object.observation, choices, objectId: object.id };
    this.emitUI();
  }

  private applyTool(id: string, tool: ToolId) {
    const has = (flag: string) => this.state.solved[flag];
    const solve = (flag: string, text: string) => {
      this.state.solved[flag] = true; this.audio.success(); this.say("Problem solved", text);
    };
    if (id === "kai" && tool === "firstAid") {
      this.state.solved.kaiTreated = true;
      if (["kai", "lee", "maya", "ben", "guide"].every((person) => this.state.solved[`checked:${person}`])) this.state.solved.survivorsChecked = true;
      solve("kaiTreated", "Dr. Lee secures Kai's arm. Everyone is ready to move.");
    } else if (id === "tailCompartment" && tool === "multiTool") {
      solve("tailOpened", "The bent latch releases. The compartment confirms the essential rescue gear is scattered nearby.");
    } else if (id === "crashDebris" && tool === "multiTool") {
      solve("cableCut", "The cutters bite through the twisted steel cable. The slab still needs to be pulled.");
    } else if (id === "crashDebris" && tool === "rope" && has("cableCut")) {
      solve("crashRoute", "The group hauls the slab aside. The eastern trail is open.");
    } else if (id === "reflectiveMarks" && tool === "flashlight") {
      solve("marksRead", "The marks shine: two chevrons point to the center tunnel and a symbol means rising air.");
    } else if (id === "airflowTest" && tool === "flare" && has("marksRead")) {
      solve("cavernRoute", "Flare smoke climbs through the center tunnel, confirming the safe route.");
    } else if (id === "nearAnchor" && tool === "rope") {
      solve("ropePlaced", "The rope reaches the far eye bolt, but it needs locking hardware.");
    } else if (id === "nearAnchor" && tool === "carabiners" && has("ropePlaced")) {
      solve("bridgeSecured", "The carabiners lock. A secure handline now spans the bridge.");
    } else if (id === "bridgeSignal" && has("bridgeSecured")) {
      solve("bridgeBell", "The bell rings across the chasm. The survivors know the bridge is ready.");
    } else if (id === "tubeGate" && tool === "rope") {
      solve("gateRoped", "The rope takes the stone's weight. The hinge can now be released.");
    } else if (id === "tubeGate" && tool === "multiTool" && has("gateRoped")) {
      solve("tubeMazeSolved", "The hinge releases and the collapsed gate swings clear.");
    } else if (id === "liftPanel" && tool === "battery") {
      solve("liftBattery", "The station battery fits the empty cradle perfectly.");
    } else if (id === "liftPanel" && tool === "multiTool" && has("liftBattery")) {
      solve("liftPowered", "The retaining bolts lock down. The observation lift hums to life.");
    } else if (id === "hotValve" && tool === "water") {
      solve("valveCooled", "Steam flashes outward as the canteen cools the warped valve.");
    } else if (id === "hotValve" && tool === "multiTool" && has("valveCooled")) {
      solve("terraceDoor", "The service latch turns and the grotto passage opens.");
    } else if (id === "guardianAltar" && tool === "lavaRock" && this.state.diamonds.length === 3 && has("seen:guardianNotes")) {
      this.state.guardianResolution = "peaceful";
      this.state.solved.guardianResolved = true;
      this.enemies.forEach((enemy) => { if (enemy.kind === "guardian") enemy.alive = false; });
      solve("guardianResolved", "The three diamonds rise into the altar. The Guardian kneels, its molten core settling into a warm golden glow.");
    } else if (id === "heatPassage" && tool === "blanket") {
      solve("heatShield", "The reflective blanket turns the furnace wind aside long enough for everyone to cross.");
    } else if (id === "rescueRadio" && tool === "radioPart") {
      solve("radioTuned", "The helicopter tuning assembly clicks into the empty cradle.");
    } else if (id === "rescueRadio" && tool === "battery") {
      solve("radioPowered", "The survey battery feeds power into the transmitter.");
    } else if (id === "rescueRadio" && tool === "multiTool" && has("radioTuned") && has("radioPowered")) {
      this.state.ending = this.state.guardianResolution === "peaceful" && this.state.diamonds.length === 3 ? "best" : "standard";
      this.state.solved.rescueCalled = true;
      saveGame(this.state);
      this.audio.success();
      this.say("Rescue signal transmitted", this.state.ending === "best"
        ? "The mountain calms beneath a violet sky. A rescue helicopter answers—and the whole team watches the first stars appear."
        : "A rescue aircraft answers through the static. The survivors cheer as its lights cross the sunset.");
    } else {
      this.audio.denied();
      this.say("That doesn't fit", this.wrongToolHint(id, tool));
    }
  }

  private wrongToolHint(id: string, tool: ToolId) {
    const clues: Record<string, string> = {
      kai: "Kai needs medical care, not equipment work.",
      crashDebris: this.state.solved.cableCut ? "The cable is free; something strong must pull the slab." : "The steel cable must be cut before the slab can move.",
      reflectiveMarks: "The mineral flecks need a focused beam.",
      airflowTest: "A visible trail of smoke could reveal the rising air.",
      nearAnchor: this.state.solved.ropePlaced ? "The line needs locking clips." : "The matching anchors need a line between them.",
      tubeGate: this.state.solved.gateRoped ? "Release the hinge while the rope holds the weight." : "Take the stone's weight before touching the hinge.",
      liftPanel: this.state.solved.liftBattery ? "Secure the loose retaining bolts." : "The empty cradle needs portable power.",
      hotValve: this.state.solved.valveCooled ? "Now release the service latch mechanically." : "Touching that glowing metal is unsafe. Cool it first.",
      guardianAltar: "The altar requires all three lava diamonds and the ritual recorded at the station.",
      heatPassage: "A reflective layer could turn away radiant heat.",
      rescueRadio: "The transmitter needs power, tuning, and finally a careful mechanical connection.",
    };
    return `${TOOL_NAMES[tool]} will not solve this. ${clues[id] || "Examine the nearby clues and try a tool whose purpose matches the problem."}`;
  }

  private touchCrystal(id: string) {
    if (this.state.solved.crystalSolved) { this.say("Crystal seal", "The three notes remain in harmony."); return; }
    this.crystalSequence.push(id);
    const target = ["crystalLow", "crystalFlow", "crystalSky"];
    const valid = this.crystalSequence.every((entry, i) => entry === target[i]);
    if (!valid) {
      this.crystalSequence = [];
      this.audio.denied();
      this.say("Crystal discord", "The notes clash and fade. The station's mineral notes may record the original flow order.");
    } else if (this.crystalSequence.length === 3) {
      this.crystalSequence = [];
      this.state.solved.crystalSolved = true;
      this.audio.success();
      this.say("Crystal harmony", "Low stone, flowing vein, sky spear. The eastern seal dissolves into blue light.");
    } else {
      this.audio.tone(280 + this.crystalSequence.length * 150, 0.24, 0.06, "sine");
      this.say("Crystal tone", `${this.crystalSequence.length} of 3 notes resonate.`);
    }
  }

  private say(speaker: string, text: string) { this.dialogue = { speaker, text }; this.emitUI(); }

  private updateParticles(dt: number) {
    this.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    this.particles = this.particles.filter((p) => p.life > 0);
  }
  private spawnAtmosphere(dt: number) {
    if (Math.random() < dt * (this.state.settings.quality === "high" ? 12 : 5)) {
      const region = REGIONS[this.state.region];
      this.particles.push({ x: Math.random() * 960, y: 550, vx: (Math.random() - .5) * 12, vy: -12 - Math.random() * 24, life: 3 + Math.random() * 3, color: region.ambience === "cave" ? "#7780a0" : "#ff9a4a" });
    }
  }
  private burst(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) this.particles.push({ x, y, vx: (Math.random() - .5) * 130, vy: (Math.random() - .5) * 130, life: .45, color });
  }

  private render(t: number) {
    const ctx = this.ctx, region = REGIONS[this.state.region];
    ctx.save();
    if (this.shake) ctx.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, region.palette[0]); bg.addColorStop(1, region.palette[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 960, 540);
    this.drawTerrain(t);
    this.drawSetPieces(t);
    region.exits.forEach((exit) => this.drawExit(exit, !!exit.requires && !this.state.solved[exit.requires!]));
    region.lava.forEach((lava) => this.drawLava(lava, t));
    region.walls.forEach((wall) => {
      const isWreck = region.id === "crash" && wall.x === 360 && wall.y === 188;
      if (!isWreck) this.drawRock(wall);
    });
    region.objects.filter((object) => !this.state.solved[`collected:${object.id}`]).forEach((object) => this.drawObject(object, t));
    this.enemies.filter((enemy) => enemy.alive).forEach((enemy) => this.drawEnemy(enemy, t));
    this.projectiles.forEach((shot) => { ctx.fillStyle = shot.friendly ? "#ffe394" : "#ff552e"; ctx.fillRect(shot.x - 5, shot.y - 5, 10, 10); });
    this.particles.forEach((p) => { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
    this.drawHero(t);
    this.drawLighting(t);
    ctx.restore();
  }

  private drawTerrain(t: number) {
    const ctx = this.ctx, region = REGIONS[this.state.region];
    const floor = ctx.createLinearGradient(0, 0, 960, 540);
    floor.addColorStop(0, region.palette[1]);
    floor.addColorStop(.55, region.palette[0]);
    floor.addColorStop(1, region.palette[1]);
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, 960, 540);
    for (let y = 24; y < 540; y += 46) for (let x = (y / 46 % 2) * 24; x < 960; x += 52) {
      const n = ((x * 7 + y * 13) % 17);
      ctx.globalAlpha = .12 + n / 115;
      ctx.fillStyle = n % 2 ? region.palette[2] : "#0c0d15";
      ctx.beginPath();
      ctx.moveTo(x, y + 4); ctx.lineTo(x + 20 + n, y); ctx.lineTo(x + 43, y + 8);
      ctx.lineTo(x + 31, y + 12); ctx.lineTo(x + 8, y + 11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#090910";
      ctx.beginPath(); ctx.moveTo(x + 9, y + 12); ctx.lineTo(x + 15, y + 19); ctx.lineTo(x + 12, y + 27); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,205,130,.035)";
    for (let i = 0; i < 14; i++) {
      const x = (i * 173 + 47) % 960, y = (i * 89 + 61) % 540;
      ctx.beginPath(); ctx.ellipse(x, y, 28 + i % 4 * 7, 6 + i % 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (region.ambience === "crystal") {
      ctx.fillStyle = `rgba(90,235,238,${.09 + Math.sin(t * 2) * .025})`; ctx.fillRect(0, 0, 960, 540);
    }
  }

  private drawSetPieces(t: number) {
    const ctx = this.ctx;
    if (this.state.region === "crash" && this.imageReady(this.visuals.wreck)) {
      ctx.save();
      ctx.globalAlpha = .98;
      ctx.drawImage(this.visuals.wreck, 320, 144, 344, 194);
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const spark = .35 + Math.sin(t * 9 + i * 2.4) * .3;
        ctx.fillStyle = `rgba(255,190,80,${spark})`;
        ctx.fillRect(448 + i * 29, 215 - i * 5, 3, 3);
      }
    }
  }

  private drawRock(r: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx, p = REGIONS[this.state.region].palette;
    ctx.fillStyle = "#0d0c13";
    ctx.beginPath(); ctx.roundRect(r.x + 6, r.y + 8, r.w, r.h, 7); ctx.fill();
    ctx.fillStyle = p[2];
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 7); ctx.fill();
    ctx.fillStyle = p[1];
    ctx.beginPath(); ctx.roundRect(r.x + 7, r.y + 9, r.w - 14, r.h - 17, 5); ctx.fill();
    ctx.fillStyle = "rgba(255,215,160,.1)";
    ctx.fillRect(r.x + 11, r.y + 9, Math.max(10, r.w * .45), 3);
    ctx.strokeStyle = "rgba(10,8,14,.62)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w * .22, r.y + 9); ctx.lineTo(r.x + r.w * .31, r.y + r.h * .42);
    ctx.lineTo(r.x + r.w * .26, r.y + r.h * .65); ctx.stroke();
    ctx.fillStyle = "rgba(255,120,55,.13)"; ctx.fillRect(r.x + 8, r.y + r.h - 11, r.w - 16, 4);
  }

  private drawLava(r: { x: number; y: number; w: number; h: number }, t: number) {
    const ctx = this.ctx;
    const pulse = .5 + Math.sin(t * 1.8) * .08;
    ctx.fillStyle = "#4b1518"; ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    const molten = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    molten.addColorStop(0, "#8e251c"); molten.addColorStop(pulse, "#f04d1f"); molten.addColorStop(1, "#ff8a29");
    ctx.fillStyle = molten; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#ffd157";
    for (let y = r.y + 14; y < r.y + r.h - 8; y += 23) {
      const wave = Math.sin(t * 2 + y * .05) * 7;
      ctx.beginPath();
      ctx.roundRect(r.x + 10 + ((y * 7) % Math.max(16, r.w - 42)) + wave, y, 24, 4, 2);
      ctx.fill();
    }
    ctx.fillStyle = "#36191b";
    for (let i = 0; i < Math.max(1, Math.floor(r.w * r.h / 10000)); i++) {
      const x = r.x + 10 + ((i * 71 + r.y) % Math.max(16, r.w - 35));
      const y = r.y + 12 + ((i * 47 + r.x) % Math.max(12, r.h - 30));
      ctx.beginPath(); ctx.ellipse(x, y, 12 + i % 3 * 4, 5, Math.sin(i) * .4, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawExit(exit: { x: number; y: number; w: number; h: number }, blocked: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = blocked ? "#4b3034" : "#f7b65a"; ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = blocked ? "#251d24" : "#32202a"; ctx.fillRect(exit.x + 6, exit.y + 6, Math.max(2, exit.w - 12), Math.max(2, exit.h - 12));
  }

  private drawObject(object: WorldObject, t: number) {
    const ctx = this.ctx;
    const colors = { tool: "#ffd46b", clue: "#9fc7dc", puzzle: "#f09b52", survivor: "#6ed6c8", diamond: "#77f4ff", safeZone: "#77d88c", journal: "#e7d7a0" };
    const pulse = Math.sin(t * 3 + object.x) * 2;
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.beginPath(); ctx.ellipse(object.x, object.y + 13, object.kind === "survivor" ? 18 : 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (object.kind === "survivor" && this.imageReady(this.visuals.cast)) {
      const castIndex: Record<string, number> = { kai: 1, maya: 2, lee: 3, ben: 4, guide: 5 };
      this.drawAtlas(this.visuals.cast, castIndex[object.id] ?? 0, 0, 6, 1, object.x - 23, object.y - 51 + pulse, 46, 62);
    } else if (object.kind === "tool" && object.tool && this.imageReady(this.visuals.items)) {
      const tools: ToolId[] = ["firstAid", "flashlight", "rope", "multiTool", "flare", "water", "blanket", "carabiners", "battery", "radioPart", "mapFragment", "lavaRock"];
      const index = tools.indexOf(object.tool);
      this.drawAtlas(this.visuals.items, index % 4, Math.floor(index / 4), 4, 3, object.x - 20, object.y - 25 + pulse, 40, 40);
    } else if (object.kind === "diamond") {
      ctx.save(); ctx.translate(object.x, object.y - 5 + pulse);
      ctx.shadowColor = "#64f5ff"; ctx.shadowBlur = 18;
      ctx.fillStyle = "#afffff"; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(12, -4); ctx.lineTo(5, 17); ctx.lineTo(-8, 13); ctx.lineTo(-13, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#5baedb"; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(4, 10); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (object.kind === "safeZone") {
      ctx.fillStyle = "#25322e"; ctx.beginPath(); ctx.moveTo(object.x - 22, object.y + 11); ctx.lineTo(object.x, object.y - 22 + pulse); ctx.lineTo(object.x + 24, object.y + 11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#7fe2b3"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#ffd278"; ctx.fillRect(object.x - 3, object.y - 3 + pulse, 6, 13);
    } else {
      ctx.fillStyle = colors[object.kind];
      ctx.beginPath(); ctx.roundRect(object.x - 12, object.y - 17 + pulse, 24, 27, 3); ctx.fill();
      ctx.strokeStyle = "#fff2c9"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(object.x - 5, object.y - 8 + pulse); ctx.lineTo(object.x + 6, object.y - 8 + pulse);
      ctx.moveTo(object.x - 5, object.y - 2 + pulse); ctx.lineTo(object.x + 4, object.y - 2 + pulse); ctx.stroke();
    }
    if (Math.hypot(object.x - this.state.x, object.y - this.state.y) < 72) {
      ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
      const width = ctx.measureText(object.label).width + 16;
      ctx.fillStyle = "rgba(12,12,20,.88)"; ctx.fillRect(object.x - width / 2, object.y - 36, width, 21);
      ctx.fillStyle = "#fff3d0"; ctx.fillText(object.label, object.x, object.y - 21);
    }
  }

  private drawEnemy(enemy: EnemyState, t: number) {
    const ctx = this.ctx, guardian = enemy.kind === "guardian";
    const size = guardian ? 54 : 26, bob = Math.sin(t * (guardian ? 2 : 5) + enemy.x) * 2;
    const glow = enemy.telegraph > 0 ? .42 : .18;
    ctx.fillStyle = `rgba(255,79,22,${glow})`;
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, size * 1.15, 0, Math.PI * 2); ctx.fill();
    if (this.imageReady(this.visuals.enemies)) {
      const index = { crawler: 0, spitter: 1, stalker: 2, guardian: 3 }[enemy.kind];
      const w = guardian ? 112 : enemy.kind === "stalker" ? 62 : 58;
      const h = guardian ? 116 : enemy.kind === "crawler" ? 47 : 60;
      this.drawAtlas(this.visuals.enemies, index, 0, 4, 1, enemy.x - w / 2, enemy.y - h * .7 + bob, w, h);
    }
    if (guardian || enemy.hp < enemy.maxHp) {
      ctx.fillStyle = "#160f15"; ctx.fillRect(enemy.x - 28, enemy.y - size / 2 - 13, 56, 6);
      ctx.fillStyle = "#ff6e32"; ctx.fillRect(enemy.x - 27, enemy.y - size / 2 - 12, 54 * enemy.hp / enemy.maxHp, 4);
    }
  }

  private drawHero(t: number) {
    const ctx = this.ctx;
    if (this.invulnerable > 0 && Math.floor(t * 12) % 2) return;
    const bob = this.moving ? Math.abs(Math.sin(t * 11)) * 3 : Math.sin(t * 2.4) * .7;
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(this.state.x, this.state.y + 14, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (this.imageReady(this.visuals.cast)) {
      ctx.save();
      ctx.translate(this.state.x, this.state.y);
      ctx.scale(this.facing, 1);
      this.drawAtlas(this.visuals.cast, 0, 0, 6, 1, -24, -51 - bob, 48, 65);
      ctx.restore();
    } else {
      ctx.fillStyle = "#4ad0bd"; ctx.fillRect(this.state.x - 10, this.state.y - 12 - bob, 20, 26);
      ctx.fillStyle = "#f3bb87"; ctx.fillRect(this.state.x - 6, this.state.y - 23 - bob, 12, 10);
    }
  }

  private drawLighting(t: number) {
    const ctx = this.ctx, region = REGIONS[this.state.region];
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    region.lava.forEach((lava) => {
      const x = lava.x + lava.w / 2, y = lava.y + lava.h / 2;
      const radius = Math.max(lava.w, lava.h) * 1.15;
      const glow = ctx.createRadialGradient(x, y, 4, x, y, radius);
      glow.addColorStop(0, `rgba(255,115,35,${.16 + Math.sin(t * 2 + x) * .025})`);
      glow.addColorStop(1, "rgba(255,80,25,0)");
      ctx.fillStyle = glow; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });
    ctx.restore();
    if (region.ambience === "cave") {
      const gradient = ctx.createRadialGradient(this.state.x, this.state.y, 45, this.state.x, this.state.y, this.state.tools.includes("flashlight") ? 260 : 150);
      gradient.addColorStop(0, "rgba(0,0,0,0)"); gradient.addColorStop(1, "rgba(5,6,18,.72)");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 540);
    }
    const pulse = .025 + Math.sin(t * 2.2) * .012;
    ctx.fillStyle = `rgba(255,91,31,${pulse})`; ctx.fillRect(0, 0, 960, 540);
  }

  private loadVisuals() {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const image = (path: string) => {
      const asset = new Image();
      asset.decoding = "async";
      asset.src = `${base}${path}`;
      return asset;
    };
    return {
      cast: image("/assets/sprites/cast-v2.png"),
      items: image("/assets/sprites/items-v2.png"),
      enemies: image("/assets/sprites/enemies-v2.png"),
      wreck: image("/assets/sprites/wreck-v2.png"),
    };
  }

  private imageReady(image: HTMLImageElement) {
    return image.complete && image.naturalWidth > 0;
  }

  private drawAtlas(
    image: HTMLImageElement,
    column: number,
    row: number,
    columns: number,
    rows: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const sourceWidth = image.naturalWidth / columns;
    const sourceHeight = image.naturalHeight / rows;
    this.ctx.drawImage(
      image,
      Math.floor(column * sourceWidth),
      Math.floor(row * sourceHeight),
      Math.ceil(sourceWidth),
      Math.ceil(sourceHeight),
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height),
    );
  }

  private emitUI() {
    const region = REGIONS[this.state.region];
    this.onUI({
      mode: this.paused ? "paused" : this.state.ending !== "none" ? "ending" : this.dialogue ? "dialogue" : "playing",
      regionName: region.name, objective: region.objective, hp: this.state.hp, maxHp: this.state.maxHp,
      selectedTool: this.state.selectedTool, tools: [...this.state.tools], lavaRocks: this.state.lavaRocks,
      diamonds: this.state.diamonds.length, dialogue: this.dialogue,
      prompt: this.prompt ? { title: this.prompt.title, text: this.prompt.text, choices: this.prompt.choices } : null,
      observations: [...this.state.observations], visited: [...this.state.visited], safeZone: this.state.safeZone,
      playtime: this.state.playtime, ending: this.state.ending, guardianResolution: this.state.guardianResolution,
      settings: { ...this.state.settings },
    });
  }
}
