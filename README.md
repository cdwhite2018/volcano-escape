# Volcano Escape

A cinematic, mobile-first pixel-art rescue adventure that runs entirely in the browser. The project is a fresh hosted rebuild of the original single-file prototype; the original file remains untouched in the parent workspace.

## Play

Production: <https://cdwhite2018.github.io/volcano-escape/>

- Move: WASD, arrow keys, or the touch joystick.
- Examine/use: E, Enter, or the green `!` button.
- Attack: Space, J, or the orange burst button.
- Open Map, Journal, Gear, and Pause from the upper-right controls.
- Progress is checkpointed at green safe-zone markers. Three save slots are stored locally in the browser.

The main route can be completed through exploration and deduction. Combat is secondary. The Fire Guardian can be defeated or calmed by following the station records and returning all three lava diamonds.

## Development

Requires Node.js 22.

```sh
pnpm install
pnpm dev
pnpm check
```

`pnpm check` runs lint, progression tests, TypeScript validation through Next, and the static production export. The installed service worker caches the app shell and every visited asset, so the adventure can be relaunched offline after its first load. All art is committed locally.

## Architecture

- Next.js static export provides a reliable GitHub Pages shell.
- React owns menus, accessibility-friendly controls, dialogue, saves, settings, and the cinematic.
- A fixed-resolution custom Canvas engine owns simulation and pixel-art rendering.
- Region, object, clue, and gate definitions live in data rather than JSX.
- Saves are versioned (`schema: 2`) and tolerate missing optional fields.

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [TESTING.md](./docs/TESTING.md), and [ART_ATTRIBUTION.md](./docs/ART_ATTRIBUTION.md).
