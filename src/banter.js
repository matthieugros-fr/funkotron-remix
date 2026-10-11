// Les répliques en bulle, en parler de la street marseillaise :
// - ToeJam est perché mais nerveux : il parle vite, s'emballe, s'énerve pour un rien ;
// - Earl est défoncé et blasé : phrases courtes, lentes, rien ne l'étonne.
// Une bulle par personnage à la fois, et pas plus d'une toutes les huit secondes, sauf moment important.
// Chaque réplique a un identifiant (personnage_situation_n) : si public/voix/lignes/<identifiant>.mp3 existe, elle est dite.
const L = {
  fall: {
    toejam: ['NAN NAN NAN NAN... PUTAIN !', 'WOLLAH ÇA DESCEND !', 'LA PUTAIN DE SES MORTS, LE VIDE !'],
    earl: ["BON... J'DESCENDS.", "TRANQUILLE. J'AI VU PIRE.", 'OH. LE SOL. IL EST PARTI.'],
  },
  mateFall: {
    toejam: ["EARL ?! ... AH NAN, IL EST JUSTE EN BAS.", "WESH LE SANG, T'ES OÙ ?!"],
    earl: ["TOEJAM... T'ES OÙ, LE SANG ?", 'IL EST TOMBÉ. DÉGUN EST SURPRIS.'],
  },
  left: {
    toejam: ['ET MOI, BALTRINGUE ?!', "IL M'A LAISSÉ ! ÇA FAIT CHAUFFER, LÀ !"],
    earl: ["TRANQUILLE... J'PRENDRAI LE PROCHAIN. DANS UN AN.", "SANS MOI ? T'ES UNE VICTIME, TOI."],
  },
  reunion: {
    toejam: ['TÉMA LE GROS DARON, IL EST LÀ !', "WESH LE SANG ! T'ÉTAIS OÙ ?"],
    earl: ["AH... T'ES LÀ. J'AVAIS PAS REMARQUÉ.", 'ON EST BIEN, LÀ. ON EST BIEN.'],
  },
  miam: {
    toejam: ['ÇA CALE, ÇA, WOLLAH.', "C'EST TARPIN BON !"],
    earl: ["J'AVAIS TROP LA DALLE...", 'MMMH... ENCORE.'],
  },
  beurk: {
    toejam: ["C'EST QUOI CETTE DINGUERIE ? C'EST DÉGUEULASSE !", "LA PUTAIN DE SES MORTS, C'EST PÉRIMÉ !"],
    earl: ['ÇA A LE GOÛT DU SEUM.', 'MÊME EMPÉGUÉ, JE MANGE PAS ÇA.'],
  },
  present: {
    toejam: ['UN CADEAU ! OUVRE, OUVRE, OUVRE !', "C'EST À MOI ÇA. TOUCHE PAS."],
    earl: ['UN PAQUET... ON VERRA. OU PAS.', "J'L'OUVRIRAI DEMAIN. OU JAMAIS."],
  },
  groove: {
    toejam: ['TÉMA LE FLEX, FRÉROT !', 'ÇA BOULÈGUE OU QUOI ?'],
    earl: ["ÇA... C'EST VALIDÉ.", 'BOUGE PAS. JE DANSE. ENFIN... JE BOUGE.'],
  },
  ko: {
    toejam: ["BOUGE PAS, J'ARRIVE LE SANG !", 'ME LÂCHE PAS, BALTRINGUE !'],
    earl: ["J'ARRIVE... TRANQUILLEMENT.", 'MEURS PAS, ÇA FAIT DES PAPIERS.'],
  },
  revived: {
    toejam: ['WOLLAH SES GRANDS MORTS, J\'AI VU LA LUMIÈRE.', 'MERCI LE SANG. JE FAISAIS SEMBLANT.'],
    earl: ['JE ME REPOSAIS, C\'EST TOUT.', 'ON EN PARLE PLUS.'],
  },
  gift: {
    toejam: ["POUR MOI ? T'ES UN VRAI, TOI.", "LA FAMILLE, C'EST LA FAMILLE."],
    earl: ['MERCI... JE LE GARDE.', "C'EST L'INTENTION QUI COMPTE. UN PEU."],
  },
  friendly: {
    toejam: ['WESH ! TU VAS FAIRE QUOI, BALTRINGUE ?', 'ÇA FAIT CHAUFFER, LÀ !'],
    earl: ['TRÈS DRÔLE. LA PUTAIN DE TES MORTS.', 'JE VAIS TE LA RENDRE, CELLE-LÀ.'],
  },
  vault: {
    toejam: ['ON EST RICHES, WOLLAH !', "C'EST LA PAIE, LE SANG !"],
    earl: ["LE TRAVAIL D'ÉQUIPE... ÇA EXISTE DONC.", "PAS MAL. J'VAIS M'ACHETER UN CANAPÉ."],
  },
  funk: {
    toejam: ["QUI C'EST LE PATRON DE LA PISTE ?!", 'TOUT LE MONDE BOULÈGUE !'],
    earl: ['JE SUIS LA PISTE.', "ÇA, MESSIEURS... C'EST DU FUNK."],
  },
  piece: {
    toejam: ['UN MORCEAU, WOLLAH SES GRANDS MORTS !', 'ON RENTRE AU BLED, FRÉROT !'],
    earl: ['LE VAISSEAU SE RECOLLE... TRANQUILLE.', 'UN DE PLUS. ON EST PAS PRESSÉS.'],
  },
  chase: {
    dentist: { toejam: ["UN DENTISTE ?! J'AI RIEN FAIT, WOLLAH !"], earl: ['RANGE TA ROULETTE, TOI.'] },
    nerds: { toejam: ['LES INTELLOS ! ILS VONT ME FAIRE UN EXPOSÉ !'], earl: ['DES INTELLOS... JE DORS DÉJÀ.'] },
    hamster: { toejam: ['UN HAMSTER EN BOULE ?! FADA !'], earl: ['UN HAMSTER... EN BOULE. OK.'] },
    cupid: { toejam: ['CUPIDON ? DÉGAGE, JE SUIS PAS PRÊT !'], earl: ["CUPIDON... J'AI PAS LE TEMPS D'AIMER."] },
    devil: { toejam: ['UN DIABLE ! ÇA FAIT CHAUFFER !'], earl: ['UN DIABLE. IL A FUMÉ QUOI, LUI ?'] },
    boogey: { toejam: ["J'AI PAS PEUR... J'AI PAS PEUR... J'AI PEUR !"], earl: ['UN FANTÔME. MANQUAIT PLUS QUE ÇA.'] },
    mower: { toejam: ['LA TONDEUSE ! COURS, BALTRINGUE !'], earl: ['UNE TONDEUSE. ELLE ROULE PLUS VITE QUE MOI.'] },
    cart: { toejam: ['TÉMA LA DAME AU CADDIE, ELLE EST FADA !'], earl: ['LA DAME AU CADDIE... LAISSE-LA PASSER.'] },
    mole: { toejam: ['TOUCHE PAS À MES CADEAUX, LA TAUPE !'], earl: ['UNE TAUPE... ELLE VEUT MON SAC. COURAGE.'] },
    chickens: { toejam: ["DES POULETS ARMÉS ! C'EST LA HESS !"], earl: ['DES POULETS QUI TIRENT... NORMAL.'] },
    any: { toejam: ['ET TU VAS FAIRE QUOI, BALTRINGUE ?', 'OH NAN...'], earl: ["QU'EST-CE TU ME VEUX, TOI ?", 'ENCORE UN...'] },
  },
  biome: {
    'LA PRAIRIE': { toejam: ["DE L'HERBE ! ... C'EST PAS LA BONNE."], earl: ["DE L'HERBE... PAS LA BONNE."] },
    'LA BANLIEUE': { toejam: ['TÉMA LES PAVILLONS. LA HESS DE LUXE.'], earl: ['LA BANLIEUE... ÇA DORT, ICI.'] },
    'LE DÉSERT': { toejam: ['IL FAIT TARPIN CHAUD !'], earl: ['DU SABLE... ET DÉGUN.'] },
    "LA FORÊT D'AUTOMNE": { toejam: ['ÇA SENT LA CHÂTAIGNE, ICI.'], earl: ['LES FEUILLES TOMBENT... COMME MOI.'] },
    'LA BANQUISE': { toejam: ['ÇA CAILLE, LE SANG !'], earl: ["J'SENS PLUS MES PIEDS. TANT MIEUX."] },
    'LE MARAIS': { toejam: ['ÇA PUE LA MORT, ICI !'], earl: ['ÇA CLAPOTE... ÇA PUE... ÇA VA.'] },
    'LE PAYS DES BONBONS': { toejam: ['DES BONBONS ! JE VAIS PERDRE MES DENTS !'], earl: ['DU SUCRE PARTOUT... JE VAIS MOURIR HEUREUX.'] },
    'LA FORÊT DES CHAMPIGNONS': { toejam: ['DES CHAMPIGNONS... JE DIS RIEN.'], earl: ['DES CHAMPIGNONS... JE TOUCHE À RIEN. PROMIS.'] },
    'LA LUNE': { toejam: ["Y A DÉGUN, ICI ! C'EST MORT !"], earl: ['LA LUNE... ON EST BIEN, LÀ.'] },
    'LE VOLCAN': { toejam: ['ÇA FAIT CHAUFFER, ICI !'], earl: ['ÇA FUME... COMME MOI.'] },
  },
};

