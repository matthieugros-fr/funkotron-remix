// Ce qui survit à la fermeture de l'onglet : la partie en cours, les réglages, les astuces déjà vues.
// Tout passe par le stockage local du navigateur ; s'il est indisponible (navigation privée…), le jeu
// fonctionne quand même, simplement sans mémoire.
const KEY = { game: 'funkotron.partie', settings: 'funkotron.reglages', tips: 'funkotron.astuces', book: 'funkotron.carnet', checkpoint: 'funkotron.reprise' };

function read(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function write(k, v) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* pas de mémoire */ }
}

// --- réglages ----------------------------------------------------------------------------------------------
export const DEFAULTS = { music: 0.8, sfx: 0.9, voices: true, quality: 1 };
export const settings = { ...DEFAULTS, ...(read(KEY.settings) || {}) };
export function saveSettings() { write(KEY.settings, settings); }

// --- astuces du tutoriel -------------------------------------------------------------------------------------
const seen = new Set(read(KEY.tips) || []);
export function tipSeen(id) { return seen.has(id); }
export function markTip(id) { seen.add(id); write(KEY.tips, [...seen]); }

// --- le carnet : les records, d'une partie à l'autre ---------------------------------------------------------------
export const carnet = { games: 0, wins: 0, bestLevel: 0, bestRank: 0, records: 0, bestTime: 0, scores: {}, ...(read(KEY.book) || {}) };
// note(c => { … }) : modifie le carnet puis l'enregistre
export function note(f) { f(carnet); write(KEY.book, carnet); }

// --- la partie -------------------------------------------------------------------------------------------------
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s, u8) => { const bin = atob(s); for (let i = 0; i < bin.length && i < u8.length; i++) u8[i] = bin.charCodeAt(i); };
const flags = (list) => (list || []).map((x) => (x.taken ? 1 : 0));

// Version des sauvegardes : elle change quand une même graine ne donne plus le même monde (2 : clairières et
// chemins étroits, vingt sortes de cadeaux). Une photographie d'une autre version est oubliée sans rien dire.
const VERSION = 4; // 3 : étages de 96 × 96, océan au premier étage ; 4 : île du premier étage resserrée, îlot secret au large
function readGame(k) {
  const s = read(k);
  if (s && s.v !== VERSION) { write(k, null); return null; }
  return s;
}
export function hasSave() { return !!readGame(KEY.game); }
export function clearSave() { write(KEY.game, null); }
// le point de reprise (tous les cinq étages) : une photographie à part, qui survit au game over
export function checkpointInfo() { const s = readGame(KEY.checkpoint); return s ? { level: s.players[0].level, seed: s.seed, coop: s.coop } : null; }
export function clearCheckpoint() { write(KEY.checkpoint, null); }

// Photographie de la partie : graine du monde (qui le recrée à l'identique) + tout ce qui a changé depuis.
export function saveGame(g, players, slot = 'game') {
  if (!g.world || g.state !== 'play') return;
  const levels = {};
  for (const L of g.world.all) {
    const d = L.data;
    if (!d.seen?.some((v) => v)) continue; // étage jamais visité
    levels[L.k] = {
      presents: flags(d.presents), bucks: flags(d.bucks), foods: flags(d.foods), piece: d.piece?.taken ? 1 : 0,
      earthlings: (d.earthlings || []).map((e) => [e.gone ? 1 : 0, e.left ?? null]),
      surprises: (d.surprises || []).map((x) => (x.done ? 1 : 0)),
      seen: b64(d.seen),
    };
  }
  write(KEY[slot], {
    v: VERSION, seed: g.seedCode, coop: g.coop, xp: g.xp, rank: g.rank, tomatoes: g.tomatoes, bucks: g.bucks, lives: g.lives,
    pieces: [...g.pieces], stats: g.stats, records: g.records || 0, challenge: g.challenge?.id || null, maxLv: g.maxLv || 0, cpLevel: g.cpLevel ?? null,
    bag: { items: [...g.bag.items], known: [...g.bag.known], wrapOf: g.bag.wrapOf },
    players: players.map((p) => ({ level: p.level, x: p.pos.x, z: p.pos.z, health: p.ko > 0 ? 40 : p.health, items: [...(p.bag?.items || [])], tomatoes: p.tomatoes || 0 })),
    levels,
  });
}

// Réapplique une photographie sur un monde fraîchement recréé à partir de la même graine.
export function loadGame(g, apply, slot = 'game') {
  const s = readGame(KEY[slot]);
  if (!s) return null;
  apply.newGame(s.seed, s.coop);
  Object.assign(g, { xp: s.xp, rank: s.rank, bucks: s.bucks, lives: s.lives, pieces: new Set(s.pieces), stats: s.stats, records: s.records || 0, maxLv: s.maxLv || 0, cpLevel: s.cpLevel ?? null });
  g.bag.items = new Map(s.bag.items);
  g.bag.known = new Set(s.bag.known);
  g.bag.wrapOf = s.bag.wrapOf;
  for (const [k, sv] of Object.entries(s.levels)) {
    const L = g.world.levels[+k];
    if (!L) continue;
    const d = L.data, set = (list, f) => (list || []).forEach((x, i) => { x.taken = !!f?.[i]; });
    set(d.presents, sv.presents); set(d.bucks, sv.bucks); set(d.foods, sv.foods);
    if (d.piece) d.piece.taken = !!sv.piece;
    (d.earthlings || []).forEach((e, i) => { const r = sv.earthlings?.[i]; if (r) { e.gone = !!r[0]; if (r[1] !== null) e.left = r[1]; } });
    unb64(sv.seen, d.seen);
    // le brouillard lit 0 ou 255 par case (les sauvegardes plus anciennes notaient 1)
    for (let q = 0; q < d.seen.length; q++) if (d.seen[q]) d.seen[q] = 255;
    d.fogDirty = true; d.blockSeen = null; d.lastReveal = null;
    (d.surprises || []).forEach((x, i) => { if (sv.surprises?.[i]) x.done = true; });
    // les étages déjà construits doivent refléter ce qui a été ramassé
    if (L.built) { g.world.unbuild(L); g.world.build(L); }
  }
  s.players.forEach((ps, i) => apply.place(i, ps));
  // sacs et tomates de chacun (les anciennes sauvegardes n'avaient qu'un sac commun et des tomates communes)
  s.players.forEach((ps, i) => apply.restore?.(i, ps, i === 0 ? s.tomatoes || 0 : 0));
  return s;
}
