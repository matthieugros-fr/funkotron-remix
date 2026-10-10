// Planche de sprites de ToeJam, dessinée pixel par pixel.
// Lignes : 0 de face, 1 de dos, 2 de profil (tourné vers la gauche ; la droite est un miroir).
// Colonnes : voir COL.
import { makeCanvas, painter, outline } from './pixelart.js';

export const FW = 24, FH = 32;
export const COL = { idle0: 0, idle1: 1, blink: 2, walk: 3, fall0: 9, fall1: 10, teeter0: 11, teeter1: 12, splat: 13, getup: 14 };
export const NCOLS = 15, NROWS = 3;

const C = {
  R: '#e8334a', RL: '#ff7686', RD: '#a81c33',
  B: '#2f6fe4', BL: '#6a9cff', BD: '#1b45a3',
  W: '#ffffff', K: '#1a1033', Y: '#ffcf3a', YD: '#c9921a',
  S: '#f4f4f4', SD: '#aeb3c8', ST: '#ff4a5c', M: '#5a0f22',
};

const LIFT = [0, 1, 2, 1, 0, 0];
const STEP = [-1, 0, 1, 1, 0, -1];

function pose(col) {
  const base = { bob: 0, lifts: [0, 0, 0], sdx: [0, 0, 0], swing: 0, arms: 'down', eyes: 'open', mouth: 'smile', sweat: false };
  if (col === COL.idle1) return { ...base, bob: 1 };
  if (col === COL.blink) return { ...base, eyes: 'closed' };
  if (col >= COL.walk && col < COL.walk + 6) {
    const f = col - COL.walk;
    return {
      ...base, bob: f % 3 === 0 ? 1 : 0,
      lifts: [LIFT[f % 6], LIFT[(f + 2) % 6], LIFT[(f + 4) % 6]],
      sdx: [STEP[f % 6], STEP[(f + 2) % 6], STEP[(f + 4) % 6]],
      swing: f < 3 ? 1 : -1,
    };
  }
  if (col === COL.fall0) return { ...base, lifts: [2, 0, 1], arms: 'up', eyes: 'wide', mouth: 'o', sweat: true };
  if (col === COL.fall1) return { ...base, lifts: [0, 2, 1], arms: 'up', eyes: 'wide', mouth: 'o', sweat: true };
  if (col === COL.teeter0) return { ...base, arms: 'wind0', eyes: 'wide', mouth: 'o' };
  if (col === COL.teeter1) return { ...base, arms: 'wind1', eyes: 'wide', mouth: 'o' };
  if (col === COL.getup) return { ...base, bob: 2, eyes: 'closed' };
  return base;
}

function shoe(p, x, y) {
  p.rect(x, y, 4, 1, C.ST);
  p.rect(x, y + 1, 4, 1, C.S);
  p.rect(x, y + 2, 4, 1, C.SD);
}

function frontLegs(p, o) {
  const xs = [8, 14, 11];
  for (const i of [0, 1, 2]) {
    const lx = xs[i], l = o.lifts[i];
    p.rect(lx, 25, 2, 4 - l, C.R);
    p.rect(lx + 1, 25, 1, 4 - l, C.RD);
    shoe(p, lx - 1, 29 - l);
  }
}

function frontArms(p, o, y0) {
  const L = o.swing > 0 ? 1 : 0, Rr = o.swing < 0 ? 1 : 0;
  switch (o.arms) {
    case 'up':
      p.rect(5, 10 + y0, 2, 7, C.R); p.rect(17, 10 + y0, 2, 7, C.R);
      p.px(6, 10 + y0, C.RD); p.px(17, 10 + y0, C.RD);
      break;
    case 'wind0':
      p.rect(5, 10 + y0, 2, 7, C.R);
      p.rect(16, 17 + y0, 6, 2, C.R); p.rect(16, 18 + y0, 6, 1, C.RD);
      break;
    case 'wind1':
      p.rect(17, 10 + y0, 2, 7, C.R);
      p.rect(2, 17 + y0, 6, 2, C.R); p.rect(2, 18 + y0, 6, 1, C.RD);
      break;
    default:
      p.rect(6, 17 + y0 + L, 2, 4, C.R); p.px(6, 20 + y0 + L, C.RD);
      p.rect(16, 17 + y0 + Rr, 2, 4, C.R); p.px(17, 20 + y0 + Rr, C.RD);
  }
}

