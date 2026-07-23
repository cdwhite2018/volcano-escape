"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SETTINGS, SAVE_SLOTS, TOOL_DESCRIPTIONS, TOOL_NAMES } from "../src/game/config";
import { REGION_ORDER, REGIONS } from "../src/game/data/regions";
import { GameEngine } from "../src/game/engine/GameEngine";
import { deleteSave, listSaves, newSave, saveGame } from "../src/game/systems/save";
import type { GameSettings, SaveData, UISnapshot } from "../src/game/types";
import Cinematic from "../src/game/ui/Cinematic";
import TouchControls from "../src/game/ui/TouchControls";

const EMPTY_UI: UISnapshot = {
  mode: "title", regionName: "", objective: "", hp: 6, maxHp: 6, selectedTool: null, tools: [],
  lavaRocks: 0, diamonds: 0, dialogue: null, prompt: null, observations: [], visited: ["crash"],
  safeZone: "crash", playtime: 0, ending: "none", guardianResolution: "none", settings: DEFAULT_SETTINGS,
};

export default function Game() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const [screen, setScreen] = useState<"title" | "slots" | "intro" | "game">("title");
  const [pendingSave, setPendingSave] = useState<SaveData | null>(null);
  const [ui, setUI] = useState<UISnapshot>(EMPTY_UI);
  const [panel, setPanel] = useState<"none" | "journal" | "map" | "inventory" | "settings">("none");
  const [saves, setSaves] = useState(() => Array<SaveData | null>(SAVE_SLOTS).fill(null));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSaves(listSaves()));
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/sw.js`);
    }
    return () => cancelAnimationFrame(frame);
  }, []);
  const begin = useCallback((save: SaveData, showIntro: boolean) => {
    setPendingSave(save); setScreen(showIntro ? "intro" : "game");
  }, []);
  const startGame = useCallback(() => setScreen("game"), []);

  useEffect(() => {
    if (screen !== "game" || !canvas.current || !pendingSave) return;
    const instance = new GameEngine(canvas.current, pendingSave, setUI, () => undefined);
    engine.current = instance; instance.start();
    const down = (event: KeyboardEvent) => { if (!event.repeat) instance.key(event.code, true); };
    const up = (event: KeyboardEvent) => instance.key(event.code, false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => {
      const current = instance.getSave(); saveGame(current);
      instance.destroy(); engine.current = null;
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
    };
  }, [screen, pendingSave]);

  const slots = useMemo(() => saves.map((save, index) => ({ save, index })), [saves]);
  const togglePanel = (next: typeof panel) => {
    const value = panel === next ? "none" : next;
    setPanel(value); engine.current?.setPaused(value !== "none");
  };
  const changeSettings = (patch: Partial<GameSettings>) => {
    const settings = { ...ui.settings, ...patch };
    engine.current?.updateSettings(settings);
    setUI((old) => ({ ...old, settings }));
  };

  if (screen === "title") return (
    <main className="title-screen">
      <div className="title-art" style={{ backgroundImage: `url("${process.env.NEXT_PUBLIC_BASE_PATH || ""}/assets/cinematic/hawaii-volcano-panorama-v2.png")` }} />
      <div className="title-helicopter" style={{ backgroundImage: `url("${process.env.NEXT_PUBLIC_BASE_PATH || ""}/assets/cinematic/helicopter-v2.png")` }} />
      <div className="title-vignette" />
      <div className="title-lockup">
        <span className="eyebrow">A handcrafted rescue adventure</span>
        <h1>VOLCANO<br /><em>ESCAPE</em></h1>
        <p>Outthink the mountain. Bring everyone home.</p>
        <button className="primary" onClick={() => { setSaves(listSaves()); setScreen("slots"); }}>Begin adventure</button>
        <button className="quiet" onClick={() => setPanel("settings")}>Settings</button>
      </div>
      {panel === "settings" && <Settings settings={ui.settings} onChange={changeSettings} onClose={() => setPanel("none")} />}
    </main>
  );

  if (screen === "slots") return (
    <main className="menu-screen">
      <div className="menu-card">
        <button className="back" onClick={() => setScreen("title")}>← Back</button>
        <span className="eyebrow">Choose your expedition</span><h2>Adventure saves</h2>
        <div className="save-grid">
          {slots.map(({ save, index }) => <article className="save-slot" key={index}>
            <strong>Journey {index + 1}</strong>
            {save ? <>
              <span>{REGIONS[save.region].name}</span>
              <small>{Math.floor(save.playtime / 60)} min • {save.diamonds.length}/3 diamonds</small>
              <button className="primary compact" onClick={() => begin(save, false)}>Continue</button>
              <button className="danger-link" onClick={() => { deleteSave(index); setSaves(listSaves()); }}>Erase</button>
            </> : <>
              <span>Empty trail</span><small>A new rescue begins here.</small>
              <button className="primary compact" onClick={() => begin(newSave(index), true)}>New game</button>
            </>}
          </article>)}
        </div>
      </div>
    </main>
  );

  if (screen === "intro") return <Cinematic onComplete={startGame} />;

  return (
    <main className="game-shell">
      <canvas ref={canvas} width={960} height={540} aria-label="Volcano Escape game world" />
      <header className="hud">
        <div><span className="location">{ui.regionName}</span><span className="objective">{ui.objective}</span></div>
        <div className="status"><span className="hearts">{"♥".repeat(ui.hp)}{"♡".repeat(ui.maxHp - ui.hp)}</span><span>◆ {ui.diamonds}/3</span><span>◈ {ui.lavaRocks}</span></div>
      </header>
      <nav className="top-actions">
        <button onClick={() => togglePanel("map")}>Map</button><button onClick={() => togglePanel("journal")}>Journal</button>
        <button onClick={() => togglePanel("inventory")}>Gear</button><button onClick={() => togglePanel("settings")}>Pause</button>
      </nav>
      <div className="tool-chip">{ui.selectedTool ? TOOL_NAMES[ui.selectedTool] : "Basic burst"}</div>
      <TouchControls scale={ui.settings.controlScale} opacity={ui.settings.controlOpacity}
        onMove={(x, y) => engine.current?.setMove(x, y)}
        onAttack={() => engine.current?.attack()} onInteract={() => engine.current?.interact()} />
      {ui.dialogue && <button className="dialogue" onClick={() => engine.current?.interact()}>
        <strong>{ui.dialogue.speaker}</strong><span>{ui.dialogue.text}</span><small>Tap to continue</small>
      </button>}
      {ui.prompt && <div className="modal-layer"><section className="prompt-card">
        <h2>{ui.prompt.title}</h2><p>{ui.prompt.text}</p><span className="eyebrow">Choose a tool</span>
        <div className="choice-grid">{ui.prompt.choices.length ? ui.prompt.choices.map((tool, index) =>
          <button key={`${tool}-${index}`} onClick={() => engine.current?.chooseTool(tool)}>{TOOL_NAMES[tool]}</button>
        ) : <em>You are not carrying a useful tool yet.</em>}</div>
        <button className="quiet" onClick={() => engine.current?.cancelPrompt()}>Keep thinking</button>
      </section></div>}
      {panel === "map" && <Panel title="Survey map" onClose={() => togglePanel("map")}>
        <div className="map-grid">{REGION_ORDER.map((id) => <div className={`map-node ${ui.visited.includes(id) ? "visited" : ""}`} key={id}>{ui.visited.includes(id) ? REGIONS[id].name : "Unknown"}</div>)}</div>
      </Panel>}
      {panel === "journal" && <Panel title="Field journal" onClose={() => togglePanel("journal")}>
        <p className="panel-intro">Clues are recorded automatically. The solution is always in the world.</p>
        <ol className="journal-list">{ui.observations.map((note, i) => <li key={i}>{note}</li>)}</ol>
      </Panel>}
      {panel === "inventory" && <Panel title="Rescue gear" onClose={() => togglePanel("inventory")}>
        <div className="gear-list">{ui.tools.map((tool) => <button className={ui.selectedTool === tool ? "selected" : ""} key={tool}
          onClick={() => { engine.current?.setTool(tool); togglePanel("inventory"); }}><strong>{TOOL_NAMES[tool]}</strong><span>{TOOL_DESCRIPTIONS[tool]}</span></button>)}</div>
      </Panel>}
      {panel === "settings" && <Settings settings={ui.settings} onChange={changeSettings} onClose={() => togglePanel("settings")}
        onSave={() => { if (engine.current) saveGame(engine.current.getSave()); }}
        onTitle={() => { if (engine.current) saveGame(engine.current.getSave()); setSaves(listSaves()); setPanel("none"); setScreen("title"); }} />}
      {ui.ending !== "none" && <div className="modal-layer ending-layer"><section className="ending-card">
        <span className="eyebrow">{ui.ending === "best" ? "The mountain remembers" : "Signal received"}</span>
        <h2>Everyone made it home.</h2>
        <p>{ui.ending === "best" ? "You restored the three volcano hearts, calmed the Guardian, repaired the transmitter, and led every survivor into the open sky." : "You repaired the transmitter and led every survivor to safety. Somewhere below, the ancient volcano still glows."}</p>
        <p className="ending-stats">{Math.floor(ui.playtime / 60)} min • Guardian: {ui.guardianResolution}</p>
        <button className="primary" onClick={() => { setPanel("none"); setScreen("title"); }}>Return to title</button>
      </section></div>}
      {process.env.NODE_ENV !== "production" && <button className="debug-complete" onClick={() => engine.current?.debugComplete()}>DEBUG: expedition kit</button>}
    </main>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-layer"><section className="panel-card"><button className="close" onClick={onClose}>×</button><h2>{title}</h2>{children}</section></div>;
}

function Settings({ settings, onChange, onClose, onSave, onTitle }: {
  settings: GameSettings; onChange: (patch: Partial<GameSettings>) => void; onClose: () => void; onSave?: () => void; onTitle?: () => void;
}) {
  return <div className="modal-layer"><section className="panel-card settings-card"><button className="close" onClick={onClose}>×</button><h2>Expedition settings</h2>
    <label>Sound effects <input type="range" min="0" max="1" step=".05" value={settings.effects} onChange={(e) => onChange({ effects: +e.target.value })} /></label>
    <label>Music <input type="range" min="0" max="1" step=".05" value={settings.music} onChange={(e) => onChange({ music: +e.target.value })} /></label>
    <label>Control size <input type="range" min=".8" max="1.3" step=".1" value={settings.controlScale} onChange={(e) => onChange({ controlScale: +e.target.value })} /></label>
    <label>Control opacity <input type="range" min=".35" max="1" step=".05" value={settings.controlOpacity} onChange={(e) => onChange({ controlOpacity: +e.target.value })} /></label>
    <label className="toggle"><input type="checkbox" checked={settings.shake} onChange={(e) => onChange({ shake: e.target.checked })} /> Impact shake</label>
    <label className="toggle"><input type="checkbox" checked={settings.hints} onChange={(e) => onChange({ hints: e.target.checked })} /> Gentle hints</label>
    {onSave && <button className="primary compact" onClick={onSave}>Save at checkpoint</button>}
    {onTitle && <button className="quiet" onClick={onTitle}>Save & return to title</button>}
  </section></div>;
}
