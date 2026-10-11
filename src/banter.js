// Les répliques en bulle : ToeJam (vif, un peu frimeur) et Earl (placide, pince-sans-rire).
// Une bulle par personnage à la fois, et pas plus d'une toutes les huit secondes, sauf moment important.
const L = {
  fall: { toejam: ["ÇA, C'ÉTAIT PRÉVU.", 'JE VOULAIS DESCENDRE, DE TOUTE FAÇON.', 'OUPS.'], earl: ['LA GRAVITÉ. ENCORE ELLE.', 'JE REVIENS. PEUT-ÊTRE.', 'BON.'] },
  mateFall: { toejam: ['EARL ? EARL !', 'IL REVIENDRA. SANS DOUTE.'], earl: ['ON SE RETROUVE EN BAS, VIEUX.', 'IL A TOUJOURS ÉTÉ PRESSÉ.'] },
  left: { toejam: ['HÉ ! ET MOI ?', "MERCI POUR L'ATTENTE."], earl: ['SANS MOI ? SYMPA.', "PRENDS TON TEMPS, J'AI QUE ÇA À FAIRE."] },
  reunion: { toejam: ["TU M'AS MANQUÉ. UN PEU.", 'TOPE LÀ, GROS !'], earl: ['ENFIN TE VOILÀ.', 'LE DUO EST DE RETOUR.'] },
  miam: { toejam: ['DÉLICIEUX. SANS DOUTE.', 'LE FUNK, ÇA CREUSE.'], earl: ['ENCORE.', 'UN PEU SEC. ÇA IRA.'] },
  beurk: { toejam: ['PÉRIMÉ DEPUIS 1987.', 'PLUS JAMAIS.'], earl: ['ÇA A UN GOÛT DE REGRET.', "MÊME MOI, J'AI DES LIMITES."] },
  present: { toejam: ['PAS DES CHAUSSETTES, PAS DES CHAUSSETTES...', 'UN CADEAU. POUR MOI. NORMAL.'], earl: ['OH. UN PAQUET.', 'ON VERRA BIEN.'] },
  groove: { toejam: ['BOUGE PAS. JE GROOVE.', "LE FUNK N'ATTEND PAS."], earl: ['UN PETIT PAS, POUR LA FORME.', 'REGARDE ET APPRENDS.'] },
  piece: { toejam: ['UN MORCEAU ! ON RENTRE BIENTÔT.', 'ET DE UN DE PLUS !'], earl: ['ÇA SE RECONSTRUIT.', 'LE VAISSEAU REMERCIE.'] },
  chase: {
    dentist: ['UN DENTISTE ? JE ME BROSSE LES DENTS !', 'PAS LA ROULETTE !'],
    nerds: ['DES BINOCLARDS. ILS VONT ME FAIRE UN EXPOSÉ.'],
    hamster: ['UN HAMSTER EN BOULE. BIEN SÛR.'],
    cupid: ['PAS CUPIDON, JE SUIS PAS PRÊT.'],
    devil: ['UN DIABLE. ÇA VA CHAUFFER.'],
    boogey: ["J'AI PAS PEUR. J'AI PAS PEUR."],
    mower: ['LA TONDEUSE ! COURS !'],
    cart: ['ELLE A LA PRIORITÉ, ELLE.'],
    mole: ['MES CADEAUX ! PAS TOUCHE !'],
    chickens: ['DES POULETS ARMÉS. LOGIQUE.'],
    any: ['OH NON.', 'ON NE SE CONNAÎT PAS, SI ?'],
  },
  biome: {
    'LA PRAIRIE': "DE L'HERBE. ORIGINAL.", 'LA BANLIEUE': 'ÇA SENT LE BARBECUE.', 'LE DÉSERT': 'IL FAIT SOIF, ICI.',
    "LA FORÊT D'AUTOMNE": "C'EST JOLI, LES FEUILLES MORTES.", 'LA BANQUISE': 'IL CAILLE, MON POTE.', 'LE MARAIS': 'ÇA CLAPOTE. ÇA PUE.',
    'LE PAYS DES BONBONS': 'MES DENTS PLEURENT DÉJÀ.', 'LA FORÊT DES CHAMPIGNONS': 'JE NE TOUCHE À RIEN, ICI.', 'LA LUNE': 'UN PETIT PAS POUR MOI...',
    'LE VOLCAN': 'ÇA SENT LE ROUSSI.',
  },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function banterLine(kind, ev, extra) {
  if (ev === 'chase') return pick(L.chase[extra] || L.chase.any);
  if (ev === 'biome') return L.biome[extra] || null;
  const set = L[ev];
  return set ? pick(set[kind] || set.toejam) : null;
}

// p : le joueur qui parle ; force : passe outre le délai entre deux bulles
export function banter(g, p, ev, { force = false, extra, chance = 1 } = {}) {
  if (!p?.active || g.state !== 'play' || Math.random() > chance) return false;
  if (!force && g.t - (p.bubbleT ?? -99) < 8) return false;
  const text = banterLine(p.kind, ev, extra);
  if (!text) return false;
  p.bubbleT = g.t;
  g.hud.bubble(p, text);
  return true;
}