function capDome(p, y0) {
  p.rect(9, 4 + y0, 6, 1, C.B);
  p.rect(8, 5 + y0, 8, 1, C.B);
  p.rect(7, 6 + y0, 10, 2, C.B);
  p.rect(7, 8 + y0, 10, 1, C.BD);
  p.px(10, 5 + y0, C.BL); p.px(11, 5 + y0, C.BL); p.px(9, 6 + y0, C.BL);
  p.rect(11, 3 + y0, 2, 1, C.BD);
}

function front(p, o) {
  const y0 = o.bob;
  frontLegs(p, o);
  // short
  p.rect(8, 22 + y0, 8, 3, C.B); p.rect(8, 24 + y0, 8, 1, C.BD); p.px(9, 22 + y0, C.BL); p.px(10, 22 + y0, C.BL);
  // torse et chaîne en or
  p.rect(8, 17 + y0, 8, 5, C.R); p.rect(15, 17 + y0, 1, 5, C.RD);
  p.px(9, 17 + y0, C.Y); p.px(10, 18 + y0, C.Y); p.px(13, 18 + y0, C.Y); p.px(14, 17 + y0, C.Y);
  p.rect(11, 19 + y0, 2, 2, C.Y); p.px(12, 20 + y0, C.YD);
  p.rect(10, 16 + y0, 4, 1, C.R);
  frontArms(p, o, y0);
  // tête
  p.rect(7, 9 + y0, 10, 6, C.R); p.rect(8, 15 + y0, 8, 1, C.RD); p.rect(16, 10 + y0, 1, 5, C.RD);
  p.px(8, 13 + y0, C.RL); p.px(8, 14 + y0, C.RL);
  // yeux
  if (o.eyes === 'closed') {
    p.rect(8, 11 + y0, 3, 1, C.K); p.rect(13, 11 + y0, 3, 1, C.K);
  } else {
    p.rect(8, 9 + y0, 3, 4, C.W); p.rect(13, 9 + y0, 3, 4, C.W);
    if (o.eyes === 'wide') { p.px(9, 10 + y0, C.K); p.px(14, 10 + y0, C.K); }
    else { p.rect(9, 10 + y0, 1, 2, C.K); p.rect(14, 10 + y0, 1, 2, C.K); }
  }
  // bouche
  if (o.mouth === 'o') p.rect(11, 13 + y0, 2, 2, C.M);
  else { p.rect(10, 14 + y0, 4, 1, C.M); p.px(9, 13 + y0, C.M); p.px(14, 13 + y0, C.M); }
  capDome(p, y0);
  if (o.sweat) { p.px(4, 7 + y0, C.BL); p.px(4, 8 + y0, C.W); p.px(19, 6 + y0, C.BL); p.px(19, 7 + y0, C.W); }
}

function back(p, o) {
  const y0 = o.bob;
  frontLegs(p, o);
  p.rect(8, 22 + y0, 8, 3, C.B); p.rect(8, 24 + y0, 8, 1, C.BD); p.px(13, 23 + y0, C.BD);
  p.rect(8, 17 + y0, 8, 5, C.R); p.rect(8, 17 + y0, 1, 5, C.RD);
  p.rect(10, 16 + y0, 4, 1, C.R); p.px(10, 16 + y0, C.Y); p.px(13, 16 + y0, C.Y);
  frontArms(p, o, y0);
  p.rect(7, 9 + y0, 10, 6, C.R); p.rect(8, 15 + y0, 8, 1, C.RD); p.rect(7, 10 + y0, 1, 5, C.RD);
  p.px(15, 12 + y0, C.RL);
  capDome(p, y0);
  // visière retournée, tournée vers nous, avec le trou de la casquette
  p.rect(8, 8 + y0, 8, 3, C.B); p.rect(8, 10 + y0, 8, 1, C.BD); p.px(9, 8 + y0, C.BL);
  p.rect(11, 7 + y0, 2, 1, C.BD);
}

