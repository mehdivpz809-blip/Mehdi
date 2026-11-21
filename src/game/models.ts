import * as THREE from 'three';
import type { CharacterId, VehicleKind } from './types';

export interface VehicleVisualRig {
  group: THREE.Group;
  wheels: THREE.Group[];
  frontSteerPivots: THREE.Group[];
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  sirenRedMat?: THREE.MeshStandardMaterial;
  sirenBlueMat?: THREE.MeshStandardMaterial;
  halfWidth: number;
  halfLength: number;
  displayName: string;
}

export interface CharacterVisualRig {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  torso: THREE.Mesh;
}

const VEHICLE_SPECS: Record<
  VehicleKind,
  {
    name: string;
    bodyColor: number;
    accentColor: number;
    width: number;
    length: number;
    bodyHeight: number;
    cabinHeight: number;
    clearance: number;
    wheelRadius: number;
  }
> = {
  banshee: {
    name: 'Banshee Leonida',
    bodyColor: 0xff3b7f,
    accentColor: 0x161822,
    width: 2.1,
    length: 4.5,
    bodyHeight: 0.62,
    cabinHeight: 0.48,
    clearance: 0.24,
    wheelRadius: 0.36,
  },
  cheetah: {
    name: 'Cheetah Classic',
    bodyColor: 0xf4f5f7,
    accentColor: 0x14b8a6,
    width: 2.15,
    length: 4.45,
    bodyHeight: 0.56,
    cabinHeight: 0.45,
    clearance: 0.22,
    wheelRadius: 0.35,
  },
  gauntlet: {
    name: 'Gauntlet Hellfire',
    bodyColor: 0xf59e0b,
    accentColor: 0x11131a,
    width: 2.12,
    length: 4.65,
    bodyHeight: 0.7,
    cabinHeight: 0.5,
    clearance: 0.26,
    wheelRadius: 0.38,
  },
  police: {
    name: 'VCPD Interceptor',
    bodyColor: 0x141923,
    accentColor: 0xf8fafc,
    width: 2.08,
    length: 4.6,
    bodyHeight: 0.68,
    cabinHeight: 0.54,
    clearance: 0.26,
    wheelRadius: 0.37,
  },
  sandking: {
    name: 'Sandking XL 4x4',
    bodyColor: 0x38bdf8,
    accentColor: 0x1e293b,
    width: 2.28,
    length: 4.9,
    bodyHeight: 0.85,
    cabinHeight: 0.65,
    clearance: 0.44,
    wheelRadius: 0.48,
  },
  taxi: {
    name: 'Vice Cab',
    bodyColor: 0xfacc15,
    accentColor: 0x1e293b,
    width: 2.02,
    length: 4.45,
    bodyHeight: 0.68,
    cabinHeight: 0.54,
    clearance: 0.25,
    wheelRadius: 0.36,
  },
};

export function getVehicleSpecName(kind: VehicleKind): string {
  return VEHICLE_SPECS[kind].name;
}

