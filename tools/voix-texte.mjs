// Le texte de toutes les répliques à faire dire par ElevenLabs (eleven_v3), avec le fichier de chacune.
// node tools/voix-texte.mjs > /tmp/voix.json
// - bulles (src/banter.js)          → public/voix/lignes/<personnage>_<situation>_<n>.mp3
// - petits cris (audio.js, say)     → public/voix/<tj|earl>_<cri>_<1|2>.mp3
// - intro (src/cine.js)             → public/voix/<tj|earl>_cine<n>.mp3
import { fileURLToPath } from 'url';
import { allLines } from '../src/banter.js';

export const VOICES = { toejam: '8R6pzcy1HIr4WcoApmzw', earl: 'MCUGZje4J3p8LqPNd1k1' }; // Amadou ; Earl (voix créée)

const CRIS = {
  yo: { toejam: ['Wesh !', 'On dit quoi, le sang ?'], earl: ['Yo...', 'Tranquille...'] },
  funky: { toejam: ['Funky !', "C'est funky, ça !"], earl: ['Funky...', 'Mmmh... funky.'] },
  chute: { toejam: ['Nan nan nan nan !', 'Wouaaah !'], earl: ['Oh... bon.', 'Ah. Le vide.'] },
  aie: { toejam: ['Aïe ! Putain !', 'Wesh, ça fait mal !'], earl: ['Aïe...', 'Ouh... ça pique.'] },
  cadeau: { toejam: ['Un cadeau !', "C'est pour moi, ça !"], earl: ['Un paquet...', 'Ah. Un cadeau.'] },
  miam: { toejam: ['Miam !', "C'est tarpin bon !"], earl: ['Mmmh...', 'Miam...'] },
  beurk: { toejam: ["Beurk ! C'est dégueulasse !", 'La putain de ses morts !'], earl: ['Beurk...', 'Pas bon, ça.'] },
  appel: { toejam: ['Earl ?!', "Earl ! T'es où ?"], earl: ['ToeJam ?...', "ToeJam... t'es où, le sang ?"] },
  morceau: { toejam: ['Un morceau du vaisseau !', 'Wollah, un morceau !'], earl: ['Un morceau...', 'Le vaisseau... ça avance.'] },
  piege: { toejam: ["C'est une arnaque !", "Il m'a piégé, ce cadeau !"], earl: ['Ah. Un piège.', 'Évidemment...'] },
};

const CINE = [
  ['tj_cine1', 'toejam', "Wesh Earl, t'as le permis pour ce truc ?"],
  ['earl_cine1', 'earl', '[laughs softly] Le permis... Téma : sans les mains.'],
  ['tj_cine2', 'toejam', '[shouting] Earl... Earl ! Le caillou, baltringue !'],
  ['earl_cine2', 'earl', '... Oups.'],
  ['tj_cine3', 'toejam', 'Wollah, faut retrouver les dix morceaux !'],
  ['earl_cine3', 'earl', 'Bienvenue sur Terre, le sang.'],
  ['earl_cine4', 'earl', '[sighs] Vas-y, toi. Moi... je fais la sieste.'],
];

// Les bulles sont en capitales (police du jeu) : on les remet en casse normale pour la voix.
const NOMS = { EARL: 'Earl', TOEJAM: 'ToeJam', CUPIDON: 'Cupidon', TERRE: 'Terre' };
function phrase(s) {
  let t = s.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  for (const [k, v] of Object.entries(NOMS)) t = t.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
  return t;
}
// un peu de jeu : ToeJam rit et s'énerve, Earl soupire (tirage fixe d'après le texte : même résultat à chaque fois)
const tirage = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1000; return h / 1000; };
function jeu(who, text) {
  if (who === 'earl') return /\.\.\./.test(text) && tirage(text) < 0.35 ? `[sighs] ${text}` : text;
  if (/!\s*$/.test(text) && /(putain|chauffer|baltringue|dégage|cours)/i.test(text)) return `[shouting] ${text}`;
  if (/!\s*$/.test(text) && tirage(text) < 0.3) return `[laughs] ${text}`;
  return text;
}

export function script() {
  const out = [];
  for (const l of allLines()) out.push({ file: `voix/lignes/${l.id}.mp3`, who: l.who, text: jeu(l.who, phrase(l.text)) });
  for (const [cri, set] of Object.entries(CRIS)) for (const who of ['toejam', 'earl']) set[who].forEach((text, i) => out.push({ file: `voix/${who === 'earl' ? 'earl' : 'tj'}_${cri}_${i + 1}.mp3`, who, text }));
  for (const [name, who, text] of CINE) out.push({ file: `voix/${name}.mp3`, who, text });
  return out.map((o) => ({ ...o, voice: VOICES[o.who] }));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const s = script();
  console.log(JSON.stringify(s, null, 1));
  console.error(`${s.length} répliques, ${s.reduce((n, o) => n + o.text.length, 0)} caractères`);
}
