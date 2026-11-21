import { useState } from 'react';
import {
  ArrowUp,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  Flag,
  Radio,
  Star,
  Sun,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { VirtualInputState } from '../game/engine';
import type {
  CameraMode,
  HudSnapshot,
  MissionId,
  RadioStation,
  TimeOfDay,
  VehicleKind,
} from '../game/types';
import { Minimap } from './Minimap';
import { VirtualJoystick } from './VirtualJoystick';

interface HudOverlayProps {
  hud: HudSnapshot;
  dockOpen: boolean;
  onToggleDock: () => void;
  onSpawnVehicle: (kind: VehicleKind) => void;
  onSetTimeOfDay: (tod: TimeOfDay) => void;
  onSetCameraMode: (mode: CameraMode) => void;
  onSetRadio: (station: RadioStation) => void;
  onToggleMute: () => void;
  onStartMission: (id: MissionId) => void;
  onVehicleToggle: () => void;
  onVirtualInput: (partial: Partial<VirtualInputState>) => void;
}

type DockTab = 'garage' | 'missions' | 'ambiance';

const GARAGE_OPTIONS: { id: VehicleKind; label: string }[] = [
  { id: 'banshee', label: 'Banshee' },
  { id: 'cheetah', label: 'Cheetah' },
  { id: 'gauntlet', label: 'Gauntlet' },
  { id: 'sandking', label: 'Sandking 4x4' },
  { id: 'police', label: 'VCPD' },
  { id: 'taxi', label: 'Vice Cab' },
];

export function HudOverlay({
  hud,
  dockOpen,
  onToggleDock,
  onSpawnVehicle,
  onSetTimeOfDay,
  onSetCameraMode,
  onSetRadio,
  onToggleMute,
  onStartMission,
  onVehicleToggle,
  onVirtualInput,
}: HudOverlayProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('garage');

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Bar Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Player Status & Active Objective */}
        <div className="pointer-events-auto flex flex-col gap-2 max-w-xs">
          <div className="rounded-lg border border-white/12 bg-[#0d0a18]/88 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <span className="font-display text-lg font-bold tracking-wide text-white">
                {hud.character === 'lucia' ? 'LUCIA' : 'JASON'}
              </span>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {hud.collectiblesFound}/{hud.totalCollectibles} Mallettes ·{' '}
                {hud.stuntsCompleted} Sauts
              </span>
            </div>

            {/* Health & Armor Bars */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/10">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{ width: `${hud.health}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/10">
                  <div
                    className="h-full bg-sky-400 transition-all duration-150"
                    style={{ width: `${hud.armor}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Active Mission Brief */}
          <div className="rounded-lg border border-white/12 bg-[#0d0a18]/88 px-3.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-amber-400 truncate">
                {hud.missionTitle}
              </span>
              {hud.missionId !== 'none' && (
                <span className="font-mono-num text-xs font-bold text-white whitespace-nowrap">
                  {hud.missionProgress} · {hud.missionTimer}s
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-300 leading-snug">
              {hud.missionObjective}
            </p>
          </div>
        </div>

        {/* Top-Right: Wanted Stars, Cash, Speedometer */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="rounded-lg border border-white/12 bg-[#0d0a18]/88 px-4 py-2.5 text-right">
            <div className="flex items-center justify-end gap-1.5">
              {[1, 2, 3, 4, 5].map((starIdx) => {
                const active = starIdx <= hud.wantedLevel;
                return (
                  <Star
                    key={starIdx}
                    className={`h-4 w-4 ${
                      active
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-white/15'
                    }`}
                  />
                );
              })}
            </div>

            <div className="font-mono-num mt-1 text-xl font-bold text-emerald-400">
              ${hud.cash.toLocaleString('fr-FR')}
            </div>
          </div>

          {hud.inVehicle && (
            <div className="rounded-lg border border-white/12 bg-[#0d0a18]/88 px-3.5 py-2 text-right min-w-[148px]">
              <div className="text-xs text-slate-400 truncate">
                {hud.vehicleName}
              </div>
              <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                <span className="font-mono-num text-2xl font-bold text-white">
                  {hud.speedKmh}
                </span>
                <span className="text-xs font-medium text-slate-400">KM/H</span>
              </div>
              {/* Nitro gauge */}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full bg-[#ff477e] transition-all duration-100"
                  style={{ width: `${hud.nitro}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Non-Blocking Banner & Interaction Prompt */}
      <div className="flex flex-col items-center justify-center gap-3">
        {hud.bannerText && (
          <div
            className={`rounded-lg border px-6 py-3 text-center shadow-xl ${
              hud.bannerTone === 'crimson'
                ? 'border-rose-500/40 bg-[#1a0a12]/92'
                : hud.bannerTone === 'cyan'
                  ? 'border-cyan-400/40 bg-[#08161f]/92'
                  : 'border-amber-400/40 bg-[#171208]/92'
            }`}
          >
            <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
              {hud.bannerText}
            </div>
            {hud.bannerSubtext && (
              <div className="mt-0.5 text-xs font-medium text-slate-200">
                {hud.bannerSubtext}
              </div>
            )}
          </div>
        )}

        {hud.promptAction && (
          <button
            type="button"
            onClick={onVehicleToggle}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/25 bg-[#ff477e] px-5 py-2.5 text-sm font-bold text-white shadow-xl hover:bg-[#ff2e6d] active:scale-95 transition-transform cursor-pointer"
          >
            <Car className="h-4 w-4" />
            <span>{hud.promptAction}</span>
          </button>
        )}
      </div>

      {/* Bottom Row: Radar (Left) + Collapsible Dock (Center) + Touch/Action (Right) */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: GTA Radar + Virtual Analog Joystick */}
        <div className="pointer-events-auto flex items-end gap-3">
          <div className="hidden sm:flex flex-col gap-1.5">
            <Minimap
              playerX={hud.playerX}
              playerZ={hud.playerZ}
              playerHeading={hud.playerHeading}
              blips={hud.blips}
              wantedLevel={hud.wantedLevel}
            />
            <div className="px-1 text-xs font-medium text-slate-200 drop-shadow">
              {hud.district}
            </div>
          </div>

          <VirtualJoystick
            onChange={(joyX, joyY) => onVirtualInput({ joyX, joyY })}
          />
        </div>

        {/* Bottom-Center: Collapsible Control Dock */}
        <div className="pointer-events-auto mx-auto flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleDock}
            className="mb-1.5 flex items-center gap-1.5 rounded-t-md border border-b-0 border-white/15 bg-[#0d0a18]/92 px-3 py-1 text-xs font-medium text-slate-200 hover:text-white cursor-pointer whitespace-nowrap"
          >
            {dockOpen ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Masquer (H)</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Panneau Vice City (H)</span>
              </>
            )}
          </button>

          {dockOpen && (
            <div className="w-full max-w-[min(92vw,720px)] rounded-xl border border-white/15 bg-[#0d0a18]/92 p-3 shadow-2xl">
              {/* Tab Headers + Quick Audio/Enter-Exit */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('garage')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'garage'
                        ? 'bg-[#ff477e] text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Car className="h-3.5 w-3.5" />
                    <span>Garage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('missions')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'missions'
                        ? 'bg-[#ff477e] text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span>Contrats</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ambiance')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'ambiance'
                        ? 'bg-[#ff477e] text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    <span>Monde & Radio</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onVehicleToggle}
                    className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/15 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {hud.inVehicle ? 'Sortir (F)' : 'Monter (F)'}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={hud.muted ? 'Activer le son' : 'Couper le son'}
                    className="rounded-md border border-white/15 bg-white/5 p-1.5 text-slate-200 hover:bg-white/15 cursor-pointer"
                  >
                    {hud.muted ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-emerald-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'garage' && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {GARAGE_OPTIONS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSpawnVehicle(v.id)}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-[#ff477e] hover:bg-[#ff477e]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'missions' && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onStartMission('ocean-sprint')}
                    className={`rounded-md border px-3 py-2 text-left transition-colors cursor-pointer ${
                      hud.missionId === 'ocean-sprint'
                        ? 'border-amber-400 bg-amber-400/15'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">
                      Livraison Ocean Drive
                    </div>
                    <div className="text-[11px] text-amber-300 mt-0.5">
                      Prime : $5,000
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartMission('armored-heist')}
                    className={`rounded-md border px-3 py-2 text-left transition-colors cursor-pointer ${
                      hud.missionId === 'armored-heist'
                        ? 'border-amber-400 bg-amber-400/15'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">
                      Braquage du Fourgon
                    </div>
                    <div className="text-[11px] text-amber-300 mt-0.5">
                      Prime : $8,500
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartMission('wanted-escape')}
                    className={`rounded-md border px-3 py-2 text-left transition-colors cursor-pointer ${
                      hud.missionId === 'wanted-escape'
                        ? 'border-rose-400 bg-rose-400/15'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">
                      Évasion 4 Étoiles
                    </div>
                    <div className="text-[11px] text-rose-300 mt-0.5">
                      Prime : $12,000
                    </div>
                  </button>
                </div>
              )}

              {activeTab === 'ambiance' && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                  {/* Time of day */}
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['day', 'Jour'],
                        ['sunset', 'Coucher de soleil'],
                        ['night', 'Nuit'],
                      ] as [TimeOfDay, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSetTimeOfDay(id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          hud.timeOfDay === id
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Camera */}
                  <div className="flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-slate-400 mr-1" />
                    {(
                      [
                        ['chase', 'Poursuite'],
                        ['far', 'Large'],
                        ['hood', 'Capot'],
                      ] as [CameraMode, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSetCameraMode(id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          hud.cameraMode === id
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Radio */}
                  <div className="flex items-center gap-1">
                    <Radio className="h-3.5 w-3.5 text-slate-400 mr-1" />
                    {(
                      [
                        ['vice-wave', 'Vice Wave FM'],
                        ['leonida-bass', 'Leonida Bass'],
                        ['off', 'Off'],
                      ] as [RadioStation, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSetRadio(id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          hud.radioStation === id
                            ? 'bg-[#ff477e] text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom-Right: Jump / Drift + Sprint / Nitro Action Buttons & Shortcut Legend */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onVirtualInput({ shift: true });
              }}
              onPointerUp={() => onVirtualInput({ shift: false })}
              onPointerLeave={() => onVirtualInput({ shift: false })}
              onPointerCancel={() => onVirtualInput({ shift: false })}
              className="flex h-12 min-w-[48px] items-center justify-center gap-1.5 rounded-full border border-white/20 bg-[#0d0a18]/90 px-3.5 text-xs font-bold text-slate-100 active:scale-95 active:border-cyan-400 active:bg-cyan-400/20 touch-none select-none cursor-pointer"
            >
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>{hud.inVehicle ? 'Nitro' : 'Sprint'}</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onVirtualInput({ space: true });
              }}
              onPointerUp={() => onVirtualInput({ space: false })}
              onPointerLeave={() => onVirtualInput({ space: false })}
              onPointerCancel={() => onVirtualInput({ space: false })}
              className="flex h-14 min-w-[56px] items-center justify-center gap-1.5 rounded-full border border-[#ff477e]/70 bg-[#ff477e]/90 px-4 text-xs font-bold text-white shadow-lg active:scale-95 active:bg-[#ff2e6d] touch-none select-none cursor-pointer"
            >
              <ArrowUp className="h-4 w-4" />
              <span>{hud.inVehicle ? 'Sortir (Sauter)' : 'Sauter'}</span>
            </button>
          </div>

          <div className="hidden lg:block rounded-md border border-white/10 bg-[#0d0a18]/80 px-2.5 py-1.5 text-right text-[11px] leading-relaxed text-slate-300">
            <div>Joystick ou ZQSD · Conduire / Marcher</div>
            <div>Sauter / Espace · Sortir · Maj Nitro · C Caméra</div>
          </div>
        </div>
      </div>
    </div>
  );
}
