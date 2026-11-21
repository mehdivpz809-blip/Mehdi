import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProceduralAudio } from './audio';
import {
  createCharacterModel,
  createVehicleModel,
  getVehicleSpecName,
  type CharacterVisualRig,
  type VehicleVisualRig,
} from './models';
import { createProceduralTextures, type ProceduralTextures } from './textures';
import type {
  CameraMode,
  CharacterId,
  HudSnapshot,
  MinimapBlip,
  MissionId,
  RadioStation,
  TimeOfDay,
  VehicleKind,
} from './types';
import { buildViceCityWorld, ROAD_XS, ROAD_ZS, type WorldHandles } from './world';

interface VehicleEntity {
  id: number;
  kind: VehicleKind;
  rig: VehicleVisualRig;
  x: number;
  y: number;
  z: number;
  vy: number;
  heading: number; // radians, 0 = +Z
  speed: number;
  steerAngle: number;
  aiMode: 'parked' | 'traffic' | 'police' | 'target' | 'player';
  aiAxis: 'x' | 'z';
  aiDir: number;
  aiSpeed: number;
  maxSpeed: number;
  accel: number;
  hp: number;
  airborneTime: number;
}

interface PedestrianEntity {
  rig: CharacterVisualRig;
  x: number;
  z: number;
  heading: number;
  walkPhase: number;
  speed: number;
  fleeTimer: number;
}

interface ParticleSpark {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export interface VirtualInputState {
  joyX: number; // -1 (left) to +1 (right)
  joyY: number; // -1 (backward/down) to +1 (forward/up)
  space: boolean;
  shift: boolean;
}

// Module-level reusable math helpers (Zero GC in tick loop)
const _camTarget = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class ViceCityEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onContextLostCb?: (lost: boolean) => void;

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextures;
  private world!: WorldHandles;
  private audio = new ProceduralAudio();

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private skyColor = new THREE.Color(0xff9b71);

  private playerRig!: CharacterVisualRig;
  private playerX = 83;
  private playerY = 0;
  private playerZ = 22;
  private playerVy = 0;
  private playerHeading = 0;
  private playerWalkPhase = 0;
  private playerGrounded = true;

  private character: CharacterId = 'lucia';
  private started = false;
  private health = 100;
  private armor = 60;
  private cash = 12500;
  private wantedLevel = 0;
  private wantedCooldown = 0;
  private nitro = 100;
  private wasted = false;
  private wastedTimer = 0;

  private timeOfDay: TimeOfDay = 'sunset';
  private cameraMode: CameraMode = 'chase';
  private radioStation: RadioStation = 'vice-wave';
  private muted = false;

