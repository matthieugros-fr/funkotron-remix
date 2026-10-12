// Ce qu'on trouve sur les îles : les cadeaux, leurs emballages, les morceaux du vaisseau.

// dur : durée de l'effet en secondes ; price : prix à la boîte aux lettres (absent = pas en vente).
// weight : fréquence, calée sur l'original (vingt sortes de cadeaux, des baskets partout, peu de promotions).
export const PRESENTS = [
  { id: 'rocket', name: 'PATINS-FUSÉES', sub: "LA SÉCURITÉ, C'EST SURFAIT.", weight: 7, dur: 16, price: 4 },
  { id: 'wings', name: "AILES D'ICARE", sub: 'NE VOLE PAS TROP PRÈS DU SOLEIL.', weight: 6, dur: 16, price: 5 },
  { id: 'spring', name: 'CHAUSSURES À RESSORTS', sub: 'BOING. BOING. BOING.', weight: 7, dur: 16, price: 4 },
  { id: 'hitops', name: 'BASKETS MONTANTES', sub: 'LE STYLE, PUIS LA VITESSE.', weight: 10, dur: 25, price: 3 },
  { id: 'tomatoes', name: 'TOMATES', sub: 'DIX TOMATES. TOUCHE F POUR LANCER.', weight: 9, price: 2 },
  { id: 'rain', name: 'NUAGE DE PLUIE', sub: 'IL PLEUT. SUR TOI SEULEMENT.', weight: 5, dur: 15 },
  { id: 'bummer', name: 'TOTAL BUMMER', sub: 'LA VIE EST DURE. MOINS UNE VIE.', weight: 3 },
  { id: 'random', name: 'RANDOMISEUR', sub: 'PLUS PERSONNE NE SAIT RIEN.', weight: 3 },
  { id: 'door', name: 'PORTE', sub: "AILLEURS, C'EST FORCÉMENT MIEUX.", weight: 6, price: 3 },
  { id: 'jackpot', name: 'JACKPOT', sub: 'LE FUNK, ÇA PAIE.', weight: 7 },
  { id: 'life', name: 'VIE EN PLUS', sub: 'UNE DE PLUS. NE LA GÂCHE PAS.', weight: 3, price: 9 },
  { id: 'telescope', name: 'TÉLESCOPE', sub: "TOUT L'ÉTAGE D'UN COUP D'OEIL.", weight: 5, price: 3 },
  { id: 'innertube', name: 'BOUÉE', sub: "L'EAU NE TE RALENTIT PLUS. LA DIGNITÉ, SI.", weight: 5, dur: 30, price: 2 },
  { id: 'slingshot', name: 'LANCE-PIERRE', sub: 'DES CAILLOUX À VOLONTÉ. TOUCHE F. VISE BIEN, OU PAS.', weight: 5, dur: 25, price: 4 },
  { id: 'rosebush', name: 'ROSIER', sub: 'TU ES UN ROSIER. PERSONNE NE REGARDE UN ROSIER.', weight: 4, dur: 20, price: 3 },
  { id: 'decoy', name: 'LEURRE', sub: "UN TOI EN CARTON. ILS N'Y VERRONT QUE DU FEU.", weight: 4, dur: 15, price: 3 },
  { id: 'promotion', name: 'PROMOTION', sub: 'PISTONNÉ. ON NE POSE PAS DE QUESTIONS.', weight: 3 },
  { id: 'earthling', name: 'TERRIEN SURPRISE', sub: "IL ÉTAIT DANS LE PAQUET. IL N'EST PAS CONTENT.", weight: 4 },
  { id: 'unfall', name: 'ANTI-CHUTE', sub: 'LE VIDE NE VEUT PLUS DE TOI. UNE MINUTE.', weight: 4, dur: 60, price: 4 },
  { id: 'sundae', name: 'COUPE GLACÉE', sub: "TOUTE L'ÉNERGIE. ET UNE CERISE.", weight: 6, price: 3 },
  // ceux de l'original qui manquaient encore
  { id: 'telephone', name: 'TÉLÉPHONE', sub: "DRING. QUELQU'UN T'INDIQUE LE CHEMIN SUR LA CARTE.", weight: 5, price: 2 },
  { id: 'boombox', name: 'RADIOCASSETTE', sub: 'LES TERRIENS DES ENVIRONS DANSENT. ILS NE PEUVENT PAS RÉSISTER.', weight: 4, price: 4 },
  { id: 'rootbeer', name: 'ROOT BEER', sub: 'DE L\'ÉNERGIE EN BOUTEILLE. *BURP*', weight: 6, price: 2 },
  { id: 'extrabuck', name: 'UN BILLET', sub: "UN SEUL. C'EST DÉJÀ ÇA.", weight: 5 },
  { id: 'togetherness', name: 'ENSEMBLE', sub: 'LES COPAINS D\'ABORD.', weight: 3, price: 3 },
  { id: 'schoolbook', name: 'LIVRE DE CLASSE', sub: 'CHAPITRE 1. ZZZ…', weight: 3, dur: 5 },
  { id: 'tomrain', name: 'PLUIE DE TOMATES', sub: 'IL PLEUT DES TOMATES. SUR TA TÊTE.', weight: 3, dur: 8 },
];
export const PRESENT = Object.fromEntries(PRESENTS.map((p) => [p.id, p]));

