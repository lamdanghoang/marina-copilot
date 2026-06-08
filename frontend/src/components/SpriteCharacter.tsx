"use client";

import { useEffect, useRef, useState } from "react";

// Sprite sheets: 4 columns x 2 rows, each frame 688x768px → sheet 2752x1536
const COLS = 4;
const ROWS = 2;
const TOTAL_FRAMES = COLS * ROWS;
const FRAME_ASPECT = 768 / 688;

const ANIMATIONS: Record<string, string[]> = {
  idle: ["/sprites/idle-0.png", "/sprites/idle-1.png"],
  think: ["/sprites/think-0.png", "/sprites/think-1.png", "/sprites/think-2.png"],
  talk: ["/sprites/talk-0.png", "/sprites/talk-1.png", "/sprites/talk-2.png", "/sprites/talk-3.png"],
  ok: ["/sprites/ok-0.png", "/sprites/ok-1.png"],
  shy: ["/sprites/shy-0.png", "/sprites/shy-1.png"],
  waving: ["/sprites/waving-0.png", "/sprites/waving-1.png"],
};

const ANIM_MAP: Record<string, string> = {
  idle: "idle",
  thinking: "think",
  talking: "talk",
  happy: "ok",
  sad: "shy",
  waving: "waving",
};

interface SpriteCharacterProps {
  animation: string;
  size?: number;
  fps?: number;
}

export function SpriteCharacter({ animation, size = 280, fps = 6 }: SpriteCharacterProps) {
  const [frame, setFrame] = useState(0);
  const [sheet, setSheet] = useState<string>("");
  const prevAnim = useRef(animation);

  // Pick random sheet when animation changes
  useEffect(() => {
    const key = ANIM_MAP[animation] || "idle";
    const sheets = ANIMATIONS[key] || ANIMATIONS.idle;
    const randomSheet = sheets[Math.floor(Math.random() * sheets.length)];
    setSheet(randomSheet);
    setFrame(0);
    prevAnim.current = animation;
  }, [animation]);

  // Animate frames
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % TOTAL_FRAMES);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [fps, sheet]);

  if (!sheet) return null;

  const frameW = size;
  const frameH = size * FRAME_ASPECT;
  const col = frame % COLS;
  const row = Math.floor(frame / COLS);

  return (
    <div
      style={{ width: frameW, height: frameH, overflow: "hidden", position: "relative" }}
    >
      <img
        src={sheet}
        alt="Marina"
        style={{
          width: frameW * COLS,
          height: frameH * ROWS,
          position: "absolute",
          left: -col * frameW,
          top: -row * frameH,
          imageRendering: "auto",
        }}
        draggable={false}
      />
    </div>
  );
}