  private vehicles: VehicleEntity[] = [];
  private activeVehicle: VehicleEntity | null = null;
  private nextVehicleId = 1;
  private pedestrians: PedestrianEntity[] = [];
  private particles: ParticleSpark[] = [];
  private particleGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);

  // Mission state
  private missionId: MissionId = 'none';
  private missionTimer = 0;
  private missionStep = 0;
  private missionCheckpoints: [number, number][] = [];
  private missionBeacon!: THREE.Group;
  private targetVan: VehicleEntity | null = null;

  private stuntsCompleted = 0;
  private collectiblesFound = 0;

  private bannerText: string | null = null;
  private bannerSubtext: string | null = null;
  private bannerTone: 'gold' | 'crimson' | 'cyan' = 'gold';
  private bannerTimer = 0;

  private keys = new Set<string>();
  private prevSpaceInput = false;
  private virtualInput: VirtualInputState = {
    joyX: 0,
    joyY: 0,
    space: false,
    shift: false,
  };

  private clock = new THREE.Clock();
  private elapsed = 0;
  private hudEmitAcc = 0;
  private frameId = 0;
  private disposed = false;

  private camPosCurrent = new THREE.Vector3(72, 16, 46);
  private camLookCurrent = new THREE.Vector3(90, 2, 18);
  private shakeIntensity = 0;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onContextLost?: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLostCb = onContextLost;
    this.init();
  }

  private init() {
    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    this.scene.background = this.skyColor.clone();
    this.scene.fog = new THREE.FogExp2(0xff9b71, 0.0026);

    const aspect = (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.3, 900);
    this.camera.position.copy(this.camPosCurrent);

    // Mandatory studio environment map via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xffb58a, 0x26294a, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffcda3, 2.2);
    this.sunLight.position.set(120, 65, -80);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      const d = 135;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 360;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Textures & World
    this.textures = createProceduralTextures(
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.world = buildViceCityWorld(this.scene, this.textures, this.isSoftwareGl);

    // Player Character
    this.playerRig = createCharacterModel(
      this.character,
      this.textures.contactShadow,
      !this.isSoftwareGl,
    );
    this.playerRig.group.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.playerRig.group);

    // Mission Checkpoint Beacon
    this.missionBeacon = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 26, 20, 1, true), beamMat);
    beam.position.y = 13;
    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }),
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.08;
    this.missionBeacon.add(beam, baseRing);
    this.missionBeacon.visible = false;
    this.scene.add(this.missionBeacon);

    // Spawn Hero Parked Supercar & City Traffic
    this.spawnHeroCars();
    this.spawnTraffic();
    this.spawnPedestrians();

    // Apply initial sunset lighting
    this.applyTimeOfDay('sunset');

    // Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Events
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.emitHud();
    this.tick();
  }

  private spawnHeroCars() {
    // Player's starter Banshee Leonida right on Ocean Drive
    this.addVehicle('banshee', 90, 18, 0, 'parked', 0xff3b7f);
    // Cheetah Classic parked up Ocean Drive
    this.addVehicle('cheetah', 90, -52, Math.PI, 'parked', 0xf8fafc);
    // Gauntlet Hellfire near Downtown Plaza
    this.addVehicle('gauntlet', -45, 12, Math.PI / 2, 'parked', 0xf59e0b);
    // Sandking 4x4 on Vice Beach
    this.addVehicle('sandking', 124, -18, 0.3, 'parked', 0x38bdf8);
    // Airport Runway Supercar
    this.addVehicle('banshee', -335, 18, 0, 'parked', 0x22d3ee);
    // Little Leonida Exotic
    this.addVehicle('cheetah', -135, 130, -Math.PI / 2, 'parked', 0xa855f7);
  }

  private spawnTraffic() {
    const trafficKinds: VehicleKind[] = ['taxi', 'cheetah', 'gauntlet', 'sandking', 'banshee'];
    const trafficColors = [0xfacc15, 0xec4899, 0x38bdf8, 0xf97316, 0xa855f7, 0x10b981, 0xe2e8f0];

    for (let i = 0; i < 24; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir = i % 4 < 2 ? 1 : -1;
      let x = 0;
      let z = 0;
      if (axis === 'z') {
        const rx = ROAD_XS[i % ROAD_XS.length];
        x = rx + (dir > 0 ? -3.4 : 3.4);
        z = -310 + ((i * 53) % 620);
      } else {
        const rz = ROAD_ZS[i % ROAD_ZS.length];
        z = rz + (dir > 0 ? 3.4 : -3.4);
        x = -270 + ((i * 47) % 360);
      }
      const kind = trafficKinds[i % trafficKinds.length];
      const color = kind === 'taxi' ? 0xfacc15 : trafficColors[i % trafficColors.length];
      const heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.addVehicle(kind, x, z, heading, 'traffic', color, axis, dir);
    }
  }

  private spawnPedestrians() {
    const shirtColors = [0xff4d8d, 0x2dd4bf, 0xfbbf24, 0xf8fafc, 0x60a5fa, 0xc084fc];
    for (let i = 0; i < 32; i++) {
      const onBoardwalk = i < 14;
      const x = onBoardwalk ? 101 + (i % 2) * 3 : -245 + ((i * 61) % 330);
      const z = -310 + i * 20;
      const rig = createCharacterModel(
        'pedestrian',
        this.textures.contactShadow,
        !this.isSoftwareGl,
        shirtColors[i % shirtColors.length],
      );
      rig.group.position.set(x, 0, z);
      this.scene.add(rig.group);
      this.pedestrians.push({
        rig,
        x,
        z,
        heading: i % 2 === 0 ? 0 : Math.PI,
        walkPhase: Math.random() * Math.PI * 2,
        speed: 1.8 + Math.random() * 0.8,
        fleeTimer: 0,
      });
    }
  }

  private addVehicle(
    kind: VehicleKind,
    x: number,
    z: number,
    heading: number,
    aiMode: VehicleEntity['aiMode'],
    colorOverride?: number,
    aiAxis: 'x' | 'z' = 'z',
    aiDir = 1,
  ): VehicleEntity {
    const rig = createVehicleModel(
      kind,
      this.textures.contactShadow,
      !this.isSoftwareGl,
      colorOverride,
    );
    rig.group.position.set(x, 0, z);
    rig.group.rotation.y = heading;
    this.scene.add(rig.group);

    const maxSpeedMap: Record<VehicleKind, number> = {
      banshee: 52,
      cheetah: 50,
      gauntlet: 46,
      police: 49,
      sandking: 40,
      taxi: 38,
    };

    const entity: VehicleEntity = {
      id: this.nextVehicleId++,
      kind,
      rig,
      x,
      y: 0,
      z,
      vy: 0,
      heading,
      speed: aiMode === 'traffic' ? 12 + Math.random() * 4 : 0,
      steerAngle: 0,
      aiMode,
      aiAxis,
      aiDir,
      aiSpeed: 12 + Math.random() * 4,
      maxSpeed: maxSpeedMap[kind],
      accel: kind === 'banshee' || kind === 'cheetah' ? 28 : 22,
      hp: 100,
      airborneTime: 0,
    };
    this.vehicles.push(entity);
    return entity;
  }

  // Public Controls
  public startGame(charId: CharacterId) {
    this.audio.unlock();
    this.setCharacter(charId);
    this.started = true;
    this.showBanner('BIENVENUE À LEONIDA', 'Ocean Drive · Vice City', 'gold');
    this.emitHud();
  }

  public setCharacter(charId: CharacterId) {
    if (this.character === charId) return;
    this.character = charId;
    const wasVisible = this.playerRig.group.visible;
    this.scene.remove(this.playerRig.group);
    this.playerRig = createCharacterModel(
      charId,
      this.textures.contactShadow,
      !this.isSoftwareGl,
    );
    this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.group.rotation.y = this.playerHeading;
    this.playerRig.group.visible = wasVisible;
    this.scene.add(this.playerRig.group);
    this.emitHud();
  }

  public setTimeOfDay(tod: TimeOfDay) {
    this.timeOfDay = tod;
    this.applyTimeOfDay(tod);
    this.emitHud();
  }

  private applyTimeOfDay(tod: TimeOfDay) {
    if (tod === 'day') {
      this.skyColor.setHex(0x63c5f7);
      this.scene.background = this.skyColor.clone();
      (this.scene.fog as THREE.FogExp2).color.copy(this.skyColor);
      (this.scene.fog as THREE.FogExp2).density = 0.0021;
      this.sunLight.color.setHex(0xfff5e0);
      this.sunLight.intensity = 2.4;
      this.sunLight.position.set(90, 140, 60);
      this.hemiLight.color.setHex(0x9ee0ff);
      this.hemiLight.groundColor.setHex(0x6b604e);
      this.hemiLight.intensity = 0.95;
      this.world.lampBulbMaterial.emissiveIntensity = 0.1;
      this.world.neonMaterials.forEach((m) => (m.emissiveIntensity = 0.25));
      this.vehicles.forEach((v) => (v.rig.headlightMat.emissiveIntensity = 0.35));
    } else if (tod === 'sunset') {
      this.skyColor.setHex(0xff8c6b);
      this.scene.background = this.skyColor.clone();
      (this.scene.fog as THREE.FogExp2).color.copy(this.skyColor);
      (this.scene.fog as THREE.FogExp2).density = 0.0026;
      this.sunLight.color.setHex(0xffbe88);
      this.sunLight.intensity = 2.2;
      this.sunLight.position.set(130, 58, -80);
      this.hemiLight.color.setHex(0xffa996);
      this.hemiLight.groundColor.setHex(0x282442);
      this.hemiLight.intensity = 0.85;
      this.world.lampBulbMaterial.emissiveIntensity = 1.4;
      this.world.neonMaterials.forEach((m) => (m.emissiveIntensity = 1.35));
      this.vehicles.forEach((v) => (v.rig.headlightMat.emissiveIntensity = 1.6));
    } else {
      this.skyColor.setHex(0x0c0b1d);
      this.scene.background = this.skyColor.clone();
      (this.scene.fog as THREE.FogExp2).color.copy(this.skyColor);
      (this.scene.fog as THREE.FogExp2).density = 0.0032;
      this.sunLight.color.setHex(0x7aa2ff);
      this.sunLight.intensity = 0.72;
      this.sunLight.position.set(-80, 110, -70);
      this.hemiLight.color.setHex(0x2e2a5c);
      this.hemiLight.groundColor.setHex(0x0f0d1a);
      this.hemiLight.intensity = 0.65;
      this.world.lampBulbMaterial.emissiveIntensity = 2.6;
      this.world.neonMaterials.forEach((m) => (m.emissiveIntensity = 2.4));
      this.vehicles.forEach((v) => (v.rig.headlightMat.emissiveIntensity = 2.8));
    }
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.emitHud();
  }

  public cycleCameraMode() {
    const order: CameraMode[] = ['chase', 'far', 'hood'];
    const idx = (order.indexOf(this.cameraMode) + 1) % order.length;
    this.setCameraMode(order[idx]);
  }

  public setRadioStation(station: RadioStation) {
    this.audio.unlock();
    this.radioStation = station;
    this.audio.setStation(station);
    this.emitHud();
  }

  public toggleMute() {
    this.audio.unlock();
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.emitHud();
  }

  public spawnPlayerVehicle(kind: VehicleKind) {
    this.audio.unlock();
    const spawnX = this.playerX + Math.sin(this.playerHeading) * 5.2;
    const spawnZ = this.playerZ + Math.cos(this.playerHeading) * 5.2;
    const clampedX = THREE.MathUtils.clamp(spawnX, -355, 195);
    const clampedZ = THREE.MathUtils.clamp(spawnZ, -350, 350);
    const car = this.addVehicle(kind, clampedX, clampedZ, this.playerHeading, 'parked');
    if (this.activeVehicle) {
      this.exitVehicle(false);
    }
    this.enterVehicle(car);
    this.showBanner(getVehicleSpecName(kind), 'Livré devant votre position', 'cyan');
    this.emitHud();
  }

  public startMission(id: MissionId) {
    this.audio.unlock();
    // Clean up previous target van
    if (this.targetVan) {
      this.scene.remove(this.targetVan.rig.group);
      this.vehicles = this.vehicles.filter((v) => v !== this.targetVan);
      this.targetVan = null;
    }

    this.missionId = id;
    this.missionStep = 0;

    if (id === 'ocean-sprint') {
      this.missionCheckpoints = [
        [90, -90],
        [90, -270],
        [0, -270],
        [-90, -90],
        [0, 180],
      ];
      this.missionTimer = 115;
      this.missionBeacon.visible = true;
      this.missionBeacon.position.set(this.missionCheckpoints[0][0], 0, this.missionCheckpoints[0][1]);
      this.showBanner('CONTRAT : OCEAN DRIVE', 'Passez les 5 balises avant la fin du chrono', 'gold');
    } else if (id === 'armored-heist') {
      this.missionTimer = 135;
      const van = this.addVehicle('sandking', -90, -90, 0, 'target', 0xfacc15, 'z', 1);
      van.aiSpeed = 17;
      this.targetVan = van;
      this.missionBeacon.visible = true;
      this.missionBeacon.position.set(van.x, 0, van.z);
      this.showBanner('BRAQUAGE DU FOURGON', 'Interceptez et capturez le 4x4 doré', 'gold');
    } else if (id === 'wanted-escape') {
      this.missionTimer = 120;
      this.missionBeacon.visible = false;
      this.setWantedLevel(4);
      this.showBanner('ÉVASION VCPD 4 ÉTOILES', 'Semez la police jusqu’à perdre votre avis de recherche', 'crimson');
    } else {
      this.missionBeacon.visible = false;
    }
    this.emitHud();
  }

  public setVirtualInput(partial: Partial<VirtualInputState>) {
    Object.assign(this.virtualInput, partial);
  }

  public triggerVehicleToggle() {
    this.audio.unlock();
    if (!this.started || this.wasted) return;
    if (this.activeVehicle) {
      this.exitVehicle(true);
    } else {
      const nearest = this.findNearestVehicle(8.0);
      if (nearest) {
        this.enterVehicle(nearest);
      }
    }
    this.emitHud();
  }

  private findNearestVehicle(maxDist: number): VehicleEntity | null {
    let best: VehicleEntity | null = null;
    let bestDistSq = maxDist * maxDist;
    for (const v of this.vehicles) {
      const dx = v.x - this.playerX;
      const dz = v.z - this.playerZ;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = v;
      }
    }
    return best;
  }

  private enterVehicle(v: VehicleEntity) {
    if (v.kind === 'police' && v.aiMode !== 'player') {
      this.setWantedLevel(Math.max(this.wantedLevel, 2));
    } else if (v.aiMode === 'traffic') {
      this.setWantedLevel(Math.max(this.wantedLevel, 1));
    }
    if (v === this.targetVan) {
      // Hijacked the armored heist truck!
      this.completeMission(8500, 'FOURGON CAPTURÉ !');
    }
    this.activeVehicle = v;
    v.aiMode = 'player';
    this.playerRig.group.visible = false;
    this.audio.playDoorChime();
  }

  private exitVehicle(jumpOut = false) {
    if (!this.activeVehicle) return;
    const v = this.activeVehicle;
    const sideX = v.x - Math.cos(v.heading) * (v.rig.halfWidth + 1.25);
    const sideZ = v.z + Math.sin(v.heading) * (v.rig.halfWidth + 1.25);
    this.playerX = sideX;
    this.playerZ = sideZ;
    this.playerY = this.world.getGroundHeightAt(sideX, sideZ);
    this.playerHeading = v.heading;
    if (jumpOut) {
      this.playerVy = 6.2;
      this.playerGrounded = false;
    }
    v.aiMode = 'parked';
    this.activeVehicle = null;
    this.playerRig.group.visible = true;
    this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.audio.playDoorChime();
  }

  private setWantedLevel(level: number) {
    const clamped = THREE.MathUtils.clamp(level, 0, 5);
    if (clamped > this.wantedLevel) {
      this.wantedCooldown = 1;
    }
    this.wantedLevel = clamped;
    this.syncPoliceCount();
  }

  private syncPoliceCount() {
    const currentPolice = this.vehicles.filter((v) => v.aiMode === 'police').length;
    const desired = Math.min(4, this.wantedLevel);
    if (currentPolice < desired) {
      const rx = ROAD_XS[Math.floor(Math.random() * ROAD_XS.length)];
      const rz = ROAD_ZS[Math.floor(Math.random() * ROAD_ZS.length)];
      // Ensure spawn is some distance away from player
      const sx = Math.abs(rx - this.playerX) < 35 ? rx + 70 : rx;
      const sz = Math.abs(rz - this.playerZ) < 35 ? rz + 70 : rz;
      this.addVehicle('police', sx, sz, 0, 'police');
    } else if (this.wantedLevel === 0) {
      // Release police back to traffic/despawn far ones
      this.vehicles = this.vehicles.filter((v) => {
        if (v.aiMode === 'police') {
          this.scene.remove(v.rig.group);
          return false;
        }
        return true;
      });
    }
  }

  private completeMission(reward: number, title: string) {
    this.cash += reward;
    this.audio.playCashChime();
    this.showBanner(title, `+$${reward.toLocaleString('fr-FR')}`, 'gold');
    this.missionId = 'none';
    this.missionBeacon.visible = false;
    if (this.targetVan && this.targetVan !== this.activeVehicle) {
      this.scene.remove(this.targetVan.rig.group);
      this.vehicles = this.vehicles.filter((v) => v !== this.targetVan);
    }
    this.targetVan = null;
  }

  private showBanner(text: string, subtext: string, tone: 'gold' | 'crimson' | 'cyan') {
    this.bannerText = text;
    this.bannerSubtext = subtext;
    this.bannerTone = tone;
    this.bannerTimer = 3.6;
  }

  private spawnSparks(x: number, y: number, z: number, colorHex: number, count = 6) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y + 0.4, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 10,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 10,
        life: 0.45 + Math.random() * 0.25,
      });
    }
  }

  private resolveBuildingCollision(x: number, z: number, radius: number): [number, number, boolean] {
    let rx = x;
    let rz = z;
    let hit = false;
    for (const b of this.world.buildings) {
      const minX = b.minX - radius;
      const maxX = b.maxX + radius;
      const minZ = b.minZ - radius;
      const maxZ = b.maxZ + radius;
      if (rx > minX && rx < maxX && rz > minZ && rz < maxZ) {
        hit = true;
        const dLeft = rx - minX;
        const dRight = maxX - rx;
        const dTop = rz - minZ;
        const dBottom = maxZ - rz;
        const minPen = Math.min(dLeft, dRight, dTop, dBottom);
        if (minPen === dLeft) rx = minX;
        else if (minPen === dRight) rx = maxX;
        else if (minPen === dTop) rz = minZ;
        else rz = maxZ;
      }
    }
    return [rx, rz, hit];
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, 0.05);
    this.elapsed += dt;

    // Ocean animation
    this.world.oceanUniforms.uTime.value = this.elapsed;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
        this.bannerSubtext = null;
      }
    }

    // Rotate collectibles
    for (const c of this.world.collectibles) {
      if (!c.collected) {
        c.mesh.rotation.y = this.elapsed * 1.8;
      }
    }

    if (!this.started) {
      // Title Screen Cinematic Skyline Orbit over Vice Beach & Ocean Drive
      const angle = this.elapsed * 0.14;
      const tx = 70 + Math.cos(angle) * 58;
      const tz = Math.sin(angle) * 65;
      this.camera.position.set(tx, 26 + Math.sin(this.elapsed * 0.3) * 3, tz);
      this.camera.lookAt(55, 9, 0);
      this.updateVehicles(dt);
      this.updatePedestrians(dt);
    } else if (this.wasted) {
      this.wastedTimer -= dt;
      if (this.wastedTimer <= 0) {
        this.respawnPlayer();
      }
      this.updateCamera(dt);
    } else {
      this.updatePlayerOrActiveVehicle(dt);
      this.updateVehicles(dt);
      this.updatePedestrians(dt);
      this.updateCollectiblesAndMissions(dt);
      this.updateWantedSystem(dt);
      this.updateParticles(dt);
      this.updateCamera(dt);
    }

    // Shadow camera follows player smoothly
    this.sunLight.target.position.set(this.playerX, 0, this.playerZ);
    this.sunLight.target.updateMatrixWorld();

    // Update procedural audio
    const speedNorm = this.activeVehicle
      ? Math.min(1, Math.abs(this.activeVehicle.speed) / this.activeVehicle.maxSpeed)
      : 0;
    const isDrifting =
      Boolean(this.activeVehicle) &&
      (this.keys.has('Space') || this.virtualInput.space) &&
      speedNorm > 0.25;
    let policeDistMin = 999;
    if (this.wantedLevel > 0) {
      for (const v of this.vehicles) {
        if (v.aiMode === 'police') {
          const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
          if (d < policeDistMin) policeDistMin = d;
        }
      }
    }
    const policeProximity = policeDistMin < 110 ? 1 - policeDistMin / 110 : 0;
    this.audio.updateContinuous(
      Boolean(this.activeVehicle),
      speedNorm,
      isDrifting,
      policeProximity,
      this.elapsed,
      this.started && !this.wasted,
    );

    this.renderer.render(this.scene, this.camera);

    this.hudEmitAcc += dt;
    if (this.hudEmitAcc >= 0.065) {
      this.hudEmitAcc = 0;
      this.emitHud();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private respawnPlayer() {
    this.wasted = false;
    this.health = 100;
    this.armor = 50;
    this.cash = Math.max(0, this.cash - 500);
    this.setWantedLevel(0);
    if (this.activeVehicle) {
      this.exitVehicle();
    }
    this.playerX = 83;
    this.playerZ = 22;
    this.playerY = 0;
    this.playerRig.group.position.set(this.playerX, 0, this.playerZ);
    this.showBanner('SORTIE DE L’HÔPITAL VICE', 'Frais médicaux : -$500', 'cyan');
  }

  private updatePlayerOrActiveVehicle(dt: number) {
    const keyFwd =
      this.keys.has('KeyW') ||
      this.keys.has('KeyZ') ||
      this.keys.has('ArrowUp');
    const keyBack =
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown');
    const keyLeft =
      this.keys.has('KeyA') ||
      this.keys.has('KeyQ') ||
      this.keys.has('ArrowLeft');
    const keyRight =
      this.keys.has('KeyD') ||
      this.keys.has('ArrowRight');

    const throttleAxis = THREE.MathUtils.clamp(
      (keyFwd ? 1 : 0) - (keyBack ? 1 : 0) + this.virtualInput.joyY,
      -1,
      1,
    );
    const steerAxis = THREE.MathUtils.clamp(
      (keyLeft ? 1 : 0) - (keyRight ? 1 : 0) - this.virtualInput.joyX,
      -1,
      1,
    );

    const space = this.keys.has('Space') || this.virtualInput.space;
    const spaceJustPressed = space && !this.prevSpaceInput;
    this.prevSpaceInput = space;

    const shift =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.virtualInput.shift;

    if (this.activeVehicle) {
      // Pressing Jump (Space / Sauter button) exits the vehicle with a hop
      if (spaceJustPressed) {
        this.exitVehicle(true);
        return;
      }

      const car = this.activeVehicle;
      const boostActive = shift && this.nitro > 2 && throttleAxis > 0.1;
      if (boostActive) {
        this.nitro = Math.max(0, this.nitro - dt * 28);
      } else {
        this.nitro = Math.min(100, this.nitro + dt * 11);
      }

      const maxSpd = boostActive ? car.maxSpeed * 1.32 : car.maxSpeed;
      const accel = boostActive ? car.accel * 1.55 : car.accel;

      if (throttleAxis > 0.08) {
        car.speed += accel * throttleAxis * dt;
      } else if (throttleAxis < -0.08) {
        car.speed += (car.speed > 0 ? accel * 1.6 : accel * 0.7) * throttleAxis * dt;
      } else {
        car.speed = THREE.MathUtils.damp(car.speed, 0, 1.8, dt);
      }

      car.speed = THREE.MathUtils.clamp(car.speed, -18, maxSpd);

      const targetSteer = steerAxis * 0.55;
      car.steerAngle = THREE.MathUtils.damp(car.steerAngle, targetSteer, 11, dt);

      const speedFactor = THREE.MathUtils.clamp(Math.abs(car.speed) / 9, 0, 1);
      const turnRate = 2.25 * speedFactor * (car.speed >= 0 ? 1 : -1);
      car.heading += car.steerAngle * turnRate * dt;

      // Move vehicle
      const nextX = car.x + Math.sin(car.heading) * car.speed * dt;
      const nextZ = car.z + Math.cos(car.heading) * car.speed * dt;
      const [colX, colZ, hitBld] = this.resolveBuildingCollision(nextX, nextZ, 1.55);

      if (hitBld && Math.abs(car.speed) > 9) {
        this.audio.playImpact(Math.abs(car.speed) / 35);
        this.shakeIntensity = Math.min(0.8, Math.abs(car.speed) / 45);
        this.spawnSparks(colX, car.y + 0.5, colZ, 0xfbbf24, 6);
        car.speed *= -0.35;
      } else if (hitBld) {
        car.speed *= 0.2;
      }

      car.x = THREE.MathUtils.clamp(colX, -365, 225);
      car.z = THREE.MathUtils.clamp(colZ, -365, 365);

      // Ground height & ramp airtime
      const groundY = this.world.getGroundHeightAt(car.x, car.z);
      const prevY = car.y;
      if (car.y > groundY + 0.08 || car.vy > 0.2) {
        car.vy -= 22 * dt;
        car.y += car.vy * dt;
        car.airborneTime += dt;
        if (car.y <= groundY) {
          car.y = groundY;
          if (car.airborneTime > 0.65 && Math.abs(car.speed) > 16) {
            this.stuntsCompleted++;
            this.cash += 2500;
            this.audio.playCashChime();
            this.showBanner('SAUT UNIQUE RÉUSSI !', '+$2,500 Bonus Cascade', 'gold');
          }
          car.vy = 0;
          car.airborneTime = 0;
        }
      } else {
        car.y = groundY;
        // Launch if driving fast up a ramp edge!
        const dy = groundY - prevY;
        if (dy > 0.04 && Math.abs(car.speed) > 15) {
          car.vy = Math.min(13, (dy / Math.max(dt, 0.016)) * 1.15);
        } else {
          car.vy = 0;
        }
      }

      // Ocean water hazard
      if (car.x > 186 && car.y < 0.2) {
        this.health = Math.max(0, this.health - dt * 28);
        car.speed *= 0.92;
        if (this.health <= 0) {
          this.triggerWasted();
        }
      }

      // Visual sync
      car.rig.group.position.set(car.x, car.y, car.z);
      car.rig.group.rotation.y = car.heading;
      // Subtle body pitch/roll
      car.rig.group.rotation.z = THREE.MathUtils.damp(
        car.rig.group.rotation.z,
        car.steerAngle * speedFactor * 0.09,
        8,
        dt,
      );
      car.rig.frontSteerPivots.forEach((p) => (p.rotation.y = car.steerAngle * 0.65));
      car.rig.wheels.forEach((w) => (w.rotation.x += (car.speed * dt) / 0.36));

      // Sync player position to vehicle
      this.playerX = car.x;
      this.playerY = car.y;
      this.playerZ = car.z;
      this.playerHeading = car.heading;
    } else {
      // On-foot Movement (camera-relative, analog magnitude supported)
      this.nitro = Math.min(100, this.nitro + dt * 14);
      const moveForward = throttleAxis;
      const moveSide = THREE.MathUtils.clamp(
        (keyRight ? 1 : 0) - (keyLeft ? 1 : 0) + this.virtualInput.joyX,
        -1,
        1,
      );

      const mag = Math.min(1, Math.hypot(moveForward, moveSide));
      let moving = false;
      if (mag > 0.12) {
        moving = true;
        this.camera.getWorldDirection(_fwd);
        _fwd.y = 0;
        _fwd.normalize();
        _right.crossVectors(_fwd, THREE.Object3D.DEFAULT_UP).normalize();

        const moveDirX = _fwd.x * moveForward + _right.x * moveSide;
        const moveDirZ = _fwd.z * moveForward + _right.z * moveSide;
        const targetHeading = Math.atan2(moveDirX, moveDirZ);
        // Shortest angle wrap
        let diff = targetHeading - this.playerHeading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerHeading += diff * Math.min(1, dt * 12);

        const walkSpeed = (shift ? 11.5 : 6.4) * mag;
        const nx = this.playerX + Math.sin(this.playerHeading) * walkSpeed * dt;
        const nz = this.playerZ + Math.cos(this.playerHeading) * walkSpeed * dt;
        const [cx, cz] = this.resolveBuildingCollision(nx, nz, 0.55);
        this.playerX = THREE.MathUtils.clamp(cx, -365, 220);
        this.playerZ = THREE.MathUtils.clamp(cz, -365, 365);

        this.playerWalkPhase += dt * (shift ? 13 : 8.5) * mag;
      }

      const groundY = this.world.getGroundHeightAt(this.playerX, this.playerZ);
      if (space && this.playerGrounded) {
        this.playerVy = 8.4;
        this.playerGrounded = false;
      }
      if (!this.playerGrounded || this.playerY > groundY + 0.02) {
        this.playerVy -= 22 * dt;
        this.playerY += this.playerVy * dt;
        if (this.playerY <= groundY) {
          this.playerY = groundY;
          this.playerVy = 0;
          this.playerGrounded = true;
        }
      } else {
        this.playerY = groundY;
      }

      this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.group.rotation.y = this.playerHeading;

      const swing = moving ? Math.sin(this.playerWalkPhase) * 0.65 : 0;
      this.playerRig.leftLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.leftLeg.rotation.x, swing, 14, dt);
      this.playerRig.rightLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.rightLeg.rotation.x, -swing, 14, dt);
      this.playerRig.leftArm.rotation.x = THREE.MathUtils.damp(this.playerRig.leftArm.rotation.x, -swing * 0.85, 14, dt);
      this.playerRig.rightArm.rotation.x = THREE.MathUtils.damp(this.playerRig.rightArm.rotation.x, swing * 0.85, 14, dt);
    }
  }

  private updateVehicles(dt: number) {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      // Police flashing lightbar
      if (v.kind === 'police' && v.rig.sirenRedMat && v.rig.sirenBlueMat) {
        const flash = Math.sin(this.elapsed * 16 + v.id) > 0;
        const active = v.aiMode === 'police' || v.aiMode === 'player';
        v.rig.sirenRedMat.emissiveIntensity = active ? (flash ? 3.4 : 0.25) : 0.25;
        v.rig.sirenBlueMat.emissiveIntensity = active ? (!flash ? 3.4 : 0.25) : 0.25;
      }

      if (v.aiMode === 'player') continue;

      if (v.aiMode === 'traffic' || v.aiMode === 'target') {
        // Stop cleanly when player stands in front of or right beside a traffic car
        let targetTrafficSpeed = v.aiSpeed;
        if (v.aiMode === 'traffic' && !this.activeVehicle && this.started) {
          const pdx = this.playerX - v.x;
          const pdz = this.playerZ - v.z;
          const pDist = Math.hypot(pdx, pdz);
          const fwdDot = pdx * Math.sin(v.heading) + pdz * Math.cos(v.heading);
          if (pDist < 12 && fwdDot > -2.5) {
            targetTrafficSpeed = 0;
          }
        }
        v.speed = THREE.MathUtils.damp(v.speed, targetTrafficSpeed, targetTrafficSpeed === 0 ? 9 : 3.5, dt);

        if (v.aiAxis === 'z') {
          v.z += v.aiDir * v.speed * dt;
          if (v.z > 335 || v.z < -335) v.aiDir *= -1;
          v.heading = v.aiDir > 0 ? 0 : Math.PI;
        } else {
          v.x += v.aiDir * v.speed * dt;
          if (v.x > 96 || v.x < -285) v.aiDir *= -1;
          v.heading = v.aiDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        v.rig.group.position.set(v.x, 0, v.z);
        v.rig.group.rotation.y = v.heading;
        v.rig.wheels.forEach((w) => (w.rotation.x += (v.speed * dt) / 0.36));
      } else if (v.aiMode === 'police') {
        const dx = this.playerX - v.x;
        const dz = this.playerZ - v.z;
        const dist = Math.hypot(dx, dz);
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - v.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        v.heading += THREE.MathUtils.clamp(diff, -2.4 * dt, 2.4 * dt);

        const chaseSpeed = dist > 18 ? 27 : 18;
        const nx = v.x + Math.sin(v.heading) * chaseSpeed * dt;
        const nz = v.z + Math.cos(v.heading) * chaseSpeed * dt;
        const [cx, cz, hitBld] = this.resolveBuildingCollision(nx, nz, 1.5);
        v.x = THREE.MathUtils.clamp(cx, -365, 215);
        v.z = THREE.MathUtils.clamp(cz, -360, 360);
        if (hitBld) v.heading += 0.9 * dt;

        v.rig.group.position.set(v.x, 0, v.z);
        v.rig.group.rotation.y = v.heading;
        v.rig.wheels.forEach((w) => (w.rotation.x += (chaseSpeed * dt) / 0.36));

        // Police ram damage if close to player
        if (dist < 3.4 && this.started && !this.wasted) {
          this.damagePlayer(14 * dt);
        }
      }

      // Player vehicle vs AI vehicle collision
      if (this.activeVehicle && this.activeVehicle !== v) {
        const dx = this.activeVehicle.x - v.x;
        const dz = this.activeVehicle.z - v.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 11.5 && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;
          const push = (3.4 - dist) * 0.5;
          this.activeVehicle.x += nx * push;
          this.activeVehicle.z += nz * push;
          v.x -= nx * push;
          v.z -= nz * push;

          if (Math.abs(this.activeVehicle.speed) > 11) {
            this.audio.playImpact(0.75);
            this.shakeIntensity = 0.45;
            this.spawnSparks((this.activeVehicle.x + v.x) * 0.5, 0.7, (this.activeVehicle.z + v.z) * 0.5, 0xff5500, 5);
            this.activeVehicle.speed *= 0.65;
            if (v.kind === 'police' || Math.abs(this.activeVehicle.speed) > 16) {
              this.setWantedLevel(Math.max(this.wantedLevel, v.kind === 'police' ? 2 : 1));
            }
          }
        }
      }
    }
  }

  private updatePedestrians(dt: number) {
    for (const p of this.pedestrians) {
      const dx = p.x - this.playerX;
      const dz = p.z - this.playerZ;
      const distSq = dx * dx + dz * dz;

      if (this.activeVehicle && distSq < 6.5 && Math.abs(this.activeVehicle.speed) > 8) {
        // Knocked / scattered away!
        p.fleeTimer = 4;
        p.heading = Math.atan2(dx, dz);
        this.setWantedLevel(Math.max(this.wantedLevel, 1));
      } else if (this.activeVehicle && distSq < 48 && Math.abs(this.activeVehicle.speed) > 14) {
        p.fleeTimer = 2.5;
        p.heading = Math.atan2(dx, dz);
      }

      const spd = p.fleeTimer > 0 ? p.speed * 2.4 : p.speed;
      if (p.fleeTimer > 0) p.fleeTimer -= dt;

      const nx = p.x + Math.sin(p.heading) * spd * dt;
      const nz = p.z + Math.cos(p.heading) * spd * dt;
      const [cx, cz, hit] = this.resolveBuildingCollision(nx, nz, 0.5);
      p.x = cx;
      p.z = cz;
      if (hit || Math.abs(p.z) > 345 || p.x > 130 || p.x < -300) {
        p.heading += Math.PI * 0.75;
      }

      p.walkPhase += dt * spd * 3.4;
      const swing = Math.sin(p.walkPhase) * 0.55;
      p.rig.leftLeg.rotation.x = swing;
      p.rig.rightLeg.rotation.x = -swing;
      p.rig.leftArm.rotation.x = -swing * 0.8;
      p.rig.rightArm.rotation.x = swing * 0.8;
      p.rig.group.position.set(p.x, this.world.getGroundHeightAt(p.x, p.z), p.z);
      p.rig.group.rotation.y = p.heading;
    }
  }

  private updateCollectiblesAndMissions(dt: number) {
    // Collectibles
    for (const c of this.world.collectibles) {
      if (c.collected) continue;
      const d = Math.hypot(c.x - this.playerX, c.z - this.playerZ);
      if (d < 3.6) {
        c.collected = true;
        c.mesh.visible = false;
        this.collectiblesFound++;
        this.cash += 1500;
        this.armor = Math.min(100, this.armor + 25);
        this.audio.playCashChime();
        this.showBanner('MALLETTE VICE TROUVÉE', `+$1,500 · ${this.collectiblesFound}/${this.world.collectibles.length}`, 'cyan');
      }
    }

    // Active Mission
    if (this.missionId === 'ocean-sprint') {
      this.missionTimer -= dt;
      if (this.missionTimer <= 0) {
        this.missionId = 'none';
        this.missionBeacon.visible = false;
        this.showBanner('CONTRAT ÉCHOUÉ', 'Temps écoulé', 'crimson');
        return;
      }
      const target = this.missionCheckpoints[this.missionStep];
      if (target) {
        this.missionBeacon.position.set(target[0], 0, target[1]);
        this.missionBeacon.rotation.y = this.elapsed * 2;
        if (Math.hypot(target[0] - this.playerX, target[1] - this.playerZ) < 6.5) {
          this.missionStep++;
          this.audio.playCashChime();
          if (this.missionStep >= this.missionCheckpoints.length) {
            this.completeMission(5000, 'LIVRAISON TERMINÉE !');
          }
        }
      }
    } else if (this.missionId === 'armored-heist' && this.targetVan) {
      this.missionTimer -= dt;
      this.missionBeacon.position.set(this.targetVan.x, 0, this.targetVan.z);
      if (this.missionTimer <= 0) {
        this.scene.remove(this.targetVan.rig.group);
        this.vehicles = this.vehicles.filter((v) => v !== this.targetVan);
        this.targetVan = null;
        this.missionId = 'none';
        this.missionBeacon.visible = false;
        this.showBanner('LE FOURGON S’EST ÉCHAPPÉ', 'Mission échouée', 'crimson');
      }
    } else if (this.missionId === 'wanted-escape') {
      this.missionTimer -= dt;
      if (this.wantedLevel === 0) {
        this.completeMission(12000, 'VCPD SEMÉE !');
      } else if (this.missionTimer <= 0) {
        this.missionId = 'none';
        this.showBanner('ÉVASION ÉCHOUÉE', 'Trop lent à semer les unités', 'crimson');
      }
    }
  }

  private updateWantedSystem(dt: number) {
    if (this.wantedLevel <= 0) {
      this.wantedCooldown = 0;
      return;
    }
    let nearestCop = 999;
    for (const v of this.vehicles) {
      if (v.aiMode === 'police') {
        const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
        if (d < nearestCop) nearestCop = d;
      }
    }

    if (nearestCop < 65) {
      this.wantedCooldown = Math.min(1, this.wantedCooldown + dt * 0.35);
    } else {
      this.wantedCooldown -= dt * 0.1;
      if (this.wantedCooldown <= 0) {
        this.setWantedLevel(0);
        this.showBanner('AVIS DE RECHERCHE LEVÉ', 'Vous avez semé le VCPD', 'cyan');
      }
    }
  }

  private damagePlayer(amount: number) {
    if (this.armor > 0) {
      const absorb = Math.min(this.armor, amount);
      this.armor -= absorb;
      amount -= absorb;
    }
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && !this.wasted) {
      this.triggerWasted();
    }
  }

  private triggerWasted() {
    this.wasted = true;
    this.wastedTimer = 3.2;
    this.showBanner('NEUTRALISÉ', 'Transfert au Vice Beach Medical...', 'crimson');
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 2));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    const inCar = Boolean(this.activeVehicle);
    const speed = this.activeVehicle ? Math.abs(this.activeVehicle.speed) : 0;
    const speedRatio = Math.min(1, speed / 52);

    // Dynamic FOV widening at high speed
    const targetFov = inCar ? 60 + speedRatio * 16 : 58;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }

    const heading = this.playerHeading;
    if (inCar && this.cameraMode === 'hood') {
      _camTarget.set(
        this.playerX + Math.sin(heading) * 0.7,
        this.playerY + 1.45,
        this.playerZ + Math.cos(heading) * 0.7,
      );
      _camLook.set(
        this.playerX + Math.sin(heading) * 20,
        this.playerY + 1.3,
        this.playerZ + Math.cos(heading) * 20,
      );
    } else {
      const dist = inCar ? (this.cameraMode === 'far' ? 14.5 : 9.6) : 6.4;
      const height = inCar ? (this.cameraMode === 'far' ? 6.2 : 3.8) : 2.8;
      _camTarget.set(
        this.playerX - Math.sin(heading) * dist,
        this.playerY + height,
        this.playerZ - Math.cos(heading) * dist,
      );
      _camLook.set(
        this.playerX + Math.sin(heading) * 4,
        this.playerY + (inCar ? 1.2 : 1.5),
        this.playerZ + Math.cos(heading) * 4,
      );
    }

    const dampLambda = this.cameraMode === 'hood' ? 28 : 8.5;
    this.camPosCurrent.x = THREE.MathUtils.damp(this.camPosCurrent.x, _camTarget.x, dampLambda, dt);
    this.camPosCurrent.y = THREE.MathUtils.damp(this.camPosCurrent.y, _camTarget.y, dampLambda, dt);
    this.camPosCurrent.z = THREE.MathUtils.damp(this.camPosCurrent.z, _camTarget.z, dampLambda, dt);

    this.camLookCurrent.x = THREE.MathUtils.damp(this.camLookCurrent.x, _camLook.x, dampLambda + 4, dt);
    this.camLookCurrent.y = THREE.MathUtils.damp(this.camLookCurrent.y, _camLook.y, dampLambda + 4, dt);
    this.camLookCurrent.z = THREE.MathUtils.damp(this.camLookCurrent.z, _camLook.z, dampLambda + 4, dt);

    if (this.shakeIntensity > 0.01) {
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 8, dt);
      this.camera.position.set(
        this.camPosCurrent.x + (Math.random() - 0.5) * this.shakeIntensity,
        this.camPosCurrent.y + (Math.random() - 0.5) * this.shakeIntensity,
        this.camPosCurrent.z + (Math.random() - 0.5) * this.shakeIntensity,
      );
    } else {
      this.camera.position.copy(this.camPosCurrent);
    }
    this.camera.lookAt(this.camLookCurrent);
  }

  private emitHud() {
    const blips: MinimapBlip[] = [];
    for (const v of this.vehicles) {
      if (v === this.activeVehicle) continue;
      blips.push({
        x: v.x,
        z: v.z,
        kind: v.aiMode === 'police' ? 'police' : v === this.targetVan ? 'mission' : 'vehicle',
      });
    }
    for (const r of this.world.ramps) {
      blips.push({ x: r.x, z: r.z, kind: 'ramp' });
    }
    for (const c of this.world.collectibles) {
      if (!c.collected) blips.push({ x: c.x, z: c.z, kind: 'pickup' });
    }
    if (this.missionId === 'ocean-sprint' && this.missionCheckpoints[this.missionStep]) {
      const cp = this.missionCheckpoints[this.missionStep];
      blips.push({ x: cp[0], z: cp[1], kind: 'mission' });
    }

    let promptAction: string | null = null;
    if (!this.activeVehicle && this.started && !this.wasted) {
      const nearCar = this.findNearestVehicle(8.0);
      if (nearCar) {
        promptAction = `Monter dans ${nearCar.rig.displayName}`;
      }
    }

    let missionTitle = 'Exploration Libre';
    let missionObjective = 'Parcourez Vice Beach, Ocean Drive et Downtown';
    let missionProgress = '';
    if (this.missionId === 'ocean-sprint') {
      missionTitle = 'Livraison Ocean Drive';
      missionObjective = 'Rejoignez la balise jaune';
      missionProgress = `${this.missionStep} / ${this.missionCheckpoints.length}`;
    } else if (this.missionId === 'armored-heist') {
      missionTitle = 'Braquage du Fourgon';
      missionObjective = 'Interceptez et volez le 4x4 doré';
      missionProgress = 'En cours';
    } else if (this.missionId === 'wanted-escape') {
      missionTitle = 'Évasion 4 Étoiles';
      missionObjective = 'Éloignez-vous des unités VCPD';
      missionProgress = `${this.wantedLevel} ★`;
    }

    this.onHudUpdate({
      started: this.started,
      character: this.character,
      health: Math.round(this.health),
      armor: Math.round(this.armor),
      cash: Math.round(this.cash),
      wantedLevel: this.wantedLevel,
      wantedCooldown: this.wantedCooldown,
      inVehicle: Boolean(this.activeVehicle),
      vehicleName: this.activeVehicle ? this.activeVehicle.rig.displayName : 'À pied',
      speedKmh: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 4.4) : 0,
      nitro: Math.round(this.nitro),
      district: this.world.getDistrictAt(this.playerX, this.playerZ),
      timeOfDay: this.timeOfDay,
      cameraMode: this.cameraMode,
      radioStation: this.radioStation,
      muted: this.muted,
      missionId: this.missionId,
      missionTitle,
      missionObjective,
      missionProgress,
      missionTimer: Math.max(0, Math.ceil(this.missionTimer)),
      promptAction,
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      bannerTone: this.bannerTone,
      wasted: this.wasted,
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerHeading: this.playerHeading,
      blips,
      stuntsCompleted: this.stuntsCompleted,
      collectiblesFound: this.collectiblesFound,
      totalCollectibles: this.world.collectibles.length,
    });
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.repeat) return;

    if (e.code === 'KeyF' || e.code === 'KeyE') {
      this.triggerVehicleToggle();
    } else if (e.code === 'KeyC') {
      this.cycleCameraMode();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostCb?.(true);
  };

  private handleContextRestored = () => {
    this.onContextLostCb?.(false);
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.textures.dispose();
    this.audio.dispose();
    this.particleGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
