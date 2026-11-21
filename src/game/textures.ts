import * as THREE from 'three';

export interface ProceduralTextures {
  asphalt: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  facadeTower: THREE.CanvasTexture;
  facadeDeco: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  rampStripe: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const created: THREE.CanvasTexture[] = [];

  const register = (canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1, isColor = true) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = Math.min(8, maxAnisotropy);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    created.push(tex);
    return tex;
  };

  // 1. Asphalt Road Texture (with subtle grain + double yellow center line)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const aCtx = asphaltCanvas.getContext('2d')!;
  aCtx.fillStyle = '#22242a';
  aCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const v = 26 + Math.floor(Math.random() * 24);
    aCtx.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
    aCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Subtle wheel tracks
  aCtx.fillStyle = 'rgba(12,13,16,0.28)';
  aCtx.fillRect(100, 0, 55, 512);
  aCtx.fillRect(357, 0, 55, 512);
  const asphalt = register(asphaltCanvas, 1, 1);

  // 2. Sidewalk Concrete Grid
  const swCanvas = document.createElement('canvas');
  swCanvas.width = 256;
  swCanvas.height = 256;
  const sCtx = swCanvas.getContext('2d')!;
  sCtx.fillStyle = '#b9b4aa';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const v = 165 + Math.floor(Math.random() * 25);
    sCtx.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`;
    sCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  sCtx.strokeStyle = 'rgba(70,66,60,0.35)';
  sCtx.lineWidth = 3;
  for (let p = 0; p <= 256; p += 64) {
    sCtx.beginPath();
    sCtx.moveTo(p, 0);
    sCtx.lineTo(p, 256);
    sCtx.stroke();
    sCtx.beginPath();
    sCtx.moveTo(0, p);
    sCtx.lineTo(256, p);
    sCtx.stroke();
  }
  const sidewalk = register(swCanvas, 2, 2);

  // 3. Vice Beach Sand
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = 256;
  sandCanvas.height = 256;
  const saCtx = sandCanvas.getContext('2d')!;
  saCtx.fillStyle = '#e5cfa3';
  saCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const warm = Math.random() > 0.5;
    saCtx.fillStyle = warm ? 'rgba(248,233,196,0.4)' : 'rgba(196,170,126,0.35)';
    saCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const sand = register(sandCanvas, 12, 24);

  // 4. Glass Skyscraper Facade
  const towerCanvas = document.createElement('canvas');
  towerCanvas.width = 256;
  towerCanvas.height = 512;
  const tCtx = towerCanvas.getContext('2d')!;
  tCtx.fillStyle = '#182436';
  tCtx.fillRect(0, 0, 256, 512);
  for (let y = 10; y < 502; y += 26) {
    for (let x = 10; x < 246; x += 28) {
      const lit = Math.random() > 0.42;
      const warm = Math.random() > 0.5;
      tCtx.fillStyle = lit
        ? warm
          ? '#ffd59a'
          : '#8ce6ff'
        : '#243854';
      tCtx.fillRect(x, y, 18, 16);
    }
    // Concrete floor slab band
    tCtx.fillStyle = '#2d3748';
    tCtx.fillRect(0, y + 18, 256, 5);
  }
  const facadeTower = register(towerCanvas, 2, 3);

  // 5. Art Deco Ocean Drive Hotel Facade
  const decoCanvas = document.createElement('canvas');
  decoCanvas.width = 256;
  decoCanvas.height = 256;
  const dCtx = decoCanvas.getContext('2d')!;
  dCtx.fillStyle = '#f5ebe0';
  dCtx.fillRect(0, 0, 256, 256);
  // Pastel stucco horizontal accents
  dCtx.fillStyle = '#ff7eb6';
  dCtx.fillRect(0, 0, 256, 16);
  dCtx.fillStyle = '#38d9c0';
  dCtx.fillRect(0, 20, 256, 8);
  for (let y = 44; y < 236; y += 46) {
    for (let x = 18; x < 240; x += 44) {
      dCtx.fillStyle = Math.random() > 0.3 ? '#ffe4ad' : '#26384d';
      dCtx.fillRect(x, y, 24, 28);
      dCtx.strokeStyle = '#ffffff';
      dCtx.lineWidth = 2;
      dCtx.strokeRect(x, y, 24, 28);
    }
  }
  const facadeDeco = register(decoCanvas, 2, 2);

  // 6. Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shCtx = shadowCanvas.getContext('2d')!;
  const grad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  created.push(contactShadow);

  // 7. Stunt Ramp Chevron Texture
  const rampCanvas = document.createElement('canvas');
  rampCanvas.width = 128;
  rampCanvas.height = 256;
  const rCtx = rampCanvas.getContext('2d')!;
  rCtx.fillStyle = '#1f2937';
  rCtx.fillRect(0, 0, 128, 256);
  rCtx.fillStyle = '#f59e0b';
  for (let y = 16; y < 256; y += 48) {
    rCtx.beginPath();
    rCtx.moveTo(16, y + 28);
    rCtx.lineTo(64, y);
    rCtx.lineTo(112, y + 28);
    rCtx.lineTo(112, y + 40);
    rCtx.lineTo(64, y + 12);
    rCtx.lineTo(16, y + 40);
    rCtx.closePath();
    rCtx.fill();
  }
  const rampStripe = register(rampCanvas, 1, 2);

  return {
    asphalt,
    sidewalk,
    sand,
    facadeTower,
    facadeDeco,
    contactShadow,
    rampStripe,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
