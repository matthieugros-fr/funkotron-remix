// Les biomes : chaque étage a un biome principal et un biome secondaire, qui se partagent l'île par
// grandes régions. Un biome donne les couleurs du sol (avec ses taches), la matière des routes, le liquide
// des lacs, le grain de matière, le décor (et sa densité : bosquets, clairières), les particules d'ambiance.
// Le décor est rangé en trois tailles : big (arbres…), mid (buissons, rochers…), small (fleurs, touffes…).

export const LIQUIDS = {
  water: { deep: '#08339a', shore: '#1a8cb3', crest: '#eaf6ff', glow: 0, slow: 0.55 },
  oasis: { deep: '#0a6a8a', shore: '#3ad6c8', crest: '#ffffff', glow: 0, slow: 0.55 },
  pool: { deep: '#0a5ab8', shore: '#5ae0ff', crest: '#ffffff', glow: 0.15, slow: 0.55 },
  goo: { deep: '#34461a', shore: '#7a8a2c', crest: '#c0d070', glow: 0.05, slow: 0.4 },
  soda: { deep: '#a01a5a', shore: '#ff6ab0', crest: '#ffe0f0', glow: 0.1, slow: 0.5 },
  glow: { deep: '#0a2a6a', shore: '#3affe0', crest: '#d0fff8', glow: 0.7, slow: 0.55 },
  lava: { deep: '#b82000', shore: '#ff9a1a', crest: '#ffe070', glow: 1, slow: 0.5, burn: 28 },
  ice: { ice: true },
  none: { none: true },
};

export const ROADS = {
  asphalt: { cols: ['#5b6074', '#676c82'], dash: '#ffd23f', lip: '#a3a9bd' },
  dirt: { cols: ['#9a7a50', '#8a6a44'], dash: null, lip: '#7a5a38' },
  boards: { cols: ['#9a6a3a', '#86582e'], planks: '#4a3018', lip: '#5a3a1e' },
  candy: { cols: ['#fff4fa', '#ff4a7a'], checker: true, dash: null, lip: '#e05080' },
  snow: { cols: ['#d6cec2', '#c4bcb0'], dash: null, lip: '#a8a094' },
  glow: { cols: ['#2e2260', '#3a2c78'], dash: '#5affff', lip: '#2a1e50' },
  plates: { cols: ['#8a8e9a', '#9a9eaa'], planks: '#5a5e6a', lip: '#6a6e7a' },
  basalt: { cols: ['#2a2422', '#342c2a'], dash: '#ff7a2a', lip: '#1e1816' },
};

const STRATA = {
  earth: ['#9a6440', '#87552f', '#a5704a', '#7a4a2c'],
  sandstone: ['#c47a48', '#b06a3a', '#d08a58', '#9a5a30'],
  frozen: ['#8a90a8', '#7a8098', '#9aa0b8', '#6a7088'],
  candy: ['#7a3a2a', '#9a4a32', '#6a3020', '#c06a8a'],
  violet: ['#4a3a7a', '#3a2c66', '#5a4a8a', '#2e2254'],
  grey: ['#7a7a86', '#6a6a76', '#8a8a96', '#5a5a66'],
  ash: ['#5a2a1a', '#4a2216', '#6a3020', '#3a1a10'],
};

