# Publier Funkotron Remix sur itch.io

## Fabriquer le paquet

```bash
npm run itch
```

Le script construit le jeu dans `dist/` puis le compresse en `funkotron-remix-itch.zip` (environ 5,5 Mo).

## Mettre en ligne

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
- Les musiques ACE Music viennent de `public/music/`. Si ce dossier est vide, le jeu tourne sans musique d'étage (le groove du désœuvrement est synthétisé, il marche toujours).
- `?debug` dans l'adresse active les touches de test, `?muet` coupe le son.
- Crédits des sons et des voix : `public/sfx/CREDITS.md`.
