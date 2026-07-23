# Open-source game-development toolchain

This project favors tools whose code can be used, studied, modified, and redistributed under established open-source licenses.

## Installed for Volcano Escape

| Tool | Version | License | Role |
| --- | --- | --- | --- |
| Pixelorama | 1.1.10 | MIT | Pixel-art drawing, frame animation, tiles, and sprite-sheet export |
| Krita | 5.3.2.1 | GPL-3.0 | Painted backgrounds, concept art, texture cleanup, and color work |
| Blender | 5.2.0 LTS | GPL-3.0-or-later | 3D blocking, camera studies, lighting reference, animation, and rendered guides |
| Audacity | 3.7.8 | GPL-3.0-or-later | Recording, cleaning, layering, and exporting original sound effects |
| Tiled | 1.12.2 | GPL-2.0-or-later | Tile maps, collision layers, object markers, triggers, and region metadata |
| PixiJS | 8.19.0 | MIT | Optional GPU-accelerated renderer for the opening cinematic |
| Anime.js | 4.5.0 | MIT | Timelines, easing, camera choreography, and safe skip-to-end control |
| React | 19.2.6 | MIT | Menus and application interface |
| Next.js | 16.2.6 | MIT | Static site build and GitHub Pages application shell |
| TypeScript | 5.9.3 | Apache-2.0 | Typed game and cinematic code |

Pixelorama and Krita are registered Windows applications. Blender, Audacity, and Tiled are checksum-verified portable installations under `C:\Users\Derrick's PC\Applications\OpenSourceGameDev`, avoiding administrator-level installation. Start Menu shortcuts for the portable applications are grouped under **Open Source Game Development**.

PixiJS and Anime.js are pinned in `package.json` and `pnpm-lock.yaml`. They are available to new cinematic code but are not yet wired into the current opening, so installing them does not change gameplay or increase the shipped bundle until they are imported.

## Why these replace the earlier suggestions

- Aseprite publishes source, but current versions use the Aseprite EULA and prohibit redistribution of compiled builds. Pixelorama provides the relevant pixel-art workflow under the MIT license.
- GSAP is available under a no-charge license, but that is not the same as an OSI-style open-source license. Anime.js provides an MIT-licensed timeline system.
- PixiJS is already MIT-licensed and remains the recommended renderer if the opening needs filters, sprite batching, particles, or GPU transforms.
- Phaser is MIT-licensed, but adding a second complete game engine would be unnecessary for this project.

## Recommended asset workflow

1. Create a Pixelorama project at a low internal resolution.
2. Keep helicopter components on separate layers: fuselage, cockpit, rotors, skids, lights, smoke, damage, and debris.
3. Use named animation tags for `cruise`, `warning`, `sputter`, `descent`, `impact`, and `wreck`.
4. Export local PNG sprite sheets and metadata into `public/assets/cinematic/`.
5. Load those sheets in a dedicated PixiJS cinematic component.
6. Drive camera and sprite state with a single Anime.js master timeline.
7. Preserve the existing Canvas gameplay engine and transition into it only after cinematic state is finalized.

## Starting the desktop tools

Open a new terminal after installation so it inherits the updated user PATH. You can then run `Pixelorama`, `blender`, `Audacity`, or `tiled`. Krita is available from the Windows Start Menu. Blender, Audacity, and Tiled are also available under **Start → Open Source Game Development**.
