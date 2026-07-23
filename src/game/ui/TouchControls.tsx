"use client";

import { useRef } from "react";

export default function TouchControls({
  scale, opacity, onMove, onAttack, onInteract,
}: {
  scale: number; opacity: number;
  onMove: (x: number, y: number) => void;
  onAttack: () => void; onInteract: () => void;
}) {
  const stick = useRef<HTMLDivElement>(null);
  const update = (clientX: number, clientY: number) => {
    const rect = stick.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (clientX - (rect.left + rect.width / 2)) / (rect.width * .34);
    const y = (clientY - (rect.top + rect.height / 2)) / (rect.height * .34);
    const length = Math.max(1, Math.hypot(x, y));
    onMove(x / length, y / length);
  };
  return (
    <div className="touch-controls" style={{ "--control-scale": scale, "--control-opacity": opacity } as React.CSSProperties}>
      <div className="stick" ref={stick}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event.clientX, event.clientY); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event.clientX, event.clientY); }}
        onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); onMove(0, 0); }}
        onPointerCancel={() => onMove(0, 0)}
      ><i /></div>
      <div className="action-cluster">
        <button className="action interact-button" aria-label="Interact" onPointerDown={(e) => { e.preventDefault(); onInteract(); }}>!</button>
        <button className="action attack-button" aria-label="Attack" onPointerDown={(e) => { e.preventDefault(); onAttack(); }}>⚡</button>
      </div>
    </div>
  );
}