function side(p, o) {
  const y0 = o.bob, xs = [9, 11, 13];
  for (const i of [2, 1, 0]) {
    const lx = xs[i] + o.sdx[i], l = o.lifts[i];
    p.rect(lx, 25, 2, 4 - l, i === 2 ? C.RD : C.R);
    shoe(p, lx - 2, 29 - l);
  }
  p.rect(9, 22 + y0, 7, 3, C.B); p.rect(9, 24 + y0, 7, 1, C.BD); p.px(10, 22 + y0, C.BL);
  p.rect(10, 17 + y0, 5, 5, C.R); p.rect(14, 17 + y0, 1, 5, C.RD);
  p.rect(9, 19 + y0, 2, 2, C.Y); p.px(10, 17 + y0, C.Y); p.px(9, 18 + y0, C.Y);
  p.rect(11, 16 + y0, 3, 1, C.R);
  // bras qui balance
  const sw = o.swing || 0;
  p.rect(12 - sw, 17 + y0, 2, 4, C.R); p.px(12 - sw, 20 + y0, C.RD);
  // tête de profil, un gros œil vers l'avant
  p.rect(8, 9 + y0, 8, 6, C.R); p.rect(9, 15 + y0, 6, 1, C.RD); p.rect(15, 10 + y0, 1, 5, C.RD);
  p.px(13, 13 + y0, C.RL);
  if (o.eyes === 'closed') p.rect(7, 11 + y0, 4, 1, C.K);
  else { p.rect(7, 9 + y0, 4, 4, C.W); p.rect(7, 10 + y0, 1, 2, C.K); }
  p.rect(7, 14 + y0, 3, 1, C.M);
  // casquette, visière vers l'arrière
  p.rect(10, 4 + y0, 5, 1, C.B); p.rect(9, 5 + y0, 7, 1, C.B); p.rect(8, 6 + y0, 9, 2, C.B);
  p.rect(8, 8 + y0, 9, 1, C.BD); p.px(11, 5 + y0, C.BL);
  p.rect(16, 8 + y0, 4, 1, C.BD); p.rect(17, 7 + y0, 3, 1, C.B);
}

function splat(p) {
  // casquette envolée, ToeJam aplati comme une crêpe, yeux en croix
  p.rect(0, 23, 5, 2, C.B); p.rect(0, 25, 6, 1, C.BD);
  p.rect(5, 26, 14, 1, C.R); p.rect(3, 27, 18, 3, C.R); p.rect(3, 30, 18, 1, C.RD); p.rect(5, 31, 14, 1, C.RD);
  for (const ex of [7, 13]) { p.px(ex, 27, C.K); p.px(ex + 2, 27, C.K); p.px(ex + 1, 28, C.K); p.px(ex, 29, C.K); p.px(ex + 2, 29, C.K); }
  p.rect(10, 30, 3, 1, C.M);
  p.rect(19, 24, 3, 2, C.S); p.rect(19, 23, 3, 1, C.ST); p.rect(21, 27, 3, 2, C.S);
  p.px(11, 21, C.Y); p.px(10, 22, C.Y); p.px(12, 22, C.Y); p.px(11, 23, C.Y);
  p.px(16, 20, C.Y); p.px(4, 20, C.Y);
}

export function drawToeJamSheet() {
  const [sheet, sx] = makeCanvas(FW * NCOLS, FH * NROWS);
  for (let row = 0; row < NROWS; row++) {
    for (let col = 0; col < NCOLS; col++) {
      const [c, x] = makeCanvas(FW, FH);
      const p = painter(x), o = pose(col);
      if (col === COL.splat) splat(p);
      else if (col >= COL.fall0) front(p, o);
      else if (row === 0) front(p, o);
      else if (row === 1) back(p, o);
      else side(p, o);
      outline(x, FW, FH);
      sx.drawImage(c, col * FW, row * FH);
    }
  }
  return sheet;
}
