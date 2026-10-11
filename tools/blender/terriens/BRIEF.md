# Modeler un terrien dans Blender (Funkotron Remix)

Chaque terrien (ennemi ou personnage ami du jeu, remake de ToeJam & Earl) est un script Python lancé par Blender sans interface :

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/terriens/<nom>.py -- public/models/terriens/<nom>.glb <dossier_aperçus>

(compter 15 à 40 secondes ; à lancer depuis la racine du projet `funkotron-remix/`).

## À lire avant de commencer
- `tools/blender/kit.py` : la boîte à outils (volumes lisses `ell`, `cone`, `rbox` fondus et maillés, peinture des
  couleurs par sommet, pièces simples, squelette, peau, animations cuites, aperçus, export). Lire l'en-tête.
- `tools/blender/terriens/dentist.py` : le modèle de référence (le dentiste fou). Copier sa structure.
- `src/earthlings.js`, objet `MODELS` : l'ancien modèle en volumes du même terrien (proportions et hauteur à respecter
  à peu près, couleurs de départ), et `animate1` (ce que le jeu animait par code).

## Règles
- Repère : le personnage regarde vers **-Y**, +X est sa gauche, **pieds à z = 0**, unité = mètre du jeu (ToeJam mesure ~1,4).
- Style : cartoon des années 90 (ToeJam & Earl sur Mega Drive), formes rondes et exagérées, couleurs vives, grosse tête,
  yeux expressifs (`K.eyes`), une silhouette lisible de loin et vue de dessus (caméra isométrique, le terrien fait
  ~40 pixels de haut à l'écran) : exagérer les accessoires qui le caractérisent.
- Budget : corps ≤ 10 000 triangles (`K.decimate`), total ≤ 15 000 ; fichier .glb ≤ 800 Ko.
- Os : un os racine nommé **`root`** (bassin), comme le dentiste ; tout le reste au choix.
- **Clips obligatoires** (noms exacts) :
  - `Idle` (boucle, ~2 s) : attente, avec un tic de personnalité ;
  - `Walk` (boucle) : flânerie ;
  - `Run` (boucle) : poursuite du joueur, beaucoup plus énergique ;
  - `Warn` (une seule fois, 16 images) : il repère le joueur et se prépare à charger (le jeu affiche « ! ») ;
  - `Hit` (boucle, ~1 s) : juste après avoir bousculé le joueur (moquerie, rire, fanfaronnade) ;
  - `Dance` (boucle, 32 images = 2 temps) : piste de disco.
  Clips facultatifs reconnus par le jeu : `Sing` (la cantatrice chante), `Fire` (les poulets tirent), `Fly` (le Père Noël s'envole).
- Les boucles doivent raccorder (t = 0 et t = 1 identiques) ; les pièces qui tournent (roues, hélices, lames) font un
  nombre entier de tours par boucle, portées par un os dédié.
- Les pièces que le jeu doit piloter par code portent un **nom d'objet** précis (voir la consigne de chaque terrien).
- Aperçus : au moins face, trois-quarts, et une image par clip important. Les regarder (outil Read sur les PNG),
  corriger ce qui cloche (pupilles cachées, pièces qui traversent, proportions), relancer. 2 ou 3 passes.
- Ne modifier **aucun** fichier de `src/` ni `kit.py` (si une fonction manque, l'écrire dans ton propre script).
