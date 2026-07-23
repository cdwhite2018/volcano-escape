"use client";

import { useEffect, useRef, useState } from "react";
import { createTimeline } from "animejs";
import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";

const DURATION = 64;
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

const beats = [
  { at: 0, speaker: "", text: "Hawaiʻi • just before sunset", chapter: "Paradise" },
  { at: 5, speaker: "Guide", text: "Below us—the youngest land on Earth. And ahead…", chapter: "The tour" },
  { at: 10, speaker: "Maya", text: "Whoa. The whole crater is glowing.", chapter: "The reveal" },
  { at: 15, speaker: "Ben", text: "Beautiful. Terrifying. Mostly beautiful.", chapter: "The reveal" },
  { at: 20, speaker: "Kai", text: "We’ll make one quiet pass over the rim.", chapter: "Over the crater" },
  { at: 25, speaker: "", text: "The rotor skips a beat.", chapter: "Something is wrong" },
  { at: 29, speaker: "Kai", text: "That warning light shouldn’t be on.", chapter: "Mechanical failure" },
  { at: 33, speaker: "Dr. Lee", text: "Everyone, brace!", chapter: "No way back" },
  { at: 38, speaker: "", text: "The helicopter drops through smoke and orange light.", chapter: "The descent" },
  { at: 44, speaker: "", text: "IMPACT", chapter: "Impact" },
  { at: 49, speaker: "", text: "For a moment, the volcano is silent.", chapter: "Aftermath" },
  { at: 54, speaker: "Dr. Lee", text: "Ari? Open your eyes. Everyone made it.", chapter: "Survivors" },
  { at: 59, speaker: "Guide", text: "We have to reach the rim before the next eruption.", chapter: "Volcano Escape" },
];

type Particle = {
  art: Graphics;
  seed: number;
  speed: number;
};

type Motion = {
  helicopterX: number;
  helicopterY: number;
  helicopterScale: number;
  helicopterRotation: number;
  cameraX: number;
  cameraScale: number;
  danger: number;
  smoke: number;
  descent: number;
  impact: number;
  blackout: number;
  aftermath: number;
};

function cloudShape(alpha: number) {
  const cloud = new Graphics();
  cloud
    .ellipse(0, 0, 105, 25)
    .ellipse(-60, 8, 72, 19)
    .ellipse(65, 9, 88, 20)
    .fill({ color: 0xffe9d0, alpha });
  return cloud;
}

