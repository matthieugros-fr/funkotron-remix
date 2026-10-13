# Publier Funkotron Remix

## Sur GitHub Pages (le plus simple pour envoyer un lien)

Le dépôt contient `.github/workflows/pages.yml`, qui construit le jeu et le met en ligne à chaque envoi sur `main`.
À faire une seule fois, sur GitHub : **Settings**, **Pages**, **Build and deployment**, **Source : GitHub Actions**.
L'adresse du jeu (`https://<pseudo>.github.io/<dépôt>/`) s'affiche ensuite sur cette même page.

## Sur itch.io

### Fabriquer le paquet

```bash
npm run itch
```

Le script construit le jeu dans `dist/` puis le compresse en `funkotron-remix-itch.zip` (environ 45 Mo, sous la limite de 500 Mo d'itch.io).

### Mettre en ligne

1. Sur itch.io : **Upload new project**.
2. **Kind of project** : *HTML*.
3. **Uploads** : envoyer `funkotron-remix-itch.zip`, puis cocher *This file will be played in the browser*.
4. **Embed options** :
   - taille 960 × 720 ;
   - cocher *Fullscreen button* ;
   - cocher *Automatically start on page load* seulement si on veut la musique d'entrée de jeu (le navigateur attend de toute façon un premier clic ou une première touche pour lancer le son).
5. Visibilité *Draft* pour tester, puis *Public*.

## À savoir

- La partie et les réglages sont gardés dans le navigateur du joueur (stockage local) : rien n'est envoyé nulle part.
- Le zip ne se joue pas en double-cliquant sur `index.html` : le navigateur refuse de charger les modèles et les sons d'un fichier local. Il doit être servi par un site (itch.io, GitHub Pages) ou par `npm run preview`.
- `?debug` dans l'adresse active les touches de test, `?muet` coupe le son.
- Crédits : `CREDITS.md`, `public/music/CREDITS.md` et `public/sfx/CREDITS.md`.
