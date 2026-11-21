import { useCallback, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { StartScreen } from './components/StartScreen';
import { ViceCityEngine, type VirtualInputState } from './game/engine';
import type {
  CameraMode,
  CharacterId,
  HudSnapshot,
  MissionId,
  RadioStation,
  TimeOfDay,
  VehicleKind,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  started: false,
  character: 'lucia',
  health: 100,
  armor: 60,
  cash: 12500,
  wantedLevel: 0,
  wantedCooldown: 0,
  inVehicle: false,
  vehicleName: 'À pied',
  speedKmh: 0,
  nitro: 100,
  district: 'Ocean Drive · Quartier Art Déco',
  timeOfDay: 'sunset',
  cameraMode: 'chase',
  radioStation: 'vice-wave',
  muted: false,
  missionId: 'none',
  missionTitle: 'Exploration Libre',
  missionObjective: 'Parcourez Vice Beach, Ocean Drive et Downtown',
  missionProgress: '',
  missionTimer: 0,
  promptAction: null,
  bannerText: null,
  bannerSubtext: null,
  bannerTone: 'gold',
  wasted: false,
  playerX: 83,
  playerZ: 22,
  playerHeading: 0,
  blips: [],
  stuntsCompleted: 0,
  collectiblesFound: 0,
  totalCollectibles: 8,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ViceCityEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedChar, setSelectedChar] = useState<CharacterId>('lucia');
  const [dockOpen, setDockOpen] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new ViceCityEngine(
      mountEl,
      (snapshot) => setHud(snapshot),
      (lost) => setContextLost(lost),
    );
    engineRef.current = engine;

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) {
        setDockOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectCharacter = useCallback((char: CharacterId) => {
    setSelectedChar(char);
    engineRef.current?.setCharacter(char);
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startGame(selectedChar);
  }, [selectedChar]);

  const handleSpawnVehicle = useCallback((kind: VehicleKind) => {
    engineRef.current?.spawnPlayerVehicle(kind);
  }, []);

  const handleSetTimeOfDay = useCallback((tod: TimeOfDay) => {
    engineRef.current?.setTimeOfDay(tod);
  }, []);

  const handleSetCameraMode = useCallback((mode: CameraMode) => {
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleSetRadio = useCallback((station: RadioStation) => {
    engineRef.current?.setRadioStation(station);
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleStartMission = useCallback((id: MissionId) => {
    engineRef.current?.startMission(id);
  }, []);

  const handleVehicleToggle = useCallback(() => {
    engineRef.current?.triggerVehicleToggle();
  }, []);

  const handleVirtualInput = useCallback((partial: Partial<VirtualInputState>) => {
    engineRef.current?.setVirtualInput(partial);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0914]">
      {/* Dedicated empty Three.js WebGL mount container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Vue 3D de Leonida Vice City"
      />

      {contextLost && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b0914]/95 p-6 text-center">
          <div className="max-w-md rounded-xl border border-white/15 bg-[#141024] p-6">
            <h2 className="font-display text-2xl font-bold text-white">
              Contexte WebGL interrompu
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Le rendu 3D est en cours de réinitialisation par votre navigateur.
            </p>
          </div>
        </div>
      )}

      {!hud.started ? (
        <StartScreen
          selectedCharacter={selectedChar}
          onSelectCharacter={handleSelectCharacter}
          onStart={handleStart}
        />
      ) : (
        <HudOverlay
          hud={hud}
          dockOpen={dockOpen}
          onToggleDock={() => setDockOpen((prev) => !prev)}
          onSpawnVehicle={handleSpawnVehicle}
          onSetTimeOfDay={handleSetTimeOfDay}
          onSetCameraMode={handleSetCameraMode}
          onSetRadio={handleSetRadio}
          onToggleMute={handleToggleMute}
          onStartMission={handleStartMission}
          onVehicleToggle={handleVehicleToggle}
          onVirtualInput={handleVirtualInput}
        />
      )}
    </main>
  );
}