// Vingt papiers cadeaux, un par sorte : l'emballage ne dit rien du contenu, tant qu'on n'en a pas ouvert un.
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
  { base: '#0f7a5a', ribbon: '#ffd23f', pattern: 'hearts' },
  { base: '#7a4a26', ribbon: '#5fcf5a', pattern: 'diamonds' },
  { base: '#6fd6ff', ribbon: '#ff4a5c', pattern: 'waves' },
  { base: '#b8b8c8', ribbon: '#8a5cff', pattern: 'grid' },
  { base: '#c2185b', ribbon: '#ffffff', pattern: 'hearts' },
  { base: '#1f3fa0', ribbon: '#ff9a2e', pattern: 'waves' },
  { base: '#e8c88a', ribbon: '#e8334a', pattern: 'grid' },
  { base: '#4a1a5a', ribbon: '#c8f04a', pattern: 'diamonds' },
  { base: '#ffe9a8', ribbon: '#2f6fe4', pattern: 'stars' },
  { base: '#2e7d32', ribbon: '#ff5fd2', pattern: 'stripes' },
  { base: '#ff7043', ribbon: '#2a2440', pattern: 'dots' },
  { base: '#9fa8da', ribbon: '#ffd23f', pattern: 'zigzag' },
  { base: '#5d4037', ribbon: '#ff9a2e', pattern: 'checks' },
  { base: '#00bfa5', ribbon: '#ffffff', pattern: 'hearts' },
  { base: '#f8bbd0', ribbon: '#6a1e8a', pattern: 'waves' },
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
// chaque rang apporte un petit avantage, qui s'ajoute aux précédents
export const RANKS = [
  { name: 'WIENER', xp: 0 },
  { name: 'DUFUS', xp: 30, perk: 'PSST PLUS RAPIDE.' },
  { name: 'POINDEXTER', xp: 80, perk: 'UN EMBALLAGE RÉVÉLÉ.' },
  { name: 'PEANUT', xp: 150, perk: 'LA BOUSSOLE TOUJOURS LÀ (MORCEAU OU ASCENSEUR).' },
  { name: 'DUDE', xp: 240, perk: 'LES REPAS SOIGNENT 20% DE PLUS.' },
  { name: 'BRO', xp: 350, perk: 'UNE TOMATE EN CHASSE DEUX.' },
  { name: 'HOMEY', xp: 480, perk: 'LES TERRIENS TE REPÈRENT MOINS.' },
  { name: 'RAPMASTER', xp: 620, perk: 'UN BILLET PAR TERRIEN CHASSÉ.' },
  { name: 'RAPPER', xp: 760, perk: 'BOÎTE AUX LETTRES : MOINS 30%.' },
  { name: 'FUNK LORD', xp: 900, perk: "L'ÉNERGIE REVIENT TOUTE SEULE." },
];
// les défis du monde aléatoire, et ce qu'ils rapportent au score
export const CHALLENGES = [
  { id: 'vie', name: 'UNE SEULE VIE', mult: 2 },
  { id: 'carte', name: 'SANS CARTE', mult: 1.5 },
  { id: 'rage', name: 'TERRIENS ENRAGÉS', mult: 1.8 },
  { id: 'chrono', name: 'CONTRE LA MONTRE', mult: 1.5, time: 1200 },
];
// à partir de quel rang chaque avantage s'applique
export const PERK = { sneak: 1, wrap: 2, radar: 3, food: 4, splat: 5, stealth: 6, bounty: 7, discount: 8, regen: 9 };
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
// Vitesses calées sur l'original : presque tous plus lents que ToeJam (3,6) ; les petits diables et le hamster
// sont les plus lents, la tondeuse se distance, la dame au caddie fonce au hasard.
export const EARTHLINGS = {
  dentist: { name: 'LE DENTISTE FOU', from: 0, weight: 4, speed: 1.8, chase: 3.0, sight: 5.5, dmg: 15, knock: 6, sound: 'perceuse' },
  nerds: { name: "LE TROUPEAU D'INTELLOS", from: 1, weight: 3, speed: 1.2, chase: 2.5, sight: 6, dmg: 6, knock: 3, sound: 'intellos' },
  hamster: { name: 'LE HAMSTER EN BOULE', from: 2, weight: 3, speed: 1.2, chase: 1.9, sight: 6, dmg: 8, knock: 10, sound: 'hamster' },
  cupid: { name: 'CUPIDON', from: 3, weight: 2, speed: 1.8, chase: 2.6, sight: 7, dmg: 0, knock: 1, sound: 'cupidon', flies: true },
  devil: { name: 'LE PETIT DIABLE', from: 4, weight: 3, speed: 1.2, chase: 1.9, sight: 5.5, dmg: 10, knock: 8, sound: 'diable' },
  opera: { name: 'LA CANTATRICE', from: 5, weight: 2, speed: 0.8, chase: 1.2, sight: 5, dmg: 0, knock: 0, sound: 'cantatrice' },
  mower: { name: "L'HOMME À LA TONDEUSE", from: 3, weight: 2, speed: 1.4, chase: 2.8, sight: 6, dmg: 14, knock: 9, sound: 'tondeuse' },
  mole: { name: 'LA TAUPE CHAPARDEUSE', from: 4, weight: 2, speed: 1.6, chase: 2.8, sight: 6.5, dmg: 3, knock: 3, sound: 'taupe' },
  boogey: { name: 'LE CROQUE-MITAINE', from: 6, weight: 2, speed: 1.4, chase: 2.9, sight: 6, dmg: 18, knock: 7, sound: 'croquemitaine' },
  cart: { name: 'LA DAME AU CADDIE', from: 7, weight: 2, speed: 2.4, chase: 5.0, sight: 7, dmg: 12, knock: 12, sound: 'caddie' },
  chickens: { name: 'LES POULETS ARTILLEURS', from: 8, weight: 2, speed: 1.2, chase: 2.2, sight: 9.5, dmg: 5, knock: 4, sound: 'poulet' },
  santa: { name: 'LE PÈRE NOËL', from: 999, weight: 0, speed: 1, chase: 0, sight: 0, dmg: 0, knock: 0, sound: 'perenoel', friendly: true },
  // la danseuse fait danser au contact (amicale sur Funkotron et au niveau secret : voir gen.js, makeSpecial)
  hula: { name: 'LA DANSEUSE HAWAÏENNE', from: 2, weight: 1, speed: 1.0, chase: 2.6, sight: 6, dmg: 0, knock: 0, sound: 'sage' },
  wiseman: { name: 'LE SAGE EN CAROTTE', from: 1, weight: 0, speed: 0.6, chase: 0, sight: 0, dmg: 0, knock: 0, sound: 'sage', friendly: true },
  // les nouveaux venus : l'essaim (dans la pioche), les autres placés à part (gen.js, placeCreatures)
  bees: { name: 'LES ABEILLES', from: 1, weight: 2, speed: 1.4, chase: 4.4, sight: 6, dmg: 3, knock: 1, sound: 'ailes', flies: true },
  shark: { name: 'LE REQUIN', from: 0, weight: 0, speed: 1.6, chase: 4.6, sight: 7, dmg: 12, knock: 4, sound: 'eclaboussure' },
  wizard: { name: 'LE SORCIER', from: 1, weight: 0, speed: 0.5, chase: 0, sight: 0, dmg: 0, knock: 0, sound: 'sage', friendly: true },
  tornado: { name: 'LA TORNADE', from: 5, weight: 0, speed: 3.0, chase: 3.0, sight: 8, dmg: 0, knock: 0, sound: 'ailes' },
  truck: { name: 'LE CAMION DE GLACES', from: 9, weight: 0, speed: 3.4, chase: 3.4, sight: 0, dmg: 25, knock: 5, sound: 'tondeuse' },
  mailbox: { name: 'LA BOÎTE AUX LETTRES', from: 999, weight: 0, speed: 1.6, chase: 3.1, sight: 8, dmg: 12, knock: 6, sound: 'boite' },
};
