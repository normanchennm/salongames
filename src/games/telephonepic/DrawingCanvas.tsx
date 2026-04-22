"use client";

import { useEffect, useRef, useState } from "react";

/** Minimal touch+mouse drawing surface. Fixed dimensions so the
 *  resulting PNG is comparable across devices. Black strokes on
 *  a cream background to match the editorial aesthetic. Exposes
 *  the drawn PNG via onChange (dataURL, debounced on pointerup). */

export interface DrawingCanvasProps {
  width?: number;
  height?: number;
  onChange: (dataUrl: string) => void;
}

const STROKE = "#100d0b";
const BG = "#f5efe4";
const LINE_WIDTH = 3;

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ width = 340, height = 340, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = LINE_WIDTH;
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = getPos(e);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    const last = lastRef.current ?? pos;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    if (!hasDrawn) setHasDrawn(true);
  }

  function onUp() {
    drawingRef.current = false;
    lastRef.current = null;
    const c = canvasRef.current;
    if (!c) return;
    onChange(c.toDataURL("image/png"));
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, c.width, c.height);
    setHasDrawn(false);
    onChange(c.toDataURL("image/png"));
  }

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        className="touch-none rounded-md border border-[hsl(var(--ember)/0.3)] bg-[#f5efe4]"
        style={{ width: "100%", maxWidth: width, aspectRatio: `${width} / ${height}` }}
      />
      <button
        type="button"
        onClick={clearCanvas}
        disabled={!hasDrawn}
        className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg disabled:opacity-30"
      >
        Clear
      </button>
    </div>
  );
};