export default function Cinematic({ onComplete }: { onComplete: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const completed = useRef(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!host.current) return;

    let disposed = false;
    let app: Application | undefined;
    let timeline: ReturnType<typeof createTimeline> | undefined;
    const start = performance.now();
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const finish = () => {
      if (completed.current) return;
      completed.current = true;
      onComplete();
    };

    const boot = async () => {
      app = new Application();
      await app.init({
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        antialias: false,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        background: "#180d24",
        preference: "webgl",
      });
      if (disposed || !host.current) {
        app.destroy(true);
        return;
      }
      app.canvas.className = "cinematic-canvas";
      app.canvas.setAttribute("aria-label", "Animated helicopter tour and volcano crash cinematic");
      host.current.appendChild(app.canvas);

      const [panoramaTexture, helicopterTexture, wreckTexture] = await Promise.all([
        Assets.load<Texture>(`${base}/assets/cinematic/hawaii-volcano-panorama-v2.png`),
        Assets.load<Texture>(`${base}/assets/cinematic/helicopter-v2.png`),
        Assets.load<Texture>(`${base}/assets/sprites/wreck-v2.png`),
      ]);
      if (disposed || !app) return;

      const world = new Container();
      const atmosphere = new Container();
      const aircraftLayer = new Container();
      const foreground = new Container();
      const aftermathLayer = new Container();
      app.stage.addChild(world, atmosphere, aircraftLayer, foreground, aftermathLayer);

      const panorama = new Sprite(panoramaTexture);
      panorama.anchor.set(0.5);
      panorama.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
      panorama.width = 1420;
      panorama.height = 800;
      world.addChild(panorama);

      const oceanGlints: Graphics[] = [];
      for (let i = 0; i < 18; i += 1) {
        const glint = new Graphics()
          .roundRect(0, 0, 42 + (i % 4) * 18, 2, 1)
          .fill({ color: i % 3 === 0 ? 0xffd9a1 : 0x8ed8de, alpha: 0.25 });
        glint.position.set(45 + (i * 83) % 710, 420 + (i * 29) % 190);
        oceanGlints.push(glint);
        atmosphere.addChild(glint);
      }

      const clouds = [cloudShape(0.11), cloudShape(0.08), cloudShape(0.06)];
      clouds[0].position.set(170, 130);
      clouds[1].position.set(690, 205);
      clouds[1].scale.set(0.72);
      clouds[2].position.set(1060, 92);
      clouds[2].scale.set(1.25);
      atmosphere.addChild(...clouds);

      const craterGlow = new Graphics()
        .ellipse(1030, 455, 205, 80)
        .fill({ color: 0xff5a1f, alpha: 0.1 });
      atmosphere.addChild(craterGlow);

      const embers: Particle[] = [];
      for (let i = 0; i < 40; i += 1) {
        const art = new Graphics()
          .circle(0, 0, 1 + (i % 3))
          .fill({ color: i % 4 === 0 ? 0xfff0a1 : 0xff7a25, alpha: 0.7 });
        art.visible = false;
        atmosphere.addChild(art);
        embers.push({ art, seed: i * 37.7, speed: 10 + (i % 7) * 3 });
      }

      const helicopter = new Container();
      const heliSprite = new Sprite(helicopterTexture);
      heliSprite.anchor.set(0.5);
      heliSprite.width = 410;
      heliSprite.height = 225;
      const rotorBlur = new Graphics()
        .ellipse(-30, -91, 152, 6)
        .fill({ color: 0xfff4dd, alpha: 0.26 });
      const tailRotorBlur = new Graphics()
        .circle(-172, -13, 29)
        .stroke({ color: 0xffd9bc, alpha: 0.33, width: 3 });
      const navLight = new Graphics().circle(145, -8, 4).fill({ color: 0x7dffb0, alpha: 0.9 });
      const warningLight = new Graphics().circle(32, -30, 6).fill({ color: 0xff2f1f, alpha: 0 });
      helicopter.addChild(heliSprite, rotorBlur, tailRotorBlur, navLight, warningLight);
      aircraftLayer.addChild(helicopter);

      const smokeParticles: Particle[] = [];
      for (let i = 0; i < 28; i += 1) {
        const art = new Graphics()
          .circle(0, 0, 9 + (i % 5) * 4)
          .fill({ color: i % 3 === 0 ? 0x3c2932 : 0x5f4140, alpha: 0.23 });
        art.visible = false;
        aircraftLayer.addChildAt(art, 0);
        smokeParticles.push({ art, seed: i * 19.3, speed: 14 + (i % 6) * 4 });
      }

      const rockA = new Graphics()
        .moveTo(-60, 720).lineTo(0, 430).lineTo(95, 510).lineTo(185, 720).closePath()
        .fill({ color: 0x21151f, alpha: 0.94 });
      const rockB = new Graphics()
        .moveTo(1130, 720).lineTo(1215, 415).lineTo(1310, 490).lineTo(1370, 720).closePath()
        .fill({ color: 0x170f18, alpha: 0.96 });
      foreground.addChild(rockA, rockB);

      const flash = new Graphics().rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill({ color: 0xfff2cf });
      flash.alpha = 0;
      foreground.addChild(flash);

      const wreck = new Sprite(wreckTexture);
      wreck.anchor.set(0.5);
      wreck.position.set(760, 505);
      wreck.width = 560;
      wreck.height = 315;
      wreck.alpha = 0;
      aftermathLayer.addChild(wreck);
      const aftermathShade = new Graphics()
        .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
        .fill({ color: 0x160e1e, alpha: 0.54 });
      aftermathShade.alpha = 0;
      aftermathLayer.addChildAt(aftermathShade, 0);

      const motion: Motion = {
        helicopterX: -260,
        helicopterY: 245,
        helicopterScale: 0.72,
        helicopterRotation: 0,
        cameraX: 0,
        cameraScale: 1,
        danger: 0,
        smoke: 0,
        descent: 0,
        impact: 0,
        blackout: 0,
        aftermath: 0,
      };

      timeline = createTimeline({
        autoplay: true,
        defaults: { ease: "inOut(2)" },
        onComplete: finish,
      })
        .add(motion, { helicopterX: 460, helicopterY: 270, duration: 20000 }, 0)
        .add(motion, { cameraX: -70, cameraScale: 1.06, duration: 22000 }, 0)
        .add(motion, { helicopterX: 655, helicopterY: 235, helicopterScale: 0.62, duration: 7000 }, 20000)
        .add(motion, { danger: 1, duration: 6000 }, 24000)
        .add(motion, { smoke: 1, helicopterX: 775, helicopterY: 290, duration: 8000 }, 30000)
        .add(motion, {
          descent: 1,
          helicopterX: 965,
          helicopterY: 535,
          helicopterScale: 0.76,
          helicopterRotation: 0.24,
          cameraX: -120,
          cameraScale: 1.14,
          duration: 6000,
          ease: "in(3)",
        }, 38000)
        .add(motion, { impact: 1, duration: 700, ease: "out(5)" }, 44000)
        .add(motion, { blackout: 1, duration: 1500 }, 44700)
        .add(motion, { aftermath: 1, duration: 3500 }, 48500)
        .add(motion, { blackout: 0, duration: 3500 }, 50000)
        .add(motion, { duration: 10500 }, 53500);

      let lastUiUpdate = 0;
      app.ticker.add((ticker) => {
        const now = performance.now();
        const seconds = (now - start) / 1000;
        const wobble = motion.danger * Math.sin(seconds * (motion.descent ? 18 : 11));
        helicopter.position.set(
          motion.helicopterX + wobble * (2 + motion.descent * 7),
          motion.helicopterY + Math.sin(seconds * 2.1) * (5 + motion.danger * 3),
        );
        helicopter.scale.set(motion.helicopterScale);
        helicopter.rotation = motion.helicopterRotation + wobble * 0.008;
        rotorBlur.scale.x = 0.94 + Math.sin(seconds * 33) * 0.08 - motion.danger * 0.15;
        rotorBlur.alpha = 0.2 + Math.sin(seconds * 29) * 0.08;
        tailRotorBlur.rotation += ticker.deltaTime * (0.7 - motion.danger * 0.18);
        navLight.alpha = 0.55 + Math.sin(seconds * 7) * 0.35;
        warningLight.alpha = motion.danger * (Math.sin(seconds * 12) > 0 ? 0.95 : 0.08);

        world.position.x = motion.cameraX;
        world.scale.set(motion.cameraScale);
        atmosphere.position.x = motion.cameraX * 0.42;
        craterGlow.alpha = 0.08 + Math.sin(seconds * 1.8) * 0.04 + motion.danger * 0.08;
        clouds.forEach((cloud, index) => {
          cloud.x += ticker.deltaTime * (0.07 + index * 0.025);
          if (cloud.x > 1450) cloud.x = -180;
        });
        oceanGlints.forEach((glint, index) => {
          glint.alpha = 0.12 + Math.sin(seconds * 2 + index) * 0.09;
          glint.x += ticker.deltaTime * 0.04;
        });

        embers.forEach(({ art, seed, speed }, index) => {
          const local = (seconds * speed + seed) % 180;
          art.visible = seconds > 10 && motion.blackout < 0.9;
          art.position.set(910 + ((seed * 7) % 310) + Math.sin(seconds + index) * 10, 540 - local);
          art.alpha = Math.min(0.8, local / 30) * (1 - local / 210);
        });

        smokeParticles.forEach(({ art, seed, speed }, index) => {
          const local = (seconds * speed + seed) % 150;
          art.visible = motion.smoke > 0.03 && motion.aftermath < 0.1;
          art.position.set(
            helicopter.x - 130 - local * 1.1 + Math.sin(seconds * 2 + index) * 11,
            helicopter.y - 55 - local * 0.45,
          );
          art.scale.set(0.35 + local / 135);
          art.alpha = motion.smoke * Math.max(0, 0.36 - local / 430);
        });

        const impactPulse = Math.sin(motion.impact * Math.PI);
        flash.alpha = impactPulse * 0.92;
        aftermathShade.alpha = motion.aftermath * 0.76;
        wreck.alpha = motion.aftermath;
        aircraftLayer.alpha = 1 - motion.aftermath;
        if (motion.impact > 0 && motion.impact < 1) {
          app!.stage.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12);
        } else {
          app!.stage.position.set(0, 0);
        }
        host.current?.style.setProperty("--blackout", String(motion.blackout));
        host.current?.style.setProperty("--danger", String(motion.danger));

        if (now - lastUiUpdate > 100) {
          setElapsed(Math.min(DURATION, seconds));
          lastUiUpdate = now;
        }
      });
    };

    void boot();
    return () => {
      disposed = true;
      timeline?.revert();
      app?.destroy(true, { children: true });
    };
  }, [onComplete]);

  const beat = [...beats].reverse().find((entry) => elapsed >= entry.at) || beats[0];
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };

  return (
    <section className={`cinematic ${elapsed > 24 ? "danger" : ""} ${elapsed > 43.8 && elapsed < 46 ? "impact" : ""}`}>
      <div className="cinematic-stage" ref={host} />
      <div className="cinematic-vignette" />
      <div className="cinematic-heat" />
      <div className="cinema-bars" />
      <div className="cinema-chapter">{beat.chapter}</div>
      <div className="cinema-copy">
        {beat.speaker && <strong>{beat.speaker}</strong>}
        <span>{beat.text}</span>
      </div>
      <div className="timeline" aria-hidden="true"><i style={{ width: `${Math.min(100, elapsed / DURATION * 100)}%` }} /></div>
      {elapsed >= 3 && <button className="skip" onClick={finish}>Skip cinematic</button>}
    </section>
  );
}
