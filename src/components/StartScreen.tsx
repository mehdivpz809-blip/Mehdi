import { Play } from 'lucide-react';
import type { CharacterId } from '../game/types';

interface StartScreenProps {
  selectedCharacter: CharacterId;
  onSelectCharacter: (char: CharacterId) => void;
  onStart: () => void;
}

export function StartScreen({
  selectedCharacter,
  onSelectCharacter,
  onStart,
}: StartScreenProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-t from-[#0b0816]/90 via-[#0b0816]/45 to-[#0b0816]/65 p-6">
      <div className="w-full max-w-xl border border-white/15 bg-[#0e0b1a]/92 p-8 shadow-2xl rounded-xl">
        <p className="text-xs font-medium tracking-widest text-[#ff5fa2] uppercase">
          État de Leonida · Ocean Drive
        </p>

        <h1 className="font-display mt-2 text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-none [text-wrap:balance]">
          LEONIDA VICE
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300 max-w-md">
          Monde ouvert 3D inspiré de Vice City. Pilotez des supercars le long
          d’Ocean Drive, réalisez des cascades, relevez les contrats ou semez
          le VCPD.
        </p>

        {/* Character Selector */}
        <div className="mt-6">
          <p className="text-xs font-medium text-slate-400 mb-2.5">
            Choisir le protagoniste
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onSelectCharacter('lucia')}
              className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
                selectedCharacter === 'lucia'
                  ? 'border-[#ff5fa2] bg-[#ff5fa2]/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span className="font-display text-xl font-bold tracking-wide">
                LUCIA
              </span>
              <span className="mt-0.5 text-xs text-slate-400">
                Vice Beach · Pilote & Braqueuse
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectCharacter('jason')}
              className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
                selectedCharacter === 'jason'
                  ? 'border-[#2dd4bf] bg-[#2dd4bf]/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span className="font-display text-xl font-bold tracking-wide">
                JASON
              </span>
              <span className="mt-0.5 text-xs text-slate-400">
                Port Leonida · Ex-Militaire
              </span>
            </button>
          </div>
        </div>

        {/* Controls Quick Reference */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-white/10 pt-4 text-xs text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Déplacement / Conduite</span>
            <span className="font-mono-num text-white">ZQSD / Flèches</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Monter / Sortir</span>
            <span className="font-mono-num text-white">F ou E</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Sauter / Sortir</span>
            <span className="font-mono-num text-white">Bouton / Espace</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Nitro / Sprint</span>
            <span className="font-mono-num text-white">Maj</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#ff477e] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#ff2e6d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff477e] cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Entrer dans Vice City</span>
        </button>
      </div>
    </div>
  );
}
