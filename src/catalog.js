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
