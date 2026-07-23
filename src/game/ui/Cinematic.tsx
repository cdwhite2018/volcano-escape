"use client";

import { useEffect, useState } from "react";

const beats = [
  { at: 0, speaker: "", text: "Hawaiʻi • just before sunset" },
  { at: 5, speaker: "Guide", text: "Below us—the youngest land on Earth. And ahead…" },
  { at: 10, speaker: "Maya", text: "Whoa. The whole crater is glowing." },
  { at: 15, speaker: "Ben", text: "Beautiful. Terrifying. Mostly beautiful." },
  { at: 20, speaker: "Kai", text: "We’ll make one quiet pass over the rim." },
  { at: 25, speaker: "", text: "The rotor skips a beat." },
  { at: 29, speaker: "Kai", text: "That warning light shouldn’t be on." },
  { at: 33, speaker: "Dr. Lee", text: "Everyone, brace!" },
  { at: 38, speaker: "", text: "The helicopter drops through smoke and orange light." },
  { at: 44, speaker: "", text: "IMPACT" },
  { at: 49, speaker: "", text: "For a moment, the volcano is silent." },
  { at: 54, speaker: "Dr. Lee", text: "Ari? Open your eyes. Everyone made it." },
  { at: 59, speaker: "Guide", text: "We have to reach the rim before the next eruption." },
];

export default function Cinematic({ onComplete }: { onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      const seconds = (performance.now() - started) / 1000;
      setElapsed(seconds);
      if (seconds >= 64) { clearInterval(timer); onComplete(); }
    }, 100);
    return () => clearInterval(timer);
  }, [onComplete]);
  const beat = [...beats].reverse().find((entry) => elapsed >= entry.at) || beats[0];
  const danger = elapsed > 24;
  return (
    <section className={`cinematic ${danger ? "danger" : ""} ${elapsed > 43 && elapsed < 47 ? "impact" : ""}`}>
      <div className="cinematic-bg" style={{ backgroundImage: `url("${process.env.NEXT_PUBLIC_BASE_PATH || ""}/assets/cinematic/title-bg.png")` }} />
      <div className="sun" />
      <div className="cloud cloud-a" /><div className="cloud cloud-b" />
      <div className="helicopter">
        <i className="rotor" /><i className="tail-rotor" /><i className="heli-body" /><i className="skids" /><i className="nav-light" />
      </div>
      <div className="smoke-column" />
      <div className="cinema-bars" />
      <div className="cinema-copy">
        {beat.speaker && <strong>{beat.speaker}</strong>}
        <span>{beat.text}</span>
      </div>
      <div className="timeline"><i style={{ width: `${Math.min(100, elapsed / 64 * 100)}%` }} /></div>
      {elapsed >= 3 && <button className="skip" onClick={onComplete}>Skip cinematic</button>}
    </section>
  );
}