export function createVehicleModel(
  kind: VehicleKind,
  contactShadowTex: THREE.Texture,
  castShadow: boolean,
  colorOverride?: number,
): VehicleVisualRig {
  const spec = VEHICLE_SPECS[kind];
  const group = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorOverride ?? spec.bodyColor,
    metalness: 0.72,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    metalness: 0.35,
    roughness: 0.62,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e1826,
    metalness: 0.15,
    roughness: 0.06,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16171c,
    roughness: 0.86,
    metalness: 0.08,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd9e0ea,
    metalness: 0.92,
    roughness: 0.16,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e6,
    emissive: 0xfff3cc,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff1f44,
    emissive: 0xff1133,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });

  // 1. Contact shadow grounded at y=0.03
  const shadowGeo = new THREE.PlaneGeometry(spec.width * 1.45, spec.length * 1.25);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.03;
  group.add(shadowPlane);

  // 2. Sculpted extruded side-profile chassis (Primary Silhouette)
  const halfL = spec.length * 0.5;
  const bodyShape = new THREE.Shape();
  const baseY = spec.clearance;
  const hoodY = baseY + spec.bodyHeight * 0.82;
  const topBodyY = baseY + spec.bodyHeight;
  bodyShape.moveTo(-halfL + 0.12, baseY);
  bodyShape.lineTo(halfL - 0.12, baseY);
  bodyShape.lineTo(halfL, baseY + 0.18);
  bodyShape.lineTo(halfL - 0.08, hoodY);
  bodyShape.lineTo(halfL * 0.28, topBodyY);
  bodyShape.lineTo(-halfL * 0.68, topBodyY);
  bodyShape.lineTo(-halfL + 0.04, topBodyY - 0.04);
  bodyShape.lineTo(-halfL, baseY + 0.22);
  bodyShape.closePath();

  const bodyExtrude = new THREE.ExtrudeGeometry(bodyShape, {
    depth: spec.width - 0.16,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  bodyExtrude.center();
  // Extrude was in XY (length along X, height along Y, depth along Z). Rotate Y +90deg so +Z is forward!
  bodyExtrude.rotateY(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyExtrude, paintMat);
  bodyMesh.position.y = baseY + spec.bodyHeight * 0.5;
  bodyMesh.castShadow = castShadow;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Police white doors / side accent panel
  if (kind === 'police') {
    const doorGeo = new THREE.BoxGeometry(spec.width + 0.03, spec.bodyHeight * 0.72, spec.length * 0.36);
    const doorMesh = new THREE.Mesh(doorGeo, trimMat);
    doorMesh.position.set(0, baseY + spec.bodyHeight * 0.48, 0.05);
    group.add(doorMesh);
  }

  // 3. Lower aerodynamic skirt & bumpers (Secondary Read)
  const skirtGeo = new THREE.BoxGeometry(spec.width + 0.04, 0.16, spec.length + 0.06);
  const skirtMesh = new THREE.Mesh(skirtGeo, trimMat);
  skirtMesh.position.set(0, baseY + 0.04, 0);
  skirtMesh.castShadow = castShadow;
  group.add(skirtMesh);

  // 4. Tinted Glass Cabin & Roof Cap
  const cabinLen = spec.length * 0.44;
  const cabinGeo = new THREE.BoxGeometry(spec.width * 0.82, spec.cabinHeight, cabinLen);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.set(0, topBodyY + spec.cabinHeight * 0.44, -0.2);
  cabinMesh.castShadow = castShadow;
  group.add(cabinMesh);

  const roofGeo = new THREE.BoxGeometry(spec.width * 0.78, 0.09, cabinLen * 0.74);
  const roofMesh = new THREE.Mesh(roofGeo, kind === 'police' ? trimMat : paintMat);
  roofMesh.position.set(0, topBodyY + spec.cabinHeight * 0.9, -0.24);
  group.add(roofMesh);

  // 5. Headlights & Taillights (Accent Detail)
  const hlGeo = new THREE.BoxGeometry(0.42, 0.14, 0.1);
  [-spec.width * 0.33, spec.width * 0.33].forEach((x) => {
    const hl = new THREE.Mesh(hlGeo, headlightMat);
    hl.position.set(x, baseY + spec.bodyHeight * 0.48, halfL + 0.02);
    group.add(hl);

    const tl = new THREE.Mesh(hlGeo, taillightMat);
    tl.position.set(x, baseY + spec.bodyHeight * 0.56, -halfL - 0.02);
    group.add(tl);
  });

  // Front grille
  const grilleGeo = new THREE.BoxGeometry(spec.width * 0.42, 0.18, 0.08);
  const grille = new THREE.Mesh(grilleGeo, trimMat);
  grille.position.set(0, baseY + 0.22, halfL + 0.03);
  group.add(grille);

  // 6. Vehicle-specific signature parts
  let sirenRedMat: THREE.MeshStandardMaterial | undefined;
  let sirenBlueMat: THREE.MeshStandardMaterial | undefined;

  if (kind === 'banshee' || kind === 'cheetah') {
    // Rear GT wing
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.96, 0.06, 0.34),
      trimMat,
    );
    wingBlade.position.set(0, topBodyY + 0.24, -halfL + 0.26);
    group.add(wingBlade);
    [-0.5, 0.5].forEach((sx) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.2), trimMat);
      strut.position.set(sx, topBodyY + 0.12, -halfL + 0.26);
      group.add(strut);
    });
  } else if (kind === 'gauntlet') {
    // Hood blower scoop
    const blower = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.72), rimMat);
    blower.position.set(0, topBodyY + 0.05, halfL * 0.34);
    group.add(blower);
  } else if (kind === 'taxi') {
    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.18, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.9,
      }),
    );
    taxiSign.position.set(0, topBodyY + spec.cabinHeight + 0.08, -0.2);
    group.add(taxiSign);
  } else if (kind === 'police') {
    sirenRedMat = new THREE.MeshStandardMaterial({
      color: 0xff2244,
      emissive: 0xff1133,
      emissiveIntensity: 2.2,
    });
    sirenBlueMat = new THREE.MeshStandardMaterial({
      color: 0x2299ff,
      emissive: 0x1177ff,
      emissiveIntensity: 2.2,
    });
    const barY = topBodyY + spec.cabinHeight + 0.06;
    const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.24), sirenRedMat);
    redPod.position.set(-0.34, barY, -0.2);
    const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.24), sirenBlueMat);
    bluePod.position.set(0.34, barY, -0.2);
    const centerBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.24), trimMat);
    centerBar.position.set(0, barY, -0.2);
    group.add(redPod, bluePod, centerBar);
  } else if (kind === 'sandking') {
    // Roof rack + front bullbar
    const bullbar = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.86, 0.3, 0.14), rimMat);
    bullbar.position.set(0, baseY + 0.28, halfL + 0.1);
    group.add(bullbar);
  }

  // 7. 4 Wheel Assemblies (Tire + Rim + Center Hub)
  const wheels: THREE.Group[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  const tireGeo = new THREE.CylinderGeometry(spec.wheelRadius, spec.wheelRadius, 0.28, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(spec.wheelRadius * 0.62, spec.wheelRadius * 0.62, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelX = spec.width * 0.47;
  const wheelZFront = spec.length * 0.31;
  const wheelZRear = -spec.length * 0.32;

  const positions: [number, number, boolean][] = [
    [-wheelX, wheelZFront, true],
    [wheelX, wheelZFront, true],
    [-wheelX, wheelZRear, false],
    [wheelX, wheelZRear, false],
  ];

  for (const [wx, wz, isFront] of positions) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, spec.wheelRadius, wz);

    const spinGroup = new THREE.Group();
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = castShadow;
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    spinGroup.add(tireMesh, rimMesh);

    steerPivot.add(spinGroup);
    group.add(steerPivot);
    wheels.push(spinGroup);
    if (isFront) {
      frontSteerPivots.push(steerPivot);
    }
  }

  return {
    group,
    wheels,
    frontSteerPivots,
    headlightMat,
    taillightMat,
    sirenRedMat,
    sirenBlueMat,
    halfWidth: spec.width * 0.5,
    halfLength: spec.length * 0.5,
    displayName: spec.name,
  };
}

