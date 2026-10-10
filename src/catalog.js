// Ce qu'on trouve sur les îles : les cadeaux, leurs emballages, les morceaux du vaisseau.

// dur : durée de l'effet en secondes ; price : prix à la boîte aux lettres (absent = pas en vente)
export const PRESENTS = [
  { id: 'rocket', name: 'PATINS-FUSÉES', sub: "LA SÉCURITÉ, C'EST SURFAIT.", weight: 9, dur: 16, price: 4 },
  { id: 'wings', name: "AILES D'ICARE", sub: 'NE VOLE PAS TROP PRÈS DU SOLEIL.', weight: 7, dur: 16, price: 5 },
  { id: 'spring', name: 'CHAUSSURES À RESSORTS', sub: 'BOING. BOING. BOING.', weight: 8, dur: 16, price: 4 },
  { id: 'hitops', name: 'BASKETS MONTANTES', sub: 'LE STYLE, PUIS LA VITESSE.', weight: 12, dur: 25, price: 3 },
  { id: 'tomatoes', name: 'TOMATES', sub: 'DIX TOMATES. TOUCHE F POUR LANCER.', weight: 10, price: 2 },
  { id: 'rain', name: 'NUAGE DE PLUIE', sub: 'IL PLEUT. SUR TOI SEULEMENT.', weight: 6, dur: 15 },
  { id: 'bummer', name: 'TOTAL BUMMER', sub: 'LA VIE EST DURE. MOINS UNE VIE.', weight: 4 },
  { id: 'random', name: 'RANDOMISEUR', sub: 'PLUS PERSONNE NE SAIT RIEN.', weight: 4 },
  { id: 'door', name: 'PORTE', sub: "AILLEURS, C'EST FORCÉMENT MIEUX.", weight: 7, price: 3 },
  { id: 'jackpot', name: 'JACKPOT', sub: 'LE FUNK, ÇA PAIE.', weight: 8 },
  { id: 'life', name: 'VIE EN PLUS', sub: 'UNE DE PLUS. NE LA GÂCHE PAS.', weight: 4, price: 9 },
  { id: 'telescope', name: 'TÉLESCOPE', sub: "TOUT L'ÉTAGE D'UN COUP D'OEIL.", weight: 7, price: 3 },
];
export const PRESENT = Object.fromEntries(PRESENTS.map((p) => [p.id, p]));

// Douze papiers cadeaux : l'emballage ne dit rien du contenu, tant qu'on n'en a pas ouvert un.
export const WRAPS = [
  { base: '#ff6fb5', ribbon: '#ffe36b', pattern: 'dots' },
  { base: '#2fd3c4', ribbon: '#ff4a5c', pattern: 'stripes' },
  { base: '#8a5cff', ribbon: '#ffffff', pattern: 'stars' },
  { base: '#ffd23f', ribbon: '#2f6fe4', pattern: 'checks' },
  { base: '#5fcf5a', ribbon: '#ff8a3a', pattern: 'zigzag' },
  { base: '#ff4a4a', ribbon: '#ffffff', pattern: 'dots' },
  { base: '#3a7bff', ribbon: '#ffd23f', pattern: 'stripes' },
  { base: '#ff9a2e', ribbon: '#8a5cff', pattern: 'checks' },
  { base: '#f2f2f2', ribbon: '#ff4a5c', pattern: 'stars' },
  { base: '#2a2440', ribbon: '#ff5fd2', pattern: 'zigzag' },
  { base: '#c8f04a', ribbon: '#2a2440', pattern: 'dots' },
  { base: '#c9a4ff', ribbon: '#2fd3c4', pattern: 'plain' },
];

export const PIECES = [
  'LE NEZ DE LA FUSÉE', "L'AILERON GAUCHE", "L'AILERON DROIT", 'LE RÉACTEUR', 'LE HUBLOT',
  'LA COQUE', "L'ANTENNE", 'LE GROS HAUT-PARLEUR', 'LA TUYÈRE', 'LE SIÈGE DU PILOTE',
];

export function rollPresent(r) {
  const total = PRESENTS.reduce((s, p) => s + p.weight, 0);
  let x = r() * total;
  for (const p of PRESENTS) { x -= p.weight; if (x <= 0) return p.id; }
  return PRESENTS[0].id;
}

// Les rangs de ToeJam, gagnés en explorant (points d'expérience cumulés).
export const RANKS = [
  { name: 'WIENER', xp: 0 }, { name: 'DUFUS', xp: 20 }, { name: 'POINDEXTER', xp: 45 }, { name: 'PEANUT', xp: 80 },
  { name: 'DUDE', xp: 125 }, { name: 'BRO', xp: 180 }, { name: 'HOMEY', xp: 250 }, { name: 'RAPMASTER', xp: 330 },
  { name: 'RAPPER', xp: 420 }, { name: 'FUNK LORD', xp: 520 },
];
export const rankOf = (xp) => { let r = 0; RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; };

// La nourriture qui traîne sur les îles : de l'énergie, sauf le poisson.
export const FOODS = [
  { id: 'burger', name: 'HAMBURGER', heal: 20, weight: 5 },
  { id: 'cake', name: 'PART DE GÂTEAU', heal: 30, weight: 3 },
  { id: 'fries', name: 'FRITES', heal: 15, weight: 5 },
  { id: 'melon', name: 'PASTÈQUE', heal: 25, weight: 3 },
  { id: 'sundae', name: 'COUPE GLACÉE', heal: 40, weight: 2 },
  { id: 'fish', name: 'POISSON DOUTEUX', heal: -15, weight: 2 },
];
export const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export function rollFood(r) {
  const total = FOODS.reduce((s, f) => s + f.weight, 0);
  let x = r() * total;
  for (const f of FOODS) { x -= f.weight; if (x <= 0) return f.id; }
  return FOODS[0].id;
}

// Les terriens. from : premier étage (index) où ils apparaissent ; weight : fréquence.
// dmg : énergie perdue au contact ; knock : force de la bourrade (elle peut pousser dans le vide).
export const EARTHLINGS = {
  dentist: { name: 'LE DENTISTE FOU', from: 0, weight: 4, speed: 2.6, chase: 3.4, sight: 6, dmg: 15, knock: 6, sound: 'perceuse' },
  nerds: { name: "LE TROUPEAU D'INTELLOS", from: 1, weight: 3, speed: 1.4, chase: 2.4, sight: 7, dmg: 6, knock: 3, sound: 'intellos' },
  hamster: { name: 'LE HAMSTER EN BOULE', from: 2, weight: 3, speed: 4.5, chase: 6.5, sight: 7, dmg: 8, knock: 10, sound: 'hamster' },
  cupid: { name: 'CUPIDON', from: 3, weight: 2, speed: 2.2, chase: 3.2, sight: 8, dmg: 0, knock: 1, sound: 'cupidon', flies: true },
  devil: { name: 'LE PETIT DIABLE', from: 4, weight: 3, speed: 3, chase: 4.4, sight: 6, dmg: 10, knock: 8, sound: 'diable' },
  opera: { name: 'LA CANTATRICE', from: 5, weight: 2, speed: 0.8, chase: 1.2, sight: 5, dmg: 0, knock: 0, sound: 'cantatrice' },
  wiseman: { name: 'LE SAGE EN CAROTTE', from: 1, weight: 0, speed: 0.6, chase: 0, sight: 0, dmg: 0, knock: 0, sound: 'sage', friendly: true },
};
