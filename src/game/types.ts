export type CharacterId = 'lucia' | 'jason';

export type TimeOfDay = 'day' | 'sunset' | 'night';

export type CameraMode = 'chase' | 'far' | 'hood';

export type RadioStation = 'vice-wave' | 'leonida-bass' | 'off';

export type VehicleKind =
  | 'banshee'
  | 'cheetah'
  | 'gauntlet'
  | 'police'
  | 'sandking'
  | 'taxi';

export type MissionId = 'none' | 'ocean-sprint' | 'armored-heist' | 'wanted-escape';

export interface MinimapBlip {
  x: number;
  z: number;
  kind: 'vehicle' | 'police' | 'mission' | 'pickup' | 'ramp';
}

export interface HudSnapshot {
  started: boolean;
  character: CharacterId;
  health: number;
  armor: number;
  cash: number;
  wantedLevel: number;
  wantedCooldown: number; // 0..1
  inVehicle: boolean;
  vehicleName: string;
  speedKmh: number;
  nitro: number; // 0..100
  district: string;
  timeOfDay: TimeOfDay;
  cameraMode: CameraMode;
  radioStation: RadioStation;
  muted: boolean;
  missionId: MissionId;
  missionTitle: string;
  missionObjective: string;
  missionProgress: string;
  missionTimer: number;
  promptAction: string | null;
  bannerText: string | null;
  bannerSubtext: string | null;
  bannerTone: 'gold' | 'crimson' | 'cyan';
  wasted: boolean;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  blips: MinimapBlip[];
  stuntsCompleted: number;
  collectiblesFound: number;
  totalCollectibles: number;
}
