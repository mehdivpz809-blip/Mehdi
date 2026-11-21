import { useRef, useState } from 'react';

interface VirtualJoystickProps {
  onChange: (joyX: number, joyY: number) => void;
}

const OUTER_RADIUS = 48;
const KNOB_MAX_OFFSET = 30;

export function VirtualJoystick({ onChange }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > KNOB_MAX_OFFSET) {
      dx = (dx / dist) * KNOB_MAX_OFFSET;
      dy = (dy / dist) * KNOB_MAX_OFFSET;
    }
    setKnob({ x: dx, y: dy });
    // joyX: right is +1; joyY: up is +1 (screen dy is inverted)
    onChange(dx / KNOB_MAX_OFFSET, -dy / KNOB_MAX_OFFSET);
  };

  const reset = () => {
    activePointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={baseRef}
        role="slider"
        aria-label="Joystick de déplacement et direction"
        aria-valuetext={`X ${knob.x.toFixed(0)} Y ${(-knob.y).toFixed(0)}`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          activePointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          setActive(true);
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerId.current !== e.pointerId) return;
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activePointerId.current !== e.pointerId) return;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          reset();
        }}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
        style={{
          width: OUTER_RADIUS * 2,
          height: OUTER_RADIUS * 2,
        }}
        className={`relative flex items-center justify-center rounded-full border touch-none cursor-grab active:cursor-grabbing transition-colors ${
          active
            ? 'border-[#ff477e] bg-[#0d0a18]/92'
            : 'border-white/20 bg-[#0d0a18]/85 hover:border-white/35'
        }`}
      >
        {/* Subtle crosshair guides */}
        <div className="pointer-events-none absolute inset-3 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute h-px w-10 bg-white/10" />
        <div className="pointer-events-none absolute h-10 w-px bg-white/10" />

        {/* Analog Thumb Knob */}
        <div
          style={{
            transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
          }}
          className={`pointer-events-none h-10 w-10 rounded-full border shadow-md transition-colors ${
            active
              ? 'border-white bg-[#ff477e]'
              : 'border-white/30 bg-white/20'
          }`}
        />
      </div>
    </div>
  );
}
