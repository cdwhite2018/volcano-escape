# Architecture and implementation plan

## Reference findings

The rebuild first inspected both predecessors:

- The original `volcano_escape.html` is a complete single-file Canvas adventure with mobile controls, maps, objectives, inventory, combat, and endings. Those player-facing concepts were preserved.
- Run and Gun: Last Light established a proven hosting foundation: Next.js static export, React 19, TypeScript, a fixed 960×540 Canvas, Pointer Events with capture, local media, and GitHub Actions Pages deployment.

The rebuild extends that foundation without copying its monolithic game component. Presentation remains in React; simulation is isolated in `GameEngine`; region content is data-driven; browser persistence is isolated behind the save module.

## Runtime boundaries

| Layer | Responsibility |
| --- | --- |
| `app/Game.tsx` | Screen flow, menus, HUD, journal, map, gear, settings |
| `GameEngine.ts` | Input, movement, collision, region travel, interactions, combat, particles, rendering |
| `data/regions.ts` | Connected world graph, walls, hazards, clues, tools, enemies, objectives |
| `systems/save.ts` | Three versioned local save slots and compatible defaults |
| `systems/audio.ts` | Lightweight Web Audio feedback synthesized offline |
| `ui/` | Opening cinematic and Pointer Events mobile controls |

## Progression contract

Every locked exit names a solved flag. Each named flag has an interaction chain in the engine. Incorrect tools provide a contextual reason, while clues are copied into the field journal. Safe zones restore health, advance the survivor group, and write a checkpoint. Defeat returns the hero to the latest safe zone without deleting discoveries.

The primary critical path is:

`Crash Basin → Wreckage → Crossroads → Caverns/Lava Tubes or Bridges/Station/Terraces → Crystal Grotto → Sanctuary → Ascent → Rim`

The two middle branches reconnect, so exploration order is flexible. The best ending requires all diamonds, station Guardian notes, the peaceful altar ritual, and a repaired rim transmitter.

## Performance

The engine uses one fixed-size 2D canvas, capped frame deltas, rectangle collision, bounded particle counts, simple gradients, and no runtime asset downloads. A quality setting reduces ambient particle frequency. UI stays outside the canvas for crisp text and reachable touch targets.