export const BIOMES = {
  prairie: {
    name: 'LA PRAIRIE', ground: ['#4fae45', '#62c252', '#3f9a3d'], patch: '#8fcf4f', lip: '#3c8a37',
    shore: ['#efd296', '#e2c07c'], shoreLip: '#d4b16c', strata: STRATA.earth, bottom: '#3a2419',
    road: 'asphalt', liquid: 'water', lakes: 0.64, detail: 'blades', tuft: ['#3f9a3d', '#5cbf4a', '#2f8a37'], carpet: 0.22,
    items: [['palm', 'big', 0.026, 0.3], ['bush', 'mid', 0.024, 0.42], ['rock', 'mid', 0.012, 0.38], ['flowers', 'small', 0.05], ['tuft', 'small', 0.1]],
    shoreItems: [['rock', 'mid', 0.03, 0.38], ['tuft', 'small', 0.05]],
    particles: 'butterflies',
  },
  banlieue: {
    name: 'LA BANLIEUE', ground: ['#5cb84a', '#6cc85a', '#4ea83e'], patch: '#7ad868', stripes: true, lip: '#3c8a37',
    shore: ['#cfc8b8', '#bfb8a8'], shoreLip: '#a8a090', strata: STRATA.earth, bottom: '#3a2419',
    road: 'asphalt', liquid: 'pool', lakes: 0.72, detail: 'blades', tuft: ['#4ea83e', '#5cb84a'], carpet: 0.08,
    items: [['house', 'big', 0.02, 0.95], ['roundtree', 'big', 0.02, 0.35], ['hedge', 'mid', 0.02, 0.45], ['lamp', 'mid', 0.008, 0.15],
      ['gnome', 'small', 0.008, 0.18], ['flowers', 'small', 0.04], ['tuft', 'small', 0.03]],
    shoreItems: [['lamp', 'mid', 0.02, 0.15]],
    treeCols: ['#3f9a3d', '#4cb34a', '#2f8a37'],
  },
  desert: {
    name: 'LE DÉSERT', ground: ['#e8b56a', '#f0c27a', '#d9a055'], patch: '#cf8f4f', lip: '#c48a48',
    shore: ['#d9a055', '#c98a4a'], shoreLip: '#b07a40', strata: STRATA.sandstone, bottom: '#5a3020',
    road: 'dirt', liquid: 'oasis', lakes: 0.75, detail: 'ripples', tuft: ['#b9a05a', '#9a8a4a'], carpet: 0.05,
    items: [['cactus', 'big', 0.022, 0.3], ['palm', 'big', 0.004, 0.3], ['deadbush', 'mid', 0.02], ['redrock', 'mid', 0.02, 0.4],
      ['skull', 'small', 0.006], ['tumbleweed', 'small', 0.01], ['tuft', 'small', 0.03]],
    shoreItems: [['redrock', 'mid', 0.03, 0.4], ['deadbush', 'small', 0.02]],
    particles: 'sand', pal: { sun: '#fff0c8', hemiGround: '#8a5a3a' },
  },
  automne: {
    name: "LA FORÊT D'AUTOMNE", ground: ['#a89a3c', '#bca23e', '#8e8a36'], patch: '#d8762a', lip: '#7a6a2a',
    shore: ['#cfb27a', '#bfa06a'], shoreLip: '#a88a5a', strata: STRATA.earth, bottom: '#3a2419',
    road: 'dirt', liquid: 'water', lakes: 0.66, detail: 'grain', tuft: ['#a89a3a', '#c0a040', '#8a7a2a'], carpet: 0.18,
    items: [['autumntree', 'big', 0.045, 0.32], ['pine', 'big', 0.012, 0.3], ['bush', 'mid', 0.012, 0.42], ['stump', 'mid', 0.008, 0.3],
      ['mushroom', 'small', 0.014], ['pumpkin', 'small', 0.008, 0.25], ['leaves', 'small', 0.05]],
    shoreItems: [['rock', 'mid', 0.03, 0.38], ['leaves', 'small', 0.04]],
    treeCols: ['#e8742a', '#d8402a', '#f0b030', '#c8582a'], particles: 'leaves', pal: { sun: '#ffd8a0' },
  },
  neige: {
    name: 'LA BANQUISE', ground: ['#e8f0fc', '#ffffff', '#d4e0f2'], patch: '#c0d2ec', lip: '#b8c8e0',
    shore: ['#c8d8ee', '#b8c8e2'], shoreLip: '#a8b8d4', strata: STRATA.frozen, bottom: '#2a2a40',
    road: 'snow', liquid: 'ice', lakes: 0.66, detail: 'snow', tuft: ['#c8d8e8', '#a8c0d4'], carpet: 0.04,
    items: [['snowpine', 'big', 0.035, 0.3], ['snowman', 'mid', 0.006, 0.3], ['icecrystal', 'mid', 0.01, 0.25], ['snowrock', 'mid', 0.012, 0.38], ['tuft', 'small', 0.02]],
    shoreItems: [['icecrystal', 'mid', 0.02, 0.25]],
    particles: 'snow', pal: { sun: '#ffffff', hemiSky: '#e8f4ff', hemiGround: '#7a8ab0' },
  },
  marais: {
    name: 'LE MARAIS', ground: ['#5a7a3a', '#4a6a32', '#6a8a40'], patch: '#4a4a26', lip: '#3a5a28',
    shore: ['#6a5a3a', '#5a4a30'], shoreLip: '#4a3a24', strata: STRATA.earth, bottom: '#2a1a12',
    road: 'boards', liquid: 'goo', lakes: 0.6, detail: 'grain', tuft: ['#6a8a3a', '#8a9a4a', '#4a6a2a'], carpet: 0.25,
    items: [['deadtree', 'big', 0.022, 0.3], ['bush', 'mid', 0.015, 0.42], ['stump', 'mid', 0.01, 0.3], ['reeds', 'small', 0.05], ['mushroom', 'small', 0.015], ['tuft', 'small', 0.06]],
    shoreItems: [['reeds', 'small', 0.12]],
    particles: 'fireflies', pal: { hemiGround: '#3a4a2a', fog: '#1e3a2a' },
  },
  bonbons: {
    name: 'LE PAYS DES BONBONS', ground: ['#ffb0d8', '#ffc4e4', '#f09ac8'], patch: '#c8b0ff', lip: '#e080b0',
    shore: ['#fff0c8', '#ffe4a8'], shoreLip: '#e8c888', strata: STRATA.candy, bottom: '#4a2020',
    road: 'candy', liquid: 'soda', lakes: 0.66, detail: 'grain', tuft: ['#ff8ad8', '#ffd0f0', '#c8a0ff'], carpet: 0.12,
    items: [['candytree', 'big', 0.03, 0.3], ['lollipop', 'mid', 0.02, 0.15], ['giantflower', 'mid', 0.015, 0.15], ['gumdrop', 'small', 0.02, 0.2], ['flowers', 'small', 0.05]],
    shoreItems: [['gumdrop', 'small', 0.03, 0.2]],
    particles: 'sparkles', pal: { hemiSky: '#ffe0f4', hemiGround: '#a05a8a' },
  },
  champis: {
    name: 'LA FORÊT DES CHAMPIGNONS', ground: ['#3a3a8a', '#4a4aa0', '#30307a'], patch: '#5a3a9a', lip: '#2a2a6a',
    shore: ['#6a5aa8', '#5a4a98'], shoreLip: '#4a3a88', strata: STRATA.violet, bottom: '#1a1030',
    road: 'glow', liquid: 'glow', lakes: 0.66, detail: 'grain', tuft: ['#6a6ad0', '#8a7ae0', '#5a9ae0'], carpet: 0.2,
    items: [['bigshroom', 'big', 0.035, 0.32], ['crystal', 'mid', 0.012, 0.25], ['mushroom', 'small', 0.05], ['tuft', 'small', 0.06]],
    shoreItems: [['crystal', 'mid', 0.02, 0.25], ['mushroom', 'small', 0.05]],
    treeCols: ['#ff5fd2', '#3affe0', '#ffd23f', '#9a7aff'], particles: 'spores', pal: { hemiGround: '#3a2a8a', sun: '#d8e0ff' },
  },
  lune: {
    name: 'LA LUNE', ground: ['#b8b8c0', '#c8c8d0', '#a8a8b4'], patch: '#8a8a98', lip: '#9898a4',
    shore: ['#9a9aa8', '#8a8a98'], shoreLip: '#7a7a88', strata: STRATA.grey, bottom: '#2a2a34',
    road: 'plates', liquid: 'none', lakes: 1, detail: 'cracks', tuft: ['#9a9aa8'], carpet: 0,
    items: [['crater', 'mid', 0.03], ['moonrock', 'mid', 0.025, 0.38], ['crystal', 'mid', 0.006, 0.25], ['antenna', 'mid', 0.003, 0.2], ['pebbles', 'small', 0.05]],
    shoreItems: [['moonrock', 'mid', 0.03, 0.38]],
    treeCols: ['#9ad8ff', '#c8a0ff'], pal: { hemiSky: '#e0e4ff', hemiGround: '#4a4a5a', sun: '#ffffff' },
  },
  volcan: {
    name: 'LE VOLCAN', ground: ['#5e4a46', '#6e5650', '#4c3c3a'], patch: '#2e2624', lip: '#3a2a28',
    shore: ['#6a3a2a', '#5a3020'], shoreLip: '#4a2418', strata: STRATA.ash, bottom: '#1a0a08',
    road: 'basalt', liquid: 'lava', lakes: 0.66, detail: 'cracks', tuft: ['#5a4a3a', '#6a5a4a'], carpet: 0.03,
    items: [['charredtree', 'big', 0.018, 0.3], ['lavarock', 'mid', 0.03, 0.4], ['obsidian', 'mid', 0.012, 0.25], ['skull', 'small', 0.005], ['tuft', 'small', 0.02]],
    shoreItems: [['lavarock', 'mid', 0.04, 0.4]],
    particles: 'embers', pal: { hemiGround: '#6a2010', fog: '#3a1208', sun: '#ffc8a0' },
  },
};

// Biomes possibles selon la hauteur : on commence sur Terre, on finit dans l'étrange.
const TIERS = [
  { upTo: 5, pool: ['prairie', 'banlieue', 'automne', 'desert', 'marais'] },
  { upTo: 14, pool: ['prairie', 'banlieue', 'automne', 'desert', 'marais', 'neige', 'bonbons', 'champis'] },
  { upTo: 99, pool: ['automne', 'desert', 'marais', 'neige', 'bonbons', 'champis', 'lune', 'volcan'] },
];

// Un couple (principal, secondaire) par étage ; jamais deux fois le même principal de suite.
export function pickBiomes(count, r) {
  const out = [];
  let prev = null;
  for (let k = 0; k < count; k++) {
    if (k === 0) { out.push(['prairie', 'banlieue']); prev = 'prairie'; continue; }
    const pool = TIERS.find((t) => k <= t.upTo).pool;
    let a;
    do a = pool[Math.floor(r() * pool.length)]; while (a === prev);
    let b;
    do b = pool[Math.floor(r() * pool.length)]; while (b === a);
    out.push([a, b]);
    prev = a;
  }
  return out;
}