export function createCharacterModel(
  role: CharacterId | 'pedestrian' | 'officer',
  contactShadowTex: THREE.Texture,
  castShadow: boolean,
  shirtHex?: number,
): CharacterVisualRig {
  const group = new THREE.Group();

  let jacketColor = shirtHex ?? 0xf43f5e;
  let pantsColor = 0x1e293b;
  let skinColor = 0xd99b78;
  let hairColor = 0x241712;

  if (role === 'lucia') {
    jacketColor = 0xff477e;
    pantsColor = 0x283655;
    skinColor = 0xc98863;
    hairColor = 0x1f1410;
  } else if (role === 'jason') {
    jacketColor = 0x14b8a6;
    pantsColor = 0x334155;
    skinColor = 0xe1a884;
    hairColor = 0x4a3525;
  } else if (role === 'officer') {
    jacketColor = 0x1d4ed8;
    pantsColor = 0x0f172a;
    skinColor = 0xd89f7c;
    hairColor = 0x111827;
  }

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.65 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });

  // Ground contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowPlane = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  // Legs (pivot at hip y = 0.85)
  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.86, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pantsMat);
    legMesh.position.y = -0.36;
    legMesh.castShadow = castShadow;
    const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.28), shoeMat);
    shoeMesh.position.set(0, -0.78, 0.04);
    pivot.add(legMesh, shoeMesh);
    group.add(pivot);
    return pivot;
  };

  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.64, 0.26), jacketMat);
  torso.position.set(0, 1.2, 0);
  torso.castShadow = castShadow;
  group.add(torso);

  // Arms (pivot at shoulder y = 1.46)
  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.46, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.16), jacketMat);
    sleeve.position.y = -0.2;
    sleeve.castShadow = castShadow;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.14), skinMat);
    hand.position.y = -0.5;
    pivot.add(sleeve, hand);
    group.add(pivot);
    return pivot;
  };

  const leftArm = makeArm(-0.34);
  const rightArm = makeArm(0.34);

  // Head + Hair + Vice Shades
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skinMat);
  head.position.set(0, 1.71, 0);
  head.castShadow = castShadow;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, role === 'lucia' ? 0.26 : 0.14, 0.33),
    hairMat,
  );
  hair.position.set(0, role === 'lucia' ? 1.78 : 1.84, -0.02);
  group.add(hair);

  if (role === 'lucia' || role === 'jason' || role === 'officer') {
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.07, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x090b10, metalness: 0.85, roughness: 0.12 }),
    );
    shades.position.set(0, 1.73, 0.14);
    group.add(shades);
  }

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    torso,
  };
}
