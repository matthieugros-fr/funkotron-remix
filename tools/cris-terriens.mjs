// Les cris et interjections des terriens, à générer avec ElevenLabs.
// node tools/cris-terriens.mjs  → la liste (JSON) ; chaque entrée donne le fichier public/sfx/terriens/<type>_<moment>_<n>.mp3
// node tools/cris-terriens.mjs --index  → après génération, met à jour public/sfx/terriens/index.json (lu par le jeu)
// Moments joués par le jeu (audio.js, sound.cry) :
//   repere : il vient de repérer le joueur (au moment du « ! ») ;
//   rire   : juste après avoir bousculé le joueur ;
//   fuite  : touché par une tomate, il déguerpit ;
//   chant  : la cantatrice chante ; cadeau / envol : le Père Noël ; sage : le sage qu'on consulte.
// tts : voix de la bibliothèque ElevenLabs (eleven_v3, indications de jeu entre crochets) ; sfx : bruitage (texte → son).
import { fileURLToPath } from 'url';

const V = {
  julien: 'papd083UqIoSWdSkh3fG',     // Julien, voix d'acteur de dessin animé
  leon: '5hs4q0PzlPQREPpq7uQ9',       // Leon, jeune homme
  thunder: '4TfTGcPwoefWe878B0rm',    // ThunderBlade, expressif façon anime
  jacob: '1aPDmPEYltTp3yDMQLiT',      // Jacob L., méchant de film d'horreur
  felix: 'RBhYSNMNu6b2CGZ9Fn1M',      // Felix, gars de la rue (québécois)
  morgane: 'ZYOBieLaunTiQrTrvNQq',    // Morgane, très expressive
  philippine: 'Yx2a8qp2EqI9c5i8MzBo', // Philippine, voix de dessin animé enjouée
  olivier: 'GFj5Qf6cNQ3Lgp8VKBwc',    // Olivier D., vieil homme de dessin animé
};

