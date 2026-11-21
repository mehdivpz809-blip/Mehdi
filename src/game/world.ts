import * as THREE from 'three';
import type { ProceduralTextures } from './textures';

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface RampCollider {
  x: number;
  z: number;
  halfW: number;
  halfL: number;
  dirX: number; // unit direction up the ramp
  dirZ: number;
  height: number;
}

export interface CollectibleNode {
  id: number;
  x: number;
  z: number;
  mesh: THREE.Group;
  collected: boolean;
}

export interface WorldHandles {
  roadXs: number[];
  roadZs: number[];
  buildings: BuildingCollider[];
  ramps: RampCollider[];
  collectibles: CollectibleNode[];
  neonMaterials: THREE.MeshStandardMaterial[];
  lampBulbMaterial: THREE.MeshStandardMaterial;
  oceanUniforms: { uTime: { value: number } };
  getDistrictAt: (x: number, z: number) => string;
  getGroundHeightAt: (x: number, z: number) => number;
}

export const ROAD_XS = [-270, -180, -90, 0, 90];
export const ROAD_ZS = [-270, -180, -90, 0, 90, 180, 270];
export const ROAD_WIDTH = 16;
export const BEACH_START_X = 108;
export const OCEAN_START_X = 165;

export function buildViceCityWorld(
  scene: THREE.Scene,
  textures: ProceduralTextures,
  isSoftwareGl: boolean,
): WorldHandles {
  const buildings: BuildingCollider[] = [];
  const ramps: RampCollider[] = [];
  const collectibles: CollectibleNode[] = [];
  const neonMaterials: THREE.MeshStandardMaterial[] = [];

  // 1. Extended Base Terrain (City concrete + distant Leonida perimeter)
  const baseGroundMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalk,
    color: 0xc2bdb2,
    roughness: 0.9,
    metalness: 0.02,
  });
  const baseGround = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), baseGroundMat);
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.position.set(-590, -0.05, 0);
  baseGround.receiveShadow = true;
  scene.add(baseGround);

  // Outer Leonida tropical grass perimeter (North, South, West)
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e4c,
    roughness: 0.92,
  });
  const outerGrass = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), grassMat);
  outerGrass.rotation.x = -Math.PI / 2;
  outerGrass.position.set(-780, -0.1, 0);
  outerGrass.receiveShadow = true;
  scene.add(outerGrass);

  // 2. Asphalt Road Network (y = 0)
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.84,
    metalness: 0.05,
  });

  const roadLengthZ = 720;
  for (const rx of ROAD_XS) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, roadLengthZ),
      asphaltMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(rx, 0, 0);
    road.receiveShadow = true;
    scene.add(road);
  }

  const roadLengthX = 480;
  for (const rz of ROAD_ZS) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(roadLengthX, ROAD_WIDTH),
      asphaltMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(-140, 0.005, rz);
    road.receiveShadow = true;
    scene.add(road);
  }

  // Vice International Airport Runway Strip on the far West (x = -335)
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 640),
    asphaltMat,
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-335, 0.004, 0);
  runway.receiveShadow = true;
  scene.add(runway);

  // Road Center Dashes (InstancedMesh at y = 0.03)
  const dashGeo = new THREE.PlaneGeometry(0.38, 4.0);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const dashMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  for (const rx of ROAD_XS) {
    for (let z = -345; z <= 345; z += 12) {
      if (ROAD_ZS.some((rz) => Math.abs(z - rz) < 10)) continue;
      dummy.position.set(rx, 0.03, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());
    }
  }
  for (const rz of ROAD_ZS) {
    for (let x = -355; x <= 95; x += 12) {
      if (ROAD_XS.some((rx) => Math.abs(x - rx) < 10)) continue;
      dummy.position.set(x, 0.03, rz);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());
    }
  }
  // Airport runway center dashes
  for (let z = -300; z <= 300; z += 18) {
    dummy.position.set(-335, 0.03, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(2.2, 1, 2.0);
    dummy.updateMatrix();
    dashMatrices.push(dummy.matrix.clone());
  }
  dummy.scale.set(1, 1, 1);

  const dashInst = new THREE.InstancedMesh(dashGeo, dashMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => dashInst.setMatrixAt(i, m));
  dashInst.instanceMatrix.needsUpdate = true;
  dashInst.computeBoundingSphere();
  scene.add(dashInst);

  // 3. Vice Beach Sand Strip & Boardwalk Promenade (x = 98..176, z = -420..+420)
  const boardWalk = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.16, 740),
    new THREE.MeshStandardMaterial({ color: 0xe2d5c3, roughness: 0.8 }),
  );
  boardWalk.position.set(102, 0.04, 0);
  boardWalk.receiveShadow = true;
  scene.add(boardWalk);

  const beachGeo = new THREE.PlaneGeometry(72, 1100, 12, 12);
  beachGeo.rotateX(-Math.PI / 2);
  const beachPos = beachGeo.attributes.position;
  for (let i = 0; i < beachPos.count; i++) {
    const lx = beachPos.getX(i);
    const drop = lx > 10 ? -(lx - 10) * 0.08 : 0.02;
    beachPos.setY(i, drop);
  }
  beachGeo.computeVertexNormals();
  const beachMesh = new THREE.Mesh(
    beachGeo,
    new THREE.MeshStandardMaterial({
      map: textures.sand,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );
  beachMesh.position.set(140, 0, 0);
  beachMesh.receiveShadow = true;
  scene.add(beachMesh);

  // 4. Animated Tropical Atlantic Ocean (onBeforeCompile wave shader)
  const oceanUniforms = { uTime: { value: 0 } };
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5a4,
    roughness: 0.14,
    metalness: 0.35,
    envMapIntensity: 1.4,
  });
  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = oceanUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float wave1 = sin(position.x * 0.08 + uTime * 1.4) * 0.28;
        float wave2 = cos(position.y * 0.09 + uTime * 1.1) * 0.22;
        transformed.z += wave1 + wave2;
        `,
      );
  };
  const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1800, 36, 48), oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(705, -0.55, 0);
  oceanMesh.receiveShadow = true;
  scene.add(oceanMesh);

  // Twin Vice Beach Wooden Piers at z = 35 and z = -145
  const pierZCoords = [35, -145];
  for (const pzCenter of pierZCoords) {
    const pierGroup = new THREE.Group();
    const pierDeck = new THREE.Mesh(
      new THREE.BoxGeometry(58, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x8b6240, roughness: 0.85 }),
    );
    pierDeck.position.set(182, 0.9, pzCenter);
    pierDeck.castShadow = !isSoftwareGl;
    pierDeck.receiveShadow = true;
    pierGroup.add(pierDeck);
    for (let px = 158; px <= 206; px += 12) {
      [-4.2, 4.2].forEach((pz) => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.3, 3.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x5c3e26, roughness: 0.9 }),
        );
        post.position.set(px, -0.3, pzCenter + pz);
        pierGroup.add(post);
      });
    }
    scene.add(pierGroup);
  }

  // 5. Expanded City Blocks across 5 Districts
  const blockCols = [
    { xMin: -258, xMax: -192, district: 'Port Leonida' },
    { xMin: -168, xMax: -102, district: 'Little Leonida' },
    { xMin: -78, xMax: -12, district: 'Downtown Vice' },
    { xMin: 12, xMax: 78, district: 'Ocean Drive' },
  ];
  const blockRows = [
    { zMin: -348, zMax: -282 },
    { zMin: -258, zMax: -192 },
    { zMin: -168, zMax: -102 },
    { zMin: -78, zMax: -12 },
    { zMin: 12, zMax: 78 },
    { zMin: 102, zMax: 168 },
    { zMin: 192, zMax: 258 },
    { zMin: 282, zMax: 348 },
  ];

  const towerMat = new THREE.MeshStandardMaterial({
    map: textures.facadeTower,
    roughness: 0.35,
    metalness: 0.6,
  });
  const decoMat = new THREE.MeshStandardMaterial({
    map: textures.facadeDeco,
    roughness: 0.72,
    metalness: 0.06,
  });

  const neonPalette = [0xff3b9a, 0x22d3ee, 0xfbbf24, 0x34d399, 0xa855f7];
  const hotelBodyColors = [0xfce7f3, 0xccfbf1, 0xffedd5, 0xe0f2fe];
  const portColors = [0xdbeafe, 0xfef3c7, 0xd1fae5, 0xf3e8ff];

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let c = 0; c < blockCols.length; c++) {
    const col = blockCols[c];
    for (let r = 0; r < blockRows.length; r++) {
      const row = blockRows[r];
      const cx = (col.xMin + col.xMax) * 0.5;
      const cz = (row.zMin + row.zMax) * 0.5;
      const bw = col.xMax - col.xMin;
      const bd = row.zMax - row.zMin;

      // Raised sidewalk pad
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(bw + 2, 0.16, bd + 2),
        baseGroundMat,
      );
      pad.position.set(cx, 0.04, cz);
      pad.receiveShadow = true;
      scene.add(pad);

      // Leave 2 open City Parks / Stunt Plazas (Downtown Park & Little Leonida Plaza)
      if ((c === 2 && r === 3) || (c === 1 && r === 5)) {
        const plazaGrass = new THREE.Mesh(
          new THREE.BoxGeometry(bw - 4, 0.19, bd - 4),
          new THREE.MeshStandardMaterial({ color: 0x2f7a53, roughness: 0.88 }),
        );
        plazaGrass.position.set(cx, 0.05, cz);
        plazaGrass.receiveShadow = true;
        scene.add(plazaGrass);
        continue;
      }

      const isOceanDrive = c === 3;
      const isDowntown = c === 2;
      const subCount = isOceanDrive || rand() > 0.4 ? 2 : 1;

      for (let s = 0; s < subCount; s++) {
        const subW = subCount === 2 ? bw * 0.42 : bw * 0.72;
        const subD = bd * (0.68 + rand() * 0.14);
        const ox =
          subCount === 2
            ? cx + (s === 0 ? -bw * 0.24 : bw * 0.24)
            : cx;
        const oz = cz;

        const h = isOceanDrive
          ? 12 + rand() * 15
          : isDowntown
            ? 28 + rand() * 52
            : c === 1
              ? 14 + rand() * 24
              : 10 + rand() * 15;

        const bMat = isOceanDrive
          ? new THREE.MeshStandardMaterial({
              map: textures.facadeDeco,
              color: hotelBodyColors[Math.floor(rand() * hotelBodyColors.length)],
              roughness: 0.7,
            })
          : c === 0 || c === 1
            ? new THREE.MeshStandardMaterial({
                map: textures.facadeDeco,
                color: portColors[Math.floor(rand() * portColors.length)],
                roughness: 0.75,
              })
            : towerMat;

        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(subW, h, subD), bMat);
        bMesh.position.set(ox, h * 0.5 + 0.12, oz);
        bMesh.castShadow = !isSoftwareGl;
        bMesh.receiveShadow = true;
        scene.add(bMesh);

        const crownH = 2.4 + rand() * 2.8;
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(subW * 0.74, crownH, subD * 0.74),
          isOceanDrive ? decoMat : towerMat,
        );
        crown.position.set(ox, h + crownH * 0.5 + 0.12, oz);
        scene.add(crown);

        const neonColor = neonPalette[Math.floor(rand() * neonPalette.length)];
        const neonMat = new THREE.MeshStandardMaterial({
          color: neonColor,
          emissive: neonColor,
          emissiveIntensity: 0.35,
          roughness: 0.2,
        });
        neonMaterials.push(neonMat);

        const neonStrip = new THREE.Mesh(
          new THREE.BoxGeometry(subW + 0.25, 0.45, subD + 0.25),
          neonMat,
        );
        neonStrip.position.set(ox, h - 0.5, oz);
        scene.add(neonStrip);

        buildings.push({
          minX: ox - subW * 0.5,
          maxX: ox + subW * 0.5,
          minZ: oz - subD * 0.5,
          maxZ: oz + subD * 0.5,
          height: h,
        });
      }
    }
  }

  // Airport Control Tower & Hangar on the West
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(28, 12, 46),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.4 }),
  );
  hangar.position.set(-296, 6.1, -120);
  hangar.castShadow = !isSoftwareGl;
  hangar.receiveShadow = true;
  scene.add(hangar);
  buildings.push({ minX: -310, maxX: -282, minZ: -143, maxZ: -97, height: 12 });

  const atcTower = new THREE.Mesh(
    new THREE.BoxGeometry(10, 34, 10),
    towerMat,
  );
  atcTower.position.set(-296, 17, 120);
  scene.add(atcTower);
  buildings.push({ minX: -301, maxX: -291, minZ: 115, maxZ: 125, height: 34 });

  // 6. Stunt Ramps (8 ramps across the expanded city & airport!)
  const rampSpecs: Omit<RampCollider, 'height'>[] = [
    { x: 90, z: -45, halfW: 3.4, halfL: 6.5, dirX: 0, dirZ: 1 },
    { x: 0, z: 45, halfW: 3.4, halfL: 6.5, dirX: 0, dirZ: -1 },
    { x: -90, z: -135, halfW: 3.4, halfL: 6.5, dirX: 0, dirZ: 1 },
    { x: 148, z: 35, halfW: 3.4, halfL: 6.5, dirX: 1, dirZ: 0 }, // Pier 1 Jump
    { x: 148, z: -145, halfW: 3.4, halfL: 6.5, dirX: 1, dirZ: 0 }, // Pier 2 Jump
    { x: -45, z: -45, halfW: 3.6, halfL: 6.5, dirX: 1, dirZ: 0 }, // Downtown Park Jump
    { x: -335, z: -45, halfW: 4.5, halfL: 7.5, dirX: 0, dirZ: 1 }, // Airport Runway Mega Jump!
    { x: -180, z: 135, halfW: 3.4, halfL: 6.5, dirX: 0, dirZ: -1 },
  ];
  const rampMat = new THREE.MeshStandardMaterial({
    map: textures.rampStripe,
    roughness: 0.5,
    metalness: 0.3,
  });

  for (const rs of rampSpecs) {
    const height = 2.7;
    const wid = rs.halfW * 2;
    const wedge = new THREE.Shape();
    wedge.moveTo(-rs.halfL, 0);
    wedge.lineTo(rs.halfL, 0);
    wedge.lineTo(rs.halfL, height);
    wedge.closePath();

    const geo = new THREE.ExtrudeGeometry(wedge, { depth: wid, bevelEnabled: false });
    geo.translate(0, 0, -rs.halfW);
    const angle = Math.atan2(-rs.dirZ, rs.dirX);
    geo.rotateY(angle);

    const mesh = new THREE.Mesh(geo, rampMat);
    mesh.position.set(rs.x, 0.02, rs.z);
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = true;
    scene.add(mesh);

    ramps.push({ ...rs, height });
  }

  // 7. Instanced Palm Trees along expanded Vice Beach & Avenues
  const palmPositions: [number, number][] = [];
  for (let z = -350; z <= 350; z += 18) {
    palmPositions.push([99, z]);
    if (Math.abs(z - 35) > 12 && Math.abs(z - -145) > 12) {
      palmPositions.push([112, z + 6]);
    }
  }
  for (let z = -330; z <= 330; z += 36) {
    palmPositions.push([9, z]);
    palmPositions.push([-81, z]);
    palmPositions.push([-171, z]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 7.2, 7);
  trunkGeo.translate(0, 3.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c5838, roughness: 0.9 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);

  const frondGeo = new THREE.ConeGeometry(2.6, 1.4, 6);
  frondGeo.scale(1.15, 0.65, 1.15);
  frondGeo.translate(0, 7.2, 0);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2fa85b, roughness: 0.75 });
  const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmPositions.length);

  const pColor = new THREE.Color();
  palmPositions.forEach(([px, pz], idx) => {
    const s = 0.85 + ((idx * 37) % 30) / 100;
    dummy.position.set(px, 0, pz);
    dummy.rotation.set(
      ((idx % 5) - 2) * 0.03,
      (idx * 1.1) % (Math.PI * 2),
      ((idx % 3) - 1) * 0.04,
    );
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    frondInst.setMatrixAt(idx, dummy.matrix);
    pColor.setHSL(0.36 + ((idx % 7) - 3) * 0.012, 0.56, 0.42);
    frondInst.setColorAt(idx, pColor);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  frondInst.instanceMatrix.needsUpdate = true;
  if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  frondInst.computeBoundingSphere();
  scene.add(trunkInst, frondInst);

  // 8. Streetlights along Avenues
  const lampPositions: [number, number][] = [];
  for (let z = -330; z <= 330; z += 45) {
    if (ROAD_ZS.some((rz) => Math.abs(z - rz) < 12)) continue;
    lampPositions.push([81.5, z]);
    lampPositions.push([98.5, z]);
    lampPositions.push([-8.5, z]);
    lampPositions.push([-98.5, z]);
    lampPositions.push([-188.5, z]);
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.8, 6);
  poleGeo.translate(0, 2.9, 0);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.7,
    roughness: 0.35,
  });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);

  const bulbGeo = new THREE.SphereGeometry(0.28, 8, 8);
  bulbGeo.translate(0, 5.9, 0);
  const lampBulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe8b3,
    emissive: 0xffc966,
    emissiveIntensity: 0.25,
  });
  const bulbInst = new THREE.InstancedMesh(bulbGeo, lampBulbMaterial, lampPositions.length);

  lampPositions.forEach(([lx, lz], idx) => {
    dummy.position.set(lx, 0, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(idx, dummy.matrix);
    bulbInst.setMatrixAt(idx, dummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  scene.add(poleInst, bulbInst);

  // 9. Neon Collectibles (14 Golden Vice Cases across all districts)
  const collectibleCoords: [number, number][] = [
    [90, -135],
    [130, 125],
    [206, 35], // Pier 1
    [206, -145], // Pier 2
    [-45, -45], // Downtown Park
    [-135, 135],
    [-225, -45],
    [-335, 180], // Airport Runway South
    [-335, -220], // Airport Runway North
    [45, 225],
    [-45, -315],
    [-180, -225],
    [125, -250],
    [-270, 270],
  ];
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    metalness: 0.8,
    roughness: 0.2,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff3b9a,
    transparent: true,
    opacity: 0.85,
  });

  collectibleCoords.forEach(([cx, cz], idx) => {
    const nodeGroup = new THREE.Group();
    const box = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), caseMat);
    box.position.y = 1.25;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 24), ringMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.2;
    nodeGroup.add(box, halo);
    const onPier = idx === 2 || idx === 3;
    nodeGroup.position.set(cx, onPier ? 1.1 : 0, cz);
    scene.add(nodeGroup);

    collectibles.push({
      id: idx,
      x: cx,
      z: cz,
      mesh: nodeGroup,
      collected: false,
    });
  });

  const getDistrictAt = (x: number, z: number): string => {
    if (x > 168) return 'Océan Atlantique · Leonida';
    if (x > 106) return 'Vice Beach · Promenade';
    if (x > 5) return 'Ocean Drive · Quartier Art Déco';
    if (x > -95) return z < 0 ? 'Downtown Vice · Centre' : 'Vice Financial';
    if (x > -185) return 'Little Leonida · Wynwood';
    if (x > -280) return 'Port Leonida · Docks';
    return 'Aéroport International Vice';
  };

  const getGroundHeightAt = (x: number, z: number): number => {
    // Pier decks
    if (x >= 153 && x <= 211 && (Math.abs(z - 35) <= 5.2 || Math.abs(z - -145) <= 5.2)) {
      return 1.08;
    }
    // Check ramps
    for (const r of ramps) {
      const dx = x - r.x;
      const dz = z - r.z;
      const along = dx * r.dirX + dz * r.dirZ;
      const perp = Math.abs(-dx * r.dirZ + dz * r.dirX);
      if (perp <= r.halfW && along >= -r.halfL && along <= r.halfL) {
        const t = (along + r.halfL) / (r.halfL * 2);
        return Math.max(0, t * r.height);
      }
    }
    // Beach gentle slope
    if (x > 114 && x <= 176) {
      const lx = x - 140;
      if (lx > 10) return Math.max(-0.5, -(lx - 10) * 0.08);
      return 0.02;
    }
    if (x > 176) return -0.5;
    return 0;
  };

  return {
    roadXs: ROAD_XS,
    roadZs: ROAD_ZS,
    buildings,
    ramps,
    collectibles,
    neonMaterials,
    lampBulbMaterial,
    oceanUniforms,
    getDistrictAt,
    getGroundHeightAt,
  };
}
