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
  // le niveau secret : en arrivant, puis la drague des danseuses, façon dragueur des quartiers nord (et la relance
  // après le vent). ToeJam drague vite et fort, Earl drague... à sa façon.
  secret: {
    toejam: ['WESH... UN JACUZZI ET DES MEUFS ?! WOLLAH ON EST AU PARADIS !', 'TÉMA LE SANG ! ICI ÇA SENT LA MONOÏ ET LES BONNES AFFAIRES !'],
    earl: ["UN JACUZZI... DES DANSEUSES... J'SUIS MORT ET J'AI ÉTÉ GENTIL.", 'BON. MOI JE BOUGE PLUS D\'ICI.'],
  },
  drague: {
    toejam: [
      "TON PÈRE C'EST UN VOLEUR ! IL A PRIS LES DEUX PLUS BELLES ÉTOILES DU CIEL ET IL EN A FAIT TES YEUX !",
      "WESH LA FRAPPE ! T'AS UN 06 OU JE DOIS LE DEVINER ?",
      "T'ES PAS FATIGUÉE ? T'AS COURU DANS MA TÊTE TOUTE LA NUIT, WOLLAH !",
      "T'AURAIS PAS UN PLAN ? JE ME SUIS PERDU DANS TES YEUX, MA REINE.",
      "TÉMA : J'AI UN VAISSEAU. BON, IL EST EN DIX MORCEAUX. MAIS J'AI UN VAISSEAU.",
      "J'AI TROIS JAMBES, MA BELLE. POUR TOI, JE ME METS À GENOUX. LES TROIS.",
      "MÊME LA BONNE MÈRE, QUAND ELLE T'A VUE, ELLE S'EST RETOURNÉE.",
      "T'ES PLUS BELLE QUE LE VÉLODROME UN SOIR DE CLASICO, WOLLAH SES GRANDS MORTS.",
      "T'ES TELLEMENT FRAÎCHE QUE LE JACUZZI, IL A PRIS FROID.",
      "JE SUIS PAS PHOTOGRAPHE, MAIS NOUS DEUX, JE NOUS VOIS BIEN EN STORY.",
      "MA MÈRE ELLE VEUT UNE BELLE-FILLE TERRIENNE. T'ES LIBRE DIMANCHE ?",
      "T'ES LA HUITIÈME MERVEILLE DU MONDE. LES SEPT AUTRES, C'EST DES BALTRINGUES.",
    ],
    earl: [
      "T'ES TELLEMENT BELLE... J'AI ENLEVÉ MES LUNETTES. ... NAN, JE LES REMETS.",
      "TU CROIS AU COUP DE FOUDRE... OU JE REPASSE ? ... JE REPASSE PAS. FLEMME.",
      "MOI C'EST EARL. ... VOILÀ. C'ÉTAIT LA DRAGUE.",
      "SI LA BEAUTÉ C'ÉTAIT UN CRIME, TU PRENDS PERPÈTE. ET MOI JE VIENS AU PARLOIR. LE JEUDI.",
      "T'ES UN AIMANT ? ... J'ARRIVE PLUS À BOUGER. ... ENFIN, COMME D'HAB.",
      "JE SUIS PAS GROS, MA BELLE. JE SUIS DISPO EN GRAND FORMAT.",
      "T'AURAIS PAS UNE CHIPS ? ... NAN ? ... T'ES JOLIE QUAND MÊME.",
      "ON S'EST PAS DÉJÀ VUS ? ... DANS MES RÊVES. ... OU À LIDL.",
      "TON PÈRE IL EST BOULANGER ? ... PARCE QUE J'AI LA DALLE.",
      "LE JACUZZI ET MOI, ON A UN POINT COMMUN : ON BOUILLONNE. ... LENTEMENT.",
      "JE T'OFFRIRAIS BIEN UN VERRE... MAIS J'AI QUE DES TOMATES.",
      "T'AS DE BEAUX YEUX, TU SAIS. ... ET UN JACUZZI. SURTOUT UN JACUZZI.",
    ],
  },
  relance: {
    toejam: ["ELLE M'A CALCULÉ, T'AS VU ?! ELLE M'A CALCULÉ !", "C'EST UN OUI, ÇA. EN HAWAÏEN.", 'ELLE JOUE LA DIFFICILE. JE CONNAIS LE GAME.', "VAS-Y, C'EST TA PERTE, LA MISS !"],
    earl: ['ELLE EST TIMIDE.', 'JE LUI LAISSE DU TEMPS. GENRE DIX ANS.', "C'EST PAS GRAVE. J'AI LE JACUZZI.", 'ON SE COMPREND, ELLE ET MOI. JE CROIS.'],
  },
  oui: {
    toejam: ['ELLE A DIT OUI ?! ... ATTENDS, JE SAIS PLUS MARCHER !'],
    earl: ['OH. ... ÇA, JE L\'AVAIS PAS PRÉVU.'],
  },
  // au calme, en explorant un étage : ce qui passe par la tête
  balade: {
    toejam: [
      'ÇA SENT LE PIÈGE, ICI. JE LE SENS DANS MES TROIS JAMBES.',
      'Y A DÉGUN... C\'EST LOUCHE, WOLLAH.',
      'ON EST OÙ, LÀ ? MÊME GOOGLE MAPS IL CONNAÎT PAS.',
      'JE MARCHE, JE MARCHE... ET TOUJOURS PAS UN KEBAB.',
      'LES TERRIENS, ILS ONT MIS DES ÎLES DANS LE CIEL. ILS SONT FADAS.',
      "S'IL Y A UN MORCEAU ICI, JE LE TROUVE. SUR LA TÊTE DE MA MÈRE.",
      'TRANQUILLE... TRANQUILLE... TROP TRANQUILLE !',
      'IL FAIT BEAU, Y A PERSONNE... ON SE CROIRAIT AUX GOUDES UN MARDI.',
      'FUNKOTRON ME MANQUE. LÀ-BAS, LES DENTISTES ILS COURENT PAS.',
      'SI JE TOMBE ENCORE UNE FOIS, JE PORTE PLAINTE.',
      'TÉMA LE PAYSAGE. ÇA MÉRITE UNE STORY, ÇA.',
      "J'AI FAIM. EN VRAI, J'AI TOUJOURS FAIM.",
    ],
    earl: [
      "BELLE VUE... J'M'ASSOIRAIS BIEN. MAIS APRÈS, FAUT SE RELEVER.",
      'ON CHERCHE QUOI, DÉJÀ ? ... AH OUI. LE VAISSEAU.',
      "C'EST CALME. J'AIME QUAND C'EST CALME.",
      "J'AI MARCHÉ AU MOINS... DIX MÈTRES. RESPECT À MOI.",
      "LA TERRE, C'EST JOLI. ÇA MANQUE JUSTE DE CANAPÉS.",
      "SI QUELQU'UN ME CHERCHE... JE SUIS PAS LÀ.",
      "MMH... ÇA SENT LE BARBECUE. OU C'EST MOI.",
      "UN JOUR, JE COURRAI. ... PAS AUJOURD'HUI.",
      'TOEJAM VA ENCORE TOUT TROUVER AVANT MOI. ... TANT MIEUX.',
      "LE CIEL EST VIOLET... OU C'EST MES LUNETTES.",
      "J'AI PERDU UN TRUC. ... JE SAIS PLUS QUOI. C'EST PAS GRAVE.",
      "ICI, PERSONNE ME DEMANDE RIEN. C'EST LE PARADIS.",
    ],
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

// tirage sans redite : on vide un paquet mélangé avant d'en reprendre un neuf ; le tout premier tirage d'une
// situation donne sa première réplique (la meilleure, en tête de liste)
const decks = new Map();
function draw(key, n) {
  let deck = decks.get(key);
  if (!deck?.length) {
    const first = !decks.has(key);
    deck = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (first) { deck.splice(deck.indexOf(0), 1); deck.push(0); }
    decks.set(key, deck);
  }
  return deck.pop();
}

export function banterLine(kind, ev, extra) {
  let set = L[ev], key = ev;
  if (ev === 'chase') { set = L.chase[extra] || L.chase.any; key = `chase-${slug(L.chase[extra] ? extra : 'any')}`; }
  if (ev === 'biome') { set = L.biome[extra]; key = `biome-${slug(extra || '')}`; }
  const list = set?.[kind] || set?.toejam;
  if (!list?.length) return null;
  const i = draw(`${kind}_${key}`, list.length);
  return { text: list[i], id: `${kind}_${key}_${i + 1}` };
}

// Les danseuses répondent à la drague : presque toujours un vent, sec. Parfois, rarement, un oui (et là, c'est pire).
const VENTS = {
  any: [
    'NON.', "A'OLE. ÇA VEUT DIRE NON, EN HAWAÏEN.", 'MON PÈRE, IL EST CONTRÔLEUR DES IMPÔTS.', "MON 06 ? C'EST LE 17.",
    "T'AS NAGÉ JUSQU'ICI POUR DIRE ÇA ?", "J'AI UN COPAIN. C'EST LE REQUIN.", "C'EST MIGNON. C'EST NON.", 'TU SENS LE POISSON PANÉ.',
    "REVIENS QUAND T'AURAS RECOLLÉ TA FUSÉE.", 'ALOHA. ÇA VEUT DIRE BONJOUR. ET AU REVOIR. SURTOUT AU REVOIR.',
    "J'AI ENTENDU. J'AI RIEN RESSENTI.", "RECULE, TU FAIS DE L'OMBRE AU JACUZZI.", 'ÇA MARCHE AVEC QUI, ÇA ?', 'JE DANSE. TU GÊNES.',
  ],
  toejam: ['TROIS JAMBES, ET PAS UNE BONNE IDÉE.', "PARLE MOINS VITE, J'AI RIEN COMPRIS. ET C'EST TANT MIEUX."],
  earl: ['ENLÈVE TES LUNETTES. ... NAN, REMETS-LES.', "TU T'ES ENDORMI EN PLEINE PHRASE ?"],
};
const OUI = ["... T'ES BIZARRE. J'AIME BIEN.", "BON. T'AS DE LA CHANCE, J'M'ENNUIE."];
// chaque réponse a son identifiant de voix (voix de cagole) : hula_vent_n, hula_vent-toejam_n, hula_oui_n
const ids = (list, key) => list.map((text, i) => ({ text, id: `hula_${key}_${i + 1}` }));
export function allGirlLines() {
  return [...ids(VENTS.any, 'vent'), ...ids(VENTS.toejam, 'vent-toejam'), ...ids(VENTS.earl, 'vent-earl'), ...ids(OUI, 'oui')];
}
export function girlLine(kind, yes) {
  if (yes) { const list = ids(OUI, 'oui'); return list[draw('oui', list.length)]; }
  const list = [...ids(VENTS.any, 'vent'), ...ids(VENTS[kind] || [], `vent-${kind}`)];
  return list[draw(`vent_${kind}`, list.length)];
}

// p : le joueur qui parle ; force : passe outre le délai entre deux bulles
export function banter(g, p, ev, { force = false, extra, chance = 1 } = {}) {
  if (!p?.active || g.state !== 'play' || Math.random() > chance) return false;
  if (!force && g.t - (p.bubbleT ?? -99) < 8) return false;
  const line = banterLine(p.kind, ev, extra);
  if (!line) return false;
  p.bubbleT = g.t;
  // la bulle reste le temps de la lire (les longues répliques ne s'envolent pas à mi-phrase)
  g.hud.bubble(p, line.text, Math.max(2.6, 1.2 + line.text.length / 18));
  g.speak?.(line.id);
  return true;
}
