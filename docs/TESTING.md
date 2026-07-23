# Test and release checklist

## Automated

Run `npm run check`. It verifies:

- lint and TypeScript/React correctness;
- all twelve planned regions exist;
- every critical region gate has an implemented solution;
- peaceful/combat Guardian outcomes and standard/best endings exist;
- the project emits a GitHub Pages static export.

## Manual route

1. Watch or skip the cinematic and verify either route initializes the same new save.
2. Check all survivors, recover first aid, treat Kai, and enter the wreckage.
3. Recover rescue gear. Cut the debris cable, then pull the slab with rope.
4. Explore both Crossroads branches:
   - Caverns: flashlight on reflective marks, flare at tunnel mouths.
   - Bridges: rope and then carabiners at the steel anchor.
5. At the station, collect the battery, heat blanket, map, and both sets of notes.
6. Power the lift with battery then multi-tool. Cool the terrace valve with water, then release it with the multi-tool.
7. Release the lava-tube gate with rope then multi-tool.
8. Touch grotto crystals in station-note order: low, flow, sky. Collect all three diamonds.
9. At the sanctuary, verify:
   - peaceful route: read Guardian notes, collect three diamonds, perform the altar ritual;
   - combat route: defeat the Guardian with burst attacks.
10. Use the heat blanket at the furnace passage.
11. At the rim transmitter install radio part and battery, then connect them with the multi-tool.
12. Verify the appropriate ending, checkpoint recovery, journal, map, gear selection, all three save slots, keyboard input, and mobile Pointer Events.

## Mobile acceptance

Test 360×800 portrait and 800×360 landscape. Confirm safe-area spacing, 44px-or-larger important targets, joystick pointer capture, simultaneous movement/action, crisp canvas scaling, legible dialogue, no page scrolling, and stable frame pacing.