export const CRIS = [
  // le dentiste fou
  ['dentist', 'repere', 'tts', V.julien, '[laughs maniacally] Un patient ! Ouvrez grand !'],
  ['dentist', 'repere', 'tts', V.julien, 'Ça va pas faire mal... [evil laugh] beaucoup !'],
  ['dentist', 'rire', 'tts', V.julien, '[maniacal laughter] Hahahahaha ! Suivant !'],
  ['dentist', 'rire', 'tts', V.julien, '[cackles] Pas de carie, pas de chocolat ! Hahaha !'],
  ['dentist', 'fuite', 'tts', V.julien, 'Aïe ! Mes instruments !'],
  // les intellos
  ['nerds', 'repere', 'tts', V.leon, 'Euh... statistiquement, tu es cerné.'],
  ['nerds', 'repere', 'tts', V.leon, 'En fait, techniquement, on est quatre.'],
  ['nerds', 'rire', 'tts', V.leon, '[nasal laugh] Hé hé hé. Logique.'],
  ['nerds', 'rire', 'tts', V.leon, '[snorts] Échec et mat !'],
  ['nerds', 'fuite', 'tts', V.leon, '[panicked] Maman !'],
  // le petit diable
  ['devil', 'repere', 'tts', V.thunder, '[evil giggle] Viens par ici, toi...'],
  ['devil', 'repere', 'tts', V.thunder, '[mischievous] Héhéhé, un client !'],
  ['devil', 'rire', 'tts', V.thunder, '[evil cackle] Mouahahahaha !'],
  ['devil', 'rire', 'tts', V.thunder, '[laughs wickedly] Ça brûle, hein ?'],
  ['devil', 'fuite', 'tts', V.thunder, 'Ouille ouille ouille !'],
  // le croque-mitaine
  ['boogey', 'repere', 'tts', V.jacob, '[growls] BOU !'],
  ['boogey', 'repere', 'tts', V.jacob, '[deep growl] Grrraaaah...'],
  ['boogey', 'rire', 'tts', V.jacob, '[deep menacing laugh] Hoh hoh hoh...'],
  ['boogey', 'fuite', 'tts', V.jacob, '[roars in pain] Rrraaah !'],
  // l'homme à la tondeuse
  ['mower', 'repere', 'tts', V.felix, 'Hé ! Dégage de ma pelouse !'],
  ['mower', 'repere', 'tts', V.felix, 'Tu marches sur mon gazon, toi ?'],
  ['mower', 'rire', 'tts', V.felix, '[laughs] Ça t\'apprendra !'],
  ['mower', 'rire', 'tts', V.felix, 'Et ça, c\'est pour les pissenlits !'],
  ['mower', 'fuite', 'tts', V.felix, 'Ma tondeuse !'],
  // la dame au caddie
  ['cart', 'repere', 'tts', V.morgane, '[old woman, angry] Poussez-vous, j\'ai des surgelés !'],
  ['cart', 'repere', 'tts', V.morgane, '[old woman, shouting] Place ! Priorité aux dames !'],
  ['cart', 'rire', 'tts', V.morgane, '[old woman] Ha ! La jeunesse d\'aujourd\'hui !'],
  ['cart', 'rire', 'tts', V.morgane, '[old woman] Et que ça vous serve de leçon !'],
  ['cart', 'fuite', 'tts', V.morgane, '[old woman, outraged] Mon caddie ! Mes poireaux !'],
  // la taupe
  ['mole', 'repere', 'tts', V.julien, '[sniffs] Ça sent le cadeau, ça...'],
  ['mole', 'rire', 'tts', V.julien, '[snickers] Hé hé... c\'est à moi, maintenant !'],
  ['mole', 'fuite', 'tts', V.julien, 'Rends-le-moi ! Euh... non, garde-le !'],
  // Cupidon
  ['cupid', 'repere', 'tts', V.philippine, '[giggles] Coucou, toi !'],
  ['cupid', 'repere', 'tts', V.philippine, '[giggles] Je t\'ai vu !'],
  ['cupid', 'rire', 'tts', V.philippine, '[giggles] L\'amour, toujours !'],
  ['cupid', 'rire', 'tts', V.philippine, '[laughs] Tu es amoureux ! Tu es amoureux !'],
  ['cupid', 'fuite', 'tts', V.philippine, '[crying] Bouhouhou !'],
  // la cantatrice
  ['opera', 'chant', 'sfx', null, 'Opera soprano singing one very loud, very high vibrato note, comedic and theatrical, no music'],
  ['opera', 'chant', 'sfx', null, 'Operatic soprano vocalise, ah-ah-ah-ah rising scale, dramatic and over the top, no music'],
  ['opera', 'repere', 'tts', V.morgane, '[dramatic, theatrical] Mon public !'],
  ['opera', 'fuite', 'tts', V.morgane, '[offended, theatrical] Quel manque de culture !'],
  // le Père Noël et le sage
  ['santa', 'cadeau', 'tts', V.olivier, '[jolly] Ho ho ho ! Tu as été sage, toi !'],
  ['santa', 'envol', 'tts', V.olivier, '[laughs heartily] Ho ho hooo ! Joyeux Noël !'],
  ['wiseman', 'sage', 'tts', V.olivier, '[calm, wise] Mmmh... La réponse est en toi. Ou dans le sac.'],
  ['wiseman', 'sage', 'tts', V.olivier, '[meditative] Ommmmm...'],
  // le hamster et les poulets : des bruitages
  ['hamster', 'repere', 'sfx', null, 'Cartoon hamster squeaking excitedly, high pitched'],
  ['hamster', 'rire', 'sfx', null, 'Cartoon hamster chattering and squeaking triumphantly'],
  ['hamster', 'fuite', 'sfx', null, 'Cartoon hamster squeak of pain'],
  ['chickens', 'repere', 'sfx', null, 'Angry chickens clucking loudly, alarmed'],
  ['chickens', 'rire', 'sfx', null, 'Chicken cackling as if laughing, cartoon'],
  ['chickens', 'fuite', 'sfx', null, 'Panicked chicken squawk with flapping wings'],
];

export function script() {
  const n = {};
  return CRIS.map(([type, moment, kind, voice, text]) => {
    const k = `${type}_${moment}`;
    n[k] = (n[k] || 0) + 1;
    return { file: `sfx/terriens/${k}_${n[k]}.mp3`, type, moment, kind, voice, text };
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === '--index') {
  // après génération : la liste des cris présents, que le jeu lit au démarrage
  const fs = await import('fs');
  const dir = new URL('../public/sfx/terriens/', import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort();
  fs.writeFileSync(new URL('index.json', dir), JSON.stringify(files) + '\n');
  console.error(`${files.length} cris dans index.json`);
} else if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const s = script();
  console.log(JSON.stringify(s, null, 1));
  console.error(`${s.length} cris : ${s.filter((x) => x.kind === 'tts').length} voix (${s.filter((x) => x.kind === 'tts').reduce((a, x) => a + x.text.length, 0)} caractères), ${s.filter((x) => x.kind === 'sfx').length} bruitages`);
}
