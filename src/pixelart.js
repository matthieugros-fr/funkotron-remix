// Outils de dessin pixel par pixel sur des canevas, puis textures « plus proche voisin ».
import * as THREE from 'three';

export const OUT = '#1a1033';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export function painter(ctx, ox = 0, oy = 0) {
  const fill = (c) => { ctx.fillStyle = c; };
  return {
    px(x, y, c) { fill(c); ctx.fillRect(ox + Math.round(x), oy + Math.round(y), 1, 1); },
    rect(x, y, w, h, c) { if (w <= 0 || h <= 0) return; fill(c); ctx.fillRect(ox + x, oy + y, w, h); },
    disc(cx, cy, r, c) {
      fill(c);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + r * 0.8) ctx.fillRect(ox + cx + x, oy + cy + y, 1, 1);
    },
    ellipse(cx, cy, rx, ry, c, checker = false) {
      fill(c);
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
        if (checker && ((x + y) & 1)) continue;
        ctx.fillRect(ox + cx + x, oy + cy + y, 1, 1);
      }
    },
  };
}

// Contour sombre d'un pixel autour de toute forme opaque (style cartouche).
export function outline(ctx, w, h, col = OUT) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const a = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 0;
  ctx.fillStyle = col;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
    if (!a(i, j) && (a(i + 1, j) || a(i - 1, j) || a(i, j + 1) || a(i, j - 1))) ctx.fillRect(i, j, 1, 1);
}

export function spriteCanvas(w, h, draw, withOutline = true) {
  const [c, x] = makeCanvas(w, h);
  draw(painter(x), x);
  if (withOutline) outline(x, w, h);
  return c;
}

export function nearestTex(canvas, repeat = false, data = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
