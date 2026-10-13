# Funkotron Remix

Un remake amateur de *ToeJam & Earl* (Mega Drive, 1991), en 3D pixélisée, qui se joue dans le navigateur.

ToeJam et Earl se sont écrasés sur Terre. Il faut retrouver les 10 morceaux de leur vaisseau, éparpillés sur
25 étages d'îles qui flottent dans l'espace, en évitant les terriens (dentiste fou, poules armées, dame au caddie…),
en ouvrant des cadeaux dont on ne sait jamais ce qu'ils cachent, et sans tomber dans le vide.

Seul ou à deux sur le même clavier (ou avec deux manettes).

## Jouer

**En ligne** : `https://<ton-pseudo>.github.io/<nom-du-depot>/` une fois la publication activée (voir plus bas).

Dans le jeu :

| Action | Touche |
|---|---|
| Marcher | ZQSD ou flèches |
| Sac, sage, boîte aux lettres | Espace |
| Lancer une tomate | F |
| Sur la pointe des pieds | Maj |
| Tourner la caméra | A / E |
| Zoom | C |
| Carte | M |
| Pause | Échap |

À deux : ToeJam joue avec ZQSD, Espace, F et Maj gauche ; Earl avec les flèches, Entrée, Maj droite et Alt droite.

La partie est gardée dans le navigateur : on peut fermer l'onglet et reprendre plus tard.

## Lancer le jeu sur son ordinateur

Il faut [Node.js](https://nodejs.org) (version 20.19 ou plus récente).

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5190/ dans le navigateur.

Ouvrir `index.html` en double-cliquant ne marche pas : le navigateur refuse de charger les modèles 3D et les sons
d'un fichier local. Il faut passer par `npm run dev`, ou par la version en ligne.

Options dans l'adresse : `?muet` coupe le son, `?graine=FUNK91` choisit le monde, `?debug` active les touches de test.

## Publier le jeu en ligne (GitHub Pages)

Le dépôt contient déjà tout ce qu'il faut (`.github/workflows/pages.yml`). Une seule manipulation sur GitHub :

1. Dans le dépôt : **Settings**, puis **Pages**.
2. Sous **Build and deployment**, choisir **Source : GitHub Actions**.

Ensuite, chaque envoi sur la branche `main` reconstruit le jeu et le met en ligne en une à deux minutes (onglet
**Actions** pour suivre). L'adresse s'affiche dans **Settings**, **Pages**.

Autre possibilité : itch.io, voir [PUBLIER.md](PUBLIER.md).

## Organisation du code

- `src/` : le jeu (Three.js, sans moteur). `main.js` fait tourner la partie ; `gen.js` fabrique les étages ;
  `world.js` les construit en 3D ; `earthlings.js` anime les terriens ; `hud.js` dessine l'interface.
- `public/` : modèles 3D, musiques, bruitages et voix.
- `tools/blender/` : les scripts qui fabriquent les personnages dans Blender (sans interface).
- `tools/voix-texte.mjs` : le texte de toutes les répliques à faire dire.

## Crédits

- Musiques : morceaux sous licence libre de Shane Ivers, Eric Matyas, Mega Pixel Music Lab et Yubatake.
  Le détail est dans [public/music/CREDITS.md](public/music/CREDITS.md).
- Bruitages, voix et cris : ElevenLabs et OpenGameArt. Le détail est dans [CREDITS.md](CREDITS.md) et
  [public/sfx/CREDITS.md](public/sfx/CREDITS.md).
- Personnages et terriens : modélisés par script dans Blender.

*ToeJam & Earl* et ses personnages appartiennent à leurs ayants droit. Ce remake est un projet de fan, gratuit
et sans but commercial, qui ne leur est pas affilié.
