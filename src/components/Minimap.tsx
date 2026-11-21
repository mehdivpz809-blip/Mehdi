import { useEffect, useRef } from 'react';
import type { MinimapBlip } from '../game/types';
import { BEACH_START_X, OCEAN_START_X, ROAD_XS, ROAD_ZS } from '../game/world';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  blips: MinimapBlip[];
  wantedLevel: number;
}

export function Minimap({
  playerX,
  playerZ,
  playerHeading,
  blips,
  wantedLevel,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.48; // world meters -> pixels

    ctx.clearRect(0, 0, w, h);

    // Background land
    ctx.fillStyle = '#181526';
    ctx.fillRect(0, 0, w, h);

    // Helper: world -> minimap pixel (North-up)
    const toMap = (wx: number, wz: number): [number, number] => {
      const dx = (wx - playerX) * scale;
      const dz = (wz - playerZ) * scale;
      return [cx + dx, cy + dz];
    };

    // Ocean East of OCEAN_START_X
    const [oceanStartX] = toMap(OCEAN_START_X, playerZ);
    if (oceanStartX < w) {
      ctx.fillStyle = '#0e4f5c';
      ctx.fillRect(Math.max(0, oceanStartX), 0, w - Math.max(0, oceanStartX), h);
    }
    // Beach strip
    const [beachStartX] = toMap(BEACH_START_X, playerZ);
    ctx.fillStyle = '#5c4f3b';
    ctx.fillRect(beachStartX, 0, Math.max(0, oceanStartX - beachStartX), h);

    // Roads
    ctx.strokeStyle = '#36324a';
    ctx.lineWidth = 10 * scale;
    for (const rx of ROAD_XS) {
      const [mx] = toMap(rx, playerZ);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, h);
      ctx.stroke();
    }
    for (const rz of ROAD_ZS) {
      const [, mz] = toMap(playerX, rz);
      ctx.beginPath();
      ctx.moveTo(0, mz);
      ctx.lineTo(w, mz);
      ctx.stroke();
    }

    // Blips
    for (const b of blips) {
      const [bx, by] = toMap(b.x, b.z);
      if (bx < 4 || bx > w - 4 || by < 4 || by > h - 4) continue;

      if (b.kind === 'mission') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (b.kind === 'police') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx, by, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === 'pickup') {
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(bx - 2.5, by - 2.5, 5, 5);
      } else if (b.kind === 'ramp') {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(bx, by - 3);
        ctx.lineTo(bx + 3, by + 3);
        ctx.lineTo(bx - 3, by + 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      }
    }

    // Player Arrow (heading 0 = +Z = down on North-up map, heading PI = -Z = up)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerHeading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.8, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Wanted border glow
    if (wantedLevel > 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }
  }, [playerX, playerZ, playerHeading, blips, wantedLevel]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/15 bg-[#0d0a18]/90 shadow-lg">
      <canvas
        ref={canvasRef}
        width={176}
        height={132}
        className="block h-[132px] w-[176px]"
      />
    </div>
  );
}