// identifiant d'une catégorie (pour les fichiers de voix) : sans accents ni espaces
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// toutes les répliques, avec leur identifiant (pour générer les voix)
export function allLines() {
  const out = [];
  const add = (key, set) => { for (const who of ['toejam', 'earl']) (set[who] || []).forEach((text, i) => out.push({ id: `${who}_${key}_${i + 1}`, who, text })); };
  for (const [ev, set] of Object.entries(L)) {
    if (ev === 'chase' || ev === 'biome') for (const [k, s] of Object.entries(set)) add(`${ev}-${slug(k)}`, s);
    else add(ev, set);
  }
  return out;
}

export function banterLine(kind, ev, extra) {
  let set = L[ev], key = ev;
  if (ev === 'chase') { set = L.chase[extra] || L.chase.any; key = `chase-${slug(L.chase[extra] ? extra : 'any')}`; }
  if (ev === 'biome') { set = L.biome[extra]; key = `biome-${slug(extra || '')}`; }
  const list = set?.[kind] || set?.toejam;
  if (!list?.length) return null;
  const i = Math.floor(Math.random() * list.length);
  return { text: list[i], id: `${kind}_${key}_${i + 1}` };
}

// p : le joueur qui parle ; force : passe outre le délai entre deux bulles
export function banter(g, p, ev, { force = false, extra, chance = 1 } = {}) {
  if (!p?.active || g.state !== 'play' || Math.random() > chance) return false;
  if (!force && g.t - (p.bubbleT ?? -99) < 8) return false;
  const line = banterLine(p.kind, ev, extra);
  if (!line) return false;
  p.bubbleT = g.t;
  g.hud.bubble(p, line.text);
  g.speak?.(line.id);
  return true;
}
