# L'intello : maigrichon à grosse tête, énormes lunettes à monture épaisse (les verres grossissent les yeux),
# cheveux plaqués avec une raie et un épi, nœud papillon, pull sans manches à losanges sur chemisette,
# pochette à stylos, pantalon trop court sur chaussettes blanches rayées, mocassins à sou, et une pile de
# livres serrée sur l'avant-bras droit (celui du dessus est ouvert, une page tourne).
#   Blender -b -P tools/blender/terriens/nerd.py -- public/models/terriens/nerd.glb [dossier_aperçus]
# Clips : Idle (feuillette, remonte ses lunettes), Walk (petits pas pressés, nez dans le livre), Run (panique,
# coudes en l'air, livres qui sautent), Warn (sursaut, lunettes, doigt levé « en fait… »), Hit (rire nasal,
# nez en l'air, doigt pointé), Dance (robot raide et maladroit).
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import bpy
import numpy as np
from mathutils import Vector, Quaternion
import kit as K
from kit import V, ell, cone, rbox, srgb

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/nerd.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('nerd', OUT, PREVIEW)
# fichiers de travail (volumes .vdb) à part : d'autres terriens peuvent être modelés en même temps
K.S['work'] = os.path.join(os.path.dirname(os.path.abspath(PREVIEW or '/tmp/x')), 'work_nerd') if PREVIEW else '/tmp/terrien_nerd'
os.makedirs(K.S['work'], exist_ok=True)

# --- proportions ---------------------------------------------------------------------------------------
HIP_Z = 0.40
HEAD_C = V(0, -0.005, 1.0)
HEAD_R = V(0.2, 0.183, 0.205)
LEG = {'L': V(0.062, 0.0, 0), 'R': V(-0.062, 0.0, 0)}
KNEE_Z, ANKLE_Z, HEM_Z = 0.235, 0.075, 0.145
# bras gauche (libre, index tendu) ; bras droit plié, l'avant-bras à l'horizontale porte la pile de livres
ARM = {
    'L': (V(0.118, 0.0, 0.69), V(0.152, 0.015, 0.495), V(0.162, 0.0, 0.325), V(0.165, -0.008, 0.278)),
    'R': (V(-0.118, 0.0, 0.69), V(-0.152, 0.015, 0.495), V(-0.109, -0.15, 0.5), V(-0.1, -0.2, 0.505)),
}
TIP_L = V(0.167, -0.022, 0.236)            # bout de l'index gauche (au repos)
BOOK_C = V(-0.112, -0.138, 0.524)          # centre du dessous de la pile
HAIR_C, HAIR_R = V(0, 0.012, 1.035), V(0.207, 0.192, 0.186)


def hair_z(x, y):
    return float(HAIR_C[2] + HAIR_R[2] * math.sqrt(max(0.0, 1 - (x / HAIR_R[0]) ** 2 - ((y - HAIR_C[1]) / HAIR_R[1]) ** 2)) - 0.001)


body = [
    # buste maigre : pull sans manches, haut de poitrine pour les épaules, bassin du pantalon remonté
    ell('vest', (0, 0.005, 0.585), (0.122, 0.092, 0.155), k=0.04),
    ell('vest', (0, 0.005, 0.66), (0.118, 0.084, 0.07), k=0.04),
    ell('pants', (0, 0.0, 0.43), (0.112, 0.086, 0.07), k=0.04),
    cone('neck', (0, 0.0, 0.7), (0, -0.005, 0.84), 0.033, 0.035, k=0.03),
    ell('collar', (0.03, -0.042, 0.742), (0.032, 0.013, 0.018), k=0.01, R=K.rot(0, 40, 0)),
    ell('collar', (-0.03, -0.042, 0.742), (0.032, 0.013, 0.018), k=0.01, R=K.rot(0, -40, 0)),
    # la tête : gros crâne, menton étroit, petit nez retroussé, oreilles décollées
    ell('head', tuple(HEAD_C), tuple(HEAD_R), k=0.05),
    ell('head', (0, -0.045, 0.875), (0.125, 0.12, 0.085), k=0.06),
    ell('nose', (0, -0.192, 0.925), (0.026, 0.03, 0.03), k=0.02, R=K.rot(-20, 0, 0)),
    ell('ear', (0.212, 0.005, 0.965), (0.022, 0.05, 0.066), k=0.02, R=K.rot(0, 0, 36)),
    ell('ear', (-0.212, 0.005, 0.965), (0.022, 0.05, 0.066), k=0.02, R=K.rot(0, 0, -36)),
    # cheveux plaqués : un casque lisse, une mèche rabattue sur le front, un épi derrière
    ell('hair', tuple(HAIR_C), tuple(HAIR_R), k=0.02),
    ell('hair', (-0.035, -0.1, 1.18), (0.11, 0.05, 0.026), k=0.03, R=K.rot(-40, 0, 12)),
    cone('hair', (0.015, 0.075, 1.2), (0.03, 0.115, 1.27), 0.02, 0.008, k=0.012),
    cone('hair', (0.03, 0.115, 1.27), (0.008, 0.1, 1.305), 0.008, 0.003, k=0.006),
    # la raie : un sillon le long du crâne, à gauche
    cone('part', (0.074, -0.13, hair_z(0.074, -0.13)), (0.074, -0.02, hair_z(0.074, -0.02)), 0.0055, 0.0055, k=0.004, op='sub'),
    cone('part', (0.074, -0.02, hair_z(0.074, -0.02)), (0.074, 0.08, hair_z(0.074, 0.08)), 0.0055, 0.0045, k=0.004, op='sub'),
    # sourcils hauts et étonnés
    ell('brow', (0.088, -0.168, 1.1), (0.045, 0.014, 0.011), k=0.012, R=K.rot(0, -10, 0)),
    ell('brow', (-0.088, -0.168, 1.1), (0.045, 0.014, 0.011), k=0.012, R=K.rot(0, 10, 0)),
    # la bouche : une fente d'où sortent les dents du lapin
    ell('mouth', (0, -0.172, 0.856), (0.048, 0.04, 0.015), k=0.01, op='sub'),
]
for s, b in LEG.items():
    body.append(cone('trouser', tuple(b + V(0, 0, HIP_Z + 0.02)), tuple(b + V(0, -0.012, KNEE_Z)), 0.056, 0.045, k=0.03))
    body.append(cone('trouser', tuple(b + V(0, -0.012, KNEE_Z)), tuple(b + V(0, 0, HEM_Z + 0.01)), 0.045, 0.044, k=0.02))
    body.append(cone('cuff', tuple(b + V(0, 0, HEM_Z + 0.012)), tuple(b + V(0, 0, HEM_Z)), 0.049, 0.05, k=0.006))
    body.append(cone('sock', tuple(b + V(0, 0, HEM_Z)), tuple(b + V(0, 0.0, 0.05)), 0.03, 0.029, k=0.015))
    body.append(ell('shoe', tuple(b + V(0, -0.035, 0.036)), (0.047, 0.096, 0.037), k=0.02))
for s, (SH, EL, WR, HD) in ARM.items():
    sx = 1 if s == 'L' else -1
    body.append(cone('sleeve', tuple(SH), tuple(SH + (EL - SH) * 0.42), 0.043, 0.041, k=0.03))
    body.append(cone('arm', tuple(SH), tuple(EL), 0.027, 0.024, k=0.02))
    body.append(cone('arm', tuple(EL), tuple(WR), 0.024, 0.021, k=0.015))
if True:  # main gauche : poing fermé, index tendu dans l'axe, pouce
    SH, EL, WR, HD = ARM['L']
    body.append(ell('hand', tuple((WR + HD) / 2 + V(0, -0.004, 0)), (0.02, 0.027, 0.032), k=0.015))
    body.append(cone('finger', tuple(HD + V(0.001, -0.012, 0.012)), tuple(TIP_L), 0.0095, 0.0085, k=0.008))
    body.append(ell('thumb', (0.157, -0.03, 0.302), (0.01, 0.012, 0.017), k=0.008, R=K.rot(-25, 0, 0)))
    # main droite : elle tient le bas de la pile par devant
    body.append(ell('hand', (-0.103, -0.206, 0.522), (0.026, 0.02, 0.026), k=0.015))
    for j, dx in enumerate((-0.017, -0.004, 0.009)):
        body.append(cone('hand', (-0.103 + dx, -0.214, 0.528), (-0.103 + dx * 1.1, -0.214, 0.552 - abs(dx) * 0.3), 0.0085, 0.0075, k=0.006))

C = {k: srgb(v) for k, v in dict(
    skin='#f2c29b', nose='#f3ab8c', ear='#eab48e', hair='#3b2718', part='#7e5236', brow='#3b2718', mouth='#5a1018',
    vest='#f08c2c', dia1='#7a3a1c', dia2='#2b8c8a', trim='#6a3018', shirt='#eef4ff', shirt2='#d4def2',
    pants='#4a5a8a', cuff='#3a4874', sock='#ffffff', stripe1='#e8334a', stripe2='#3a5ad8',
    shoe='#5a2216', band='#3e160e', penny='#d68a3a', sole='#24140e', cheek='#f2a68c', freckle='#c8875e').items()}
COL = {'default': C['skin'], 'head': C['skin'], 'neck': C['skin'], 'arm': C['skin'], 'hand': C['skin'], 'finger': C['skin'],
       'thumb': C['skin'], 'nose': C['nose'], 'ear': C['ear'], 'hair': C['hair'], 'brow': C['brow'], 'mouth': C['mouth'],
       'vest': C['vest'], 'pants': C['pants'], 'collar': C['shirt'], 'sleeve': C['shirt'], 'trouser': C['pants'],
       'cuff': C['cuff'], 'sock': C['sock'], 'shoe': C['shoe']}
MOUTH_C, MOUTH_R = V(0, -0.172, 0.856), V(0.048, 0.04, 0.015)


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    front = y < -0.02
    # --- bassin : au-dessus de la ceinture c'est le pull, en dessous le pantalon
    torso = np.isin(tag, ('vest', 'pants'))
    pull = torso & (z >= 0.465)
    col[torso & ~pull] = C['pants']
    # losanges (argyle) : damier en diagonale, une case sur deux brune ou bleu canard
    a = x / 0.05 + (z - 0.6) / 0.06
    b = x / 0.05 - (z - 0.6) / 0.06
    odd = (np.floor(a) + np.floor(b)) % 2 == 1
    col[pull] = C['vest']
    col[pull & odd & (np.floor(a) % 2 == 0)] = C['dia1']
    col[pull & odd & (np.floor(a) % 2 == 1)] = C['dia2']
    # bord-côte du bas, encolure en V et emmanchures : la chemise apparaît
    col[pull & (z < 0.497)] = C['trim']
    vlim = (z - 0.635) * 0.62
    vee = pull & front & (z > 0.635) & (ax < vlim)
    col[pull & front & (z > 0.62) & (ax < vlim + 0.013)] = C['trim']
    col[vee] = C['shirt']
    hole = pull & (ax > 0.093) & (z > 0.6)
    col[pull & (ax > 0.081) & (z > 0.59)] = C['trim']
    col[hole] = C['shirt']
    col[pull & (z > 0.712)] = C['shirt']
    # manches : un ourlet
    sl = tag == 'sleeve'
    for s, (SH, EL, WR, HD) in ARM.items():
        d = (EL - SH) / np.linalg.norm(EL - SH)
        u = (co - SH) @ d
        col[sl & (np.sign(x) == (1 if s == 'L' else -1)) & (u > 0.065)] = C['shirt2']
    # --- jambes : chaussettes rayées, mocassins à sou
    so = tag == 'sock'
    col[so & (np.abs(z - 0.127) < 0.0075)] = C['stripe1']
    col[so & (np.abs(z - 0.108) < 0.0065)] = C['stripe2']
    sh = tag == 'shoe'
    col[sh & (z < 0.012)] = C['sole']
    yy = y + 0.035
    strap = sh & (np.abs(yy + 0.03) < 0.013) & (z > 0.04)
    col[strap] = C['band']
    col[strap & (np.abs(np.abs(x) - 0.062) < 0.012)] = C['penny']
    # --- tête : la ligne des cheveux (haute sur le front, basse sur la nuque), la raie à gauche
    hd = np.isin(tag, ('head', 'hair'))
    q = co - HEAD_C
    phi = np.arctan2(q[:, 1], np.abs(q[:, 0]) + 1e-9)
    hl = -0.15 * np.sin(phi) - 0.012
    hairy = hd & ((q[:, 2] > hl) | (tag == 'hair'))
    col[hairy] = C['hair']
    # reflets de gomina : des stries de peigne
    comb = hairy & (np.sin(x * 150) > 0.8) & (q[:, 2] > 0.12)
    col[comb] = C['hair'] * 1.5
    part = hairy & (np.abs(x - 0.074) < 0.005) & (q[:, 2] > 0.14) & (y < 0.085)
    col[part] = C['part']
    # joues roses
    face = (tag == 'head') & front & ~hairy
    for sx in (1, -1):
        ch = face & (np.hypot(x - sx * 0.12, z - 0.905) < 0.035)
        col[ch] = col[ch] * 0.5 + C['cheek'] * 0.5
    # intérieur de la bouche
    qm = (co - MOUTH_C) / MOUTH_R
    col[(np.linalg.norm(qm, axis=1) < 1.3) & (tag == 'head')] = C['mouth']


def surf_y(prims, x, z, y0=-0.45, y1=0.1):
    """premier point de la surface en venant de l'avant (y le plus petit) à la hauteur z"""
    ys = np.linspace(y0, y1, 4000)
    d = K.field(prims, np.full_like(ys, x), ys, np.full_like(ys, z))
    i = int(np.argmax(d < 0))
    return float(ys[i])


def decimate_keep(ob, faces, keep, factor):
    """décimation qui épargne les zones peintes finement : keep(co) → poids dans [0, 1[ (groupe inversé : chez Blender
    un poids inversé nul verrouille le sommet, sinon le coût d'effondrement croît avec le poids × facteur)"""
    me = ob.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    w = keep(co.reshape(-1, 3))
    vg = ob.vertex_groups.new(name='garde')
    for lvl in np.unique(w):
        if lvl > 0:
            vg.add([int(i) for i in np.nonzero(w == lvl)[0]], float(lvl), 'REPLACE')
    tris = sum(len(f.vertices) - 2 for f in me.polygons)
    dec = ob.modifiers.new('Dec', 'DECIMATE')
    dec.ratio = faces / tris
    dec.use_symmetry = False
    dec.vertex_group = 'garde'
    dec.vertex_group_factor = factor
    dec.invert_vertex_group = True          # le poids 1 doit PROTÉGER la zone
    K.apply_mod(ob, 'Dec')
    ob.vertex_groups.remove(ob.vertex_groups['garde'])
    K.activate(ob)
    bpy.ops.object.shade_smooth()


def keep_zones(co):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    w = np.zeros(len(co))
    w[(y < -0.02) & (z > 0.46) & (z < 0.75) & (np.abs(x) < 0.14)] = 0.8          # losanges du pull
    w[(y < -0.1) & (z > 0.82) & (z < 1.0)] = 0.6                                  # bouche, joues
    w[(z > 0.09) & (z < 0.14)] = 0.5                                               # rayures des chaussettes
    w[(z > 1.12) & (np.abs(x - 0.074) < 0.03)] = 0.5                               # la raie
    return w


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.3, -0.32, 0.0), (0.3, 0.3, 1.32), vox=0.0042)
_F = float(os.environ.get('NERD_KEEP', '0.004'))
decimate_keep(BODY, 9800, keep_zones, _F)
_c = np.array([v.co[:] for v in BODY.data.vertices])
K.log('sommets sur le devant du pull', int(((_c[:, 1] < -0.02) & (_c[:, 2] > 0.46) & (_c[:, 2] < 0.75) & (np.abs(_c[:, 0]) < 0.14)).sum()), 'facteur', _F)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Intello', rough=0.55))

# --- accessoires ------------------------------------------------------------------------------------------
noir = K.mat('Monture', '#16121c', rough=0.3)
EYE_L = (0.088, -0.155, 1.0)
EYES = K.eyes(EYE_L, 0.06, pupil_dir=(0, -1, 0.0), pupil_r=0.5)
bpy.data.materials['Pupille'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.45
GY = -0.236          # plan des verres
GZ = 1.0
glass = []
for sx in (1, -1):
    c = (sx * 0.088, GY, GZ)
    fr = K.torus('Cercle', c, 0.072, 0.0165, noir, rot_deg=(90, 0, 0), seg=28)
    lens = K.cylinder('Verre', (c[0], GY + 0.002, GZ), (c[0], GY - 0.002, GZ), 0.07, K.mat('Verre', '#e6f6ff', rough=0.12, alpha=0.13), seg=24)
    for o in (fr, lens):
        o.scale = (1, 1, 0.86)
        K.activate(o)
        bpy.ops.object.transform_apply(scale=True)
    glint = K.box('Reflet', (sx * 0.088 - 0.028, GY - 0.004, GZ + 0.03), (0.034, 0.002, 0.009), K.mat('Reflet', '#ffffff', rough=0.1, emit='#ffffff'), rot_deg=(0, 38, 0))
    temple = K.cylinder('Branche', (sx * 0.158, GY + 0.004, GZ + 0.01), (sx * 0.2, -0.03, GZ - 0.005), 0.0085, noir, seg=8)
    hook = K.cylinder('Crochet', (sx * 0.2, -0.03, GZ - 0.005), (sx * 0.198, 0.012, GZ - 0.04), 0.008, noir, seg=8)
    glass += [fr, lens, glint, temple, hook]
bridge = K.cylinder('Pont', (0.022, GY - 0.001, GZ + 0.022), (-0.022, GY - 0.001, GZ + 0.022), 0.012, noir, seg=10)
glass.append(bridge)
# on rassemble la monture en un seul objet « Lunettes »
for o in glass:
    o.select_set(False)
K.activate(glass[0])
for o in glass:
    o.select_set(True)
bpy.ops.object.join()
GLASSES = bpy.context.active_object
GLASSES.name = 'Lunettes'

# dents du lapin
TY = surf_y(body, 0.0, 0.875) + 0.004
white = K.mat('Dents', '#ffffff', rough=0.2)
TEETH = [K.box('DentG', (0.0118, TY + 0.006, 0.853), (0.021, 0.011, 0.03), white, bevel=0.003),
         K.box('DentD', (-0.0118, TY + 0.006, 0.853), (0.021, 0.011, 0.03), white, bevel=0.003)]

# nœud papillon rouge
BY = surf_y(body, 0.0, 0.73)
BT = V(0, BY - 0.006, 0.728)
BOW = K.solid('Noeud', [
    cone('bow', tuple(BT), tuple(BT + V(0.048, 0, 0.004)), 0.007, 0.022, k=0.005),
    cone('bow', tuple(BT), tuple(BT + V(-0.048, 0, 0.004)), 0.007, 0.022, k=0.005),
    ell('knot', tuple(BT + V(0, -0.003, 0)), (0.012, 0.012, 0.014), k=0.005),
], tuple(BT - V(0.08, 0.04, 0.04)), tuple(BT + V(0.08, 0.04, 0.04)),
    {'default': srgb('#e8334a'), 'bow': srgb('#e8334a'), 'knot': srgb('#b01c34')}, faces=500, vox=0.0025, rough=0.4)

# pochette en plastique et stylos sur la poitrine gauche
PX, PZ = 0.062, 0.6
PY = surf_y(body, PX, PZ)
pocket = K.box('Pochette', (PX, PY - 0.002, PZ), (0.05, 0.008, 0.056), K.mat('Plastique', '#f4f8ff', rough=0.3), rot_deg=(-12, 0, 0), bevel=0.002)
PENS = [pocket]
for i, (dx, c1, c2) in enumerate(((-0.015, '#2a5ad8', '#1a2a8a'), (0.0, '#e8334a', '#9a1a2a'), (0.015, '#1a1a22', '#ffd23f'))):
    x0 = PX + dx
    PENS.append(K.cylinder(f'Stylo{i}', (x0, PY - 0.009, PZ + 0.0), (x0, PY - 0.011, PZ + 0.054), 0.0058, K.mat(f'Stylo{i}', c1, rough=0.3), seg=8))
    PENS.append(K.cylinder(f'Capuchon{i}', (x0, PY - 0.011, PZ + 0.054), (x0, PY - 0.012, PZ + 0.064), 0.0046, K.mat(f'Capuchon{i}', c2, rough=0.3), seg=8))
    PENS.append(K.box(f'Agrafe{i}', (x0, PY - 0.0045, PZ + 0.04), (0.003, 0.002, 0.03), K.mat('Chrome', '#c8d0e0', rough=0.25, metal=0.8)))


# --- la pile de livres ---------------------------------------------------------------------------------
def join(objs, name):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


creme = K.mat('Pages', '#fff3d2', rough=0.7)
lignes = K.mat('Lignes', '#9a94a8', rough=0.7)
BOOKS = []
z = BOOK_C[2]
for i, (h, w, d, rz, coul) in enumerate(((0.04, 0.175, 0.128, 4, '#d83a3a'), (0.034, 0.158, 0.118, -7, '#2f9a52'),
                                         (0.046, 0.168, 0.124, 2, '#3a56d8'))):
    c = (BOOK_C[0], BOOK_C[1], z + h / 2)
    cov = K.box(f'Couv{i}', c, (w, d, h), K.mat(f'Couv{i}', coul, rough=0.6), bevel=0.003)
    pg = K.box(f'Bloc{i}', (c[0], c[1] + 0.004, c[2]), (w - 0.012, d - 0.004, h - 0.01), creme)
    gold = K.box(f'Titre{i}', (c[0], c[1] - d / 2 - 0.0012, c[2]), (w * 0.55, 0.002, h * 0.28), K.mat('Or', '#ffd23f', rough=0.3, metal=0.6))
    o = join([cov, pg, gold], f'Livre{i + 1}')      # origine au centre du livre (celle de la couverture)
    o.rotation_euler = (0, 0, math.radians(rz))
    K.activate(o)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    BOOKS.append((o, z, h))
    z += h
# le livre ouvert du dessus : couverture, deux blocs de pages, une page qui tourne
Z4 = z
CX, CY = BOOK_C[0] + 0.004, BOOK_C[1]
ZT = Z4 + 0.006 + 0.014               # dessus des pages
cover = K.box('Couv4', (CX, CY, Z4 + 0.003), (0.205, 0.13, 0.006), K.mat('Couv4', '#8a3ad8', rough=0.6), bevel=0.002)
parts = [cover]
for sx in (1, -1):
    parts.append(K.box('Bloc4', (CX + sx * 0.0485, CY, Z4 + 0.013), (0.093, 0.118, 0.014), creme))
    for j in range(5):
        parts.append(K.box('Ligne', (CX + sx * 0.05, CY - 0.04 + j * 0.02, ZT + 0.0003), (0.066, 0.005, 0.0008), lignes))
parts.append(K.box('Reliure', (CX, CY, ZT - 0.002), (0.006, 0.118, 0.006), K.mat('Couv4', '#8a3ad8', rough=0.6)))
OPEN = join(parts, 'Livre4')
AXZ = ZT + 0.0018
pp = [K.box('Page', (CX + 0.0465, CY, ZT + 0.001), (0.091, 0.114, 0.0016), creme)]
for j in range(5):
    for zz in (ZT + 0.0021, ZT - 0.0001):
        pp.append(K.box('Ligne', (CX + 0.05, CY - 0.04 + j * 0.02, zz), (0.066, 0.005, 0.0006), lignes))
PAGE = join(pp, 'Page')

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 0.5))
K.bone('spine', (0, 0, 0.5), (0, 0, 0.74), 'root', True)
K.bone('head', (0, 0, 0.74), (0, 0, 1.22), 'spine', True)
K.bone('lunettes', (0, -0.02, GZ), (0, GY - 0.02, GZ), 'head')
for s in ('L', 'R'):
    SH, EL, WR, HD = ARM[s]
    K.bone('arm' + s, SH, EL, 'spine')
    K.bone('forearm' + s, EL, WR, 'arm' + s, True)
    K.bone('hand' + s, WR, HD, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0, HIP_Z), b + V(0, -0.012, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0, -0.012, KNEE_Z), b + V(0, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0, 0, ANKLE_Z), b + V(0, -0.12, 0.02), 'shin' + s, True)
K.bone('books', BOOK_C, BOOK_C + V(0, 0, 0.1), 'handR')
for i, (o, z0, h) in enumerate(BOOKS):
    K.bone(f'livre{i + 1}', (BOOK_C[0], BOOK_C[1], z0), (BOOK_C[0], BOOK_C[1], z0 + h), 'books')
K.bone('livre4', (CX, CY, Z4), (CX, CY, Z4 + 0.04), 'books')
K.bone('page', (CX, CY + 0.06, AXZ), (CX, CY - 0.06, AXZ), 'livre4')
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'nose', 'ear', 'hair', 'brow', 'mouth'):
        return ['head']
    if tg == 'neck':
        return ['spine', 'head']
    if tg == 'collar':
        return ['spine']
    if tg in ('vest', 'pants'):
        if p[2] < 0.43:
            return ['root', 'thigh' + s]
        return ['root', 'spine'] + (['arm' + s] if abs(p[0]) > 0.095 and p[2] > 0.63 else [])
    if tg == 'sleeve':
        return ['spine', 'arm' + s]
    if tg == 'arm':
        return ['arm' + s, 'forearm' + s]
    if tg in ('hand', 'thumb'):
        return ['forearm' + s, 'hand' + s]
    if tg == 'finger':
        return ['hand' + s]
    if tg == 'trouser':
        return ['root', 'thigh' + s, 'shin' + s] if p[2] > 0.36 else ['thigh' + s, 'shin' + s]
    if tg in ('cuff', 'sock'):
        return ['shin' + s]
    if tg == 'shoe':
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES + TEETH:
    K.attach(o, 'head')
K.attach(GLASSES, 'lunettes')
K.attach(BOW, 'spine')
for o in PENS:
    K.attach(o, 'spine')
for i, (o, z0, h) in enumerate(BOOKS):
    K.attach(o, f'livre{i + 1}')
K.attach(OPEN, 'livre4')
K.attach(PAGE, 'page')


# =====================================================================================================
# Outils d'animation : cuisson avec déplacements d'os, visée (IK à deux os) pour le bras gauche
# =====================================================================================================
def bake(clips):
    """comme K.bake, mais fk accepte aussi des quaternions (repère du monde au repos), et loc pour n'importe quel os"""
    arm, pb, REST = K.S['arm'], K.S['arm'].pose.bones, K.S['REST']
    arm.animation_data_create()
    for name, frames, fn in clips:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        for f in range(frames + 1):
            st = fn(f / frames)
            for b in pb:
                b.rotation_quaternion = Quaternion()
                b.location = (0, 0, 0)
                b.scale = (1, 1, 1)
            for bname, r in st['fk'].items():
                if isinstance(r, Quaternion):     # rotation exprimée dans le repère du monde (au repos)
                    rq = REST[bname].to_3x3().to_quaternion()
                    pb[bname].rotation_quaternion = rq.inverted() @ r @ rq
                else:
                    pb[bname].rotation_quaternion = K.q_world(bname, r)
            pb['root'].location = REST['root'].to_3x3().inverted() @ Vector(st.get('root', (0, 0, 0)))
            if st.get('scale'):
                sc = REST['root'].to_3x3().inverted() @ Vector(st['scale'])
                pb['root'].scale = (abs(sc[0]), abs(sc[1]), abs(sc[2]))
            for bname, v in st.get('loc', {}).items():
                pb[bname].location = REST[bname].to_3x3().inverted() @ Vector(v)
            for b in pb:
                b.keyframe_insert('rotation_quaternion', frame=f)
                b.keyframe_insert('location', frame=f)
                b.keyframe_insert('scale', frame=f)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
    arm.animation_data.action = None
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    K.log('animations', [c[0] for c in clips])


def ss(a, b, t):
    x = min(1.0, max(0.0, (t - a) / (b - a)))
    return x * x * (3 - 2 * x)


def win(t, a, b, r):
    return ss(a, a + r, t) * (1 - ss(b - r, b, t))


def aim(qp, rest_dir, want):
    """rotation locale d'un os dont la chaîne parente a tourné de qp, pour que sa direction de repos vise want"""
    cur = qp @ Vector(tuple(rest_dir))
    rw = cur.rotation_difference(Vector(tuple(want)))
    return qp.inverted() @ rw @ qp, rw @ qp


def arm_q(s, d_up, d_fore=None, d_hand=None, q0=Quaternion()):
    """bras par directions (repère du buste) : haut du bras, avant-bras, main ; None = garder le pli de repos"""
    SH, EL, WR, HD = ARM[s]
    out = {}
    q1, q1w = aim(q0, EL - SH, d_up)
    out['arm' + s] = q1
    if d_fore is None:
        q2, q2w = Quaternion(), q1w
    else:
        q2, q2w = aim(q1w, WR - EL, d_fore)
    if s == 'R':
        # roulis de l'avant-bras : la pile de livres reste à plat (son « haut » au plus près de la verticale)
        f = (q2w @ Vector(tuple(WR - EL))).normalized()
        up = q2w @ Vector((0, 0, 1))
        a = (up - f * up.dot(f)).normalized()
        b = (Vector((0, 0, 1)) - f * f.z)
        if b.length > 1e-4:
            b.normalize()
            ang = math.atan2(f.dot(a.cross(b)), a.dot(b))
            q2w = Quaternion(f, ang) @ q2w
            q2 = q1w.inverted() @ q2w
    out['forearm' + s] = q2
    if d_hand is not None:
        rest = (TIP_L - WR) if s == 'L' else (HD - WR)
        out['hand' + s], _ = aim(q2w, rest, d_hand)
    return out


def ik_left(tip, tdir, pole=(1.0, 0.5, -0.5)):
    """bras gauche : le bout de l'index en tip, pointé selon tdir (repère du buste au repos)"""
    SH, EL, WR, HD = ARM['L']
    tdir = np.asarray(tdir, float) / np.linalg.norm(tdir)
    W = np.asarray(tip, float) - tdir * np.linalg.norm(TIP_L - WR)
    l1, l2 = np.linalg.norm(EL - SH), np.linalg.norm(WR - EL)
    d = W - SH
    dist = float(np.clip(np.linalg.norm(d), abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3))
    dn = d / np.linalg.norm(d)
    ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    a = math.acos(max(-1.0, min(1.0, ca)))
    p = np.asarray(pole, float)
    p = p - dn * (dn @ p)
    p /= np.linalg.norm(p)
    E = SH + l1 * (math.cos(a) * dn + math.sin(a) * p)
    Wr = SH + dn * dist
    return arm_q('L', E - SH, Wr - E, tdir)


def blend(fk, qs, w):
    """mélange (slerp) entre le repos et des quaternions locaux"""
    for k, q in qs.items():
        fk[k] = Quaternion().slerp(q, max(0.0, min(1.0, w)))


def head_point(p, rots):
    """où se trouve un point de la tête une fois la tête tournée (repère du buste)"""
    q = Quaternion()
    for a, deg in rots:
        q = Quaternion(K.AX[a], math.radians(deg)) @ q
    piv = Vector((0, 0, 0.74))
    return np.array(piv + q @ (Vector(tuple(p)) - piv))


BRIDGE = V(0.0, GY - 0.01, GZ + 0.007)      # sous le pont des lunettes : là où l'index les remonte
LENS_EDGE = V(0.175, GY + 0.004, GZ + 0.035)


def lerpv(a, b, w):
    return np.asarray(a, float) * (1 - w) + np.asarray(b, float) * w


def legs(fk, ph, lift=30, knee=50):
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (ph + o))
        up = max(0.0, math.cos(K.TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -15 * up)]


def P(fk, root=(0, 0, 0), scale=None, loc=None):
    return dict(fk=fk, root=root, scale=scale, loc=loc or {})


# position d'un bord de page (repère du buste au repos) pour un angle de page donné (0 : à plat à gauche)
def page_edge(ang):
    a = math.radians(ang)
    return np.array([CX + 0.09 * math.cos(a), CY - 0.035, AXZ + 0.09 * math.sin(a)])


# =====================================================================================================
# Les clips
# =====================================================================================================
def idle(t):
    # il lit ; tourne une page de la main gauche ; ses lunettes glissent, il les remonte de l'index, renifle
    read = 14 - 18 * win(t, 0.56, 1.0, 0.12)
    hd = [('x', read), ('z', 4 * math.sin(K.TAU * t)), ('y', 4 * win(t, 0.6, 0.97, 0.1))]
    fk = {'spine': [('x', 4 + 1.2 * K.wave(t, 2)), ('y', 1.5 * K.wave(t))], 'head': hd,
          'thighL': [('y', -2)], 'thighR': [('y', 2)]}
    # la page tourne de gauche à droite (180°) ; au raccord de la boucle elle revient à plat à gauche (invisible)
    ang = 180 * ss(0.2, 0.42, t)
    fk['page'] = [('y', -ang)]
    loc = {'lunettes': (0, 0, -0.014 * ss(0.05, 0.5, t) * (1 - ss(0.64, 0.72, t)))}
    # la main gauche : va chercher le coin de la page, l'accompagne, repart, puis monte aux lunettes
    w1 = win(t, 0.08, 0.52, 0.11)
    w2 = win(t, 0.54, 0.84, 0.09)
    if w1 > 0:
        tip = page_edge(min(ang, 110)) + np.array([0, 0, 0.006])
        dr = lerpv((0.1, -0.35, -0.93), (-0.4, -0.3, -0.8), ss(0.2, 0.34, t))
        blend(fk, ik_left(tip, dr, pole=(1, 0.3, -0.6)), w1)
    elif w2 > 0:
        tip = head_point(BRIDGE + V(0, 0, loc['lunettes'][2] - 0.025 * (1 - ss(0.56, 0.64, t))), hd)
        blend(fk, ik_left(tip, (0.38, -0.12, 0.92), pole=(1, 0.2, -0.4)), w2)
    return P(fk, root=(0, 0, 0.004 * K.wave(t, 2)), loc=loc)


def walk(t):
    # petits pas pressés, buste penché, la pile remontée sous le nez
    fk = {'spine': [('x', 9), ('y', 3 * K.wave(t, 2))], 'head': [('x', 24 + 2 * K.wave(t, 4)), ('z', 3 * K.wave(t, 2))],
          'armR': [('x', -34)], 'forearmR': [('x', 8)],
          'armL': [('x', 14 * K.wave(t, 2, 0.5)), ('y', -6)], 'forearmL': [('x', -18)]}
    legs(fk, 2 * t, lift=17, knee=34)
    fk['page'] = [('y', -2 * K.hop(t, 4))]
    return P(fk, root=(0, 0, 0.012 * K.hop(t, 4) - 0.006))


BOOK_PH = (0.0, 0.18, 0.33, 0.45)


def run(t):
    # panique : coudes en l'air, genoux hauts, regards affolés en arrière, les livres sautent sur l'avant-bras
    flap = K.wave(t, 4)
    fk = {'spine': [('x', -6), ('y', 5 * K.wave(t, 2))], 'head': [('x', -10 + 6 * K.wave(t, 4)), ('z', 28 * K.wave(t, 1))]}
    fk.update(arm_q('L', (0.85, 0.2, 0.45), (0.25 + 0.35 * flap, -0.35, -0.85), None))
    fk.update(arm_q('R', (-0.8, 0.25, 0.25), (0.35, -0.94, 0.05 + 0.12 * flap), None))
    legs(fk, 2 * t, lift=42, knee=85)
    loc = {f'livre{i + 1}': (0.006 * math.sin(K.TAU * (2 * t + ph)), 0, 0.022 * (i + 1) * K.hop(t, 4, ph)) for i, ph in enumerate(BOOK_PH)}
    for i, ph in enumerate(BOOK_PH):
        fk[f'livre{i + 1}'] = [('y', 7 * K.wave(t, 4, ph)), ('x', 4 * K.wave(t, 4, ph + 0.25))]
    fk['page'] = [('y', -50 * K.hop(t, 4, 0.2))]
    loc['lunettes'] = (0, 0, -0.008 * K.hop(t, 4, 0.1))
    return P(fk, root=(0, 0, 0.05 * K.hop(t, 4)), loc=loc)


def warn(t):
    # sursaut (les lunettes glissent), il les remonte de l'index, puis lève le doigt : « en fait… »
    jump = math.sin(math.pi * min(1.0, t / 0.28))
    s3 = ss(0.52, 0.78, t)
    hd = [('x', -12 * jump - 8 * s3), ('y', 7 * s3)]
    fk = {'spine': [('x', -6 * jump - 3 * s3)], 'head': hd}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -8 * jump)]
        fk['shin' + s] = [('x', 14 * jump)]
    slip = ss(0.0, 0.15, t) * (1 - ss(0.36, 0.48, t))
    loc = {'lunettes': (0, 0, -0.022 * slip)}
    fk['lunettes'] = [('x', 9 * slip)]
    fk.update({'armR': [('y', 18 * jump), ('x', -10 * jump)]})
    for i, ph in enumerate(BOOK_PH):
        loc[f'livre{i + 1}'] = (0, 0, 0.03 * (i + 1) * math.sin(math.pi * min(1.0, max(0.0, (t - 0.04 * i) / 0.3))))
    # bras gauche : jeté en l'air, puis l'index sous le pont des lunettes, puis levé à côté de la tête
    fling = arm_q('L', (0.8, 0.1, -0.45), (0.7, -0.2, 0.3), (0.5, -0.3, 0.8))
    tip = head_point(BRIDGE + V(0, 0, loc['lunettes'][2] - 0.02 * (1 - ss(0.22, 0.34, t))), hd)
    q_push = ik_left(tip, (0.38, -0.12, 0.92), pole=(1, 0.2, -0.4))
    q_up = ik_left(head_point(V(0.205, -0.235, 1.0), hd), (0.05, -0.1, 1.0), pole=(1, 0.3, -0.6))
    w_push = ss(0.16, 0.32, t)
    for k in q_push:
        q = Quaternion().slerp(fling.get(k, Quaternion()), math.sin(math.pi * min(1.0, t / 0.32)))
        q = q.slerp(q_push[k], w_push)
        fk[k] = q.slerp(q_up[k], s3)
    return P(fk, root=(0, 0, 0.06 * jump), loc=loc)


def laugh(t):
    # rire nasal : nez en l'air, épaules secouées, index pointé sur sa victime
    sh = K.wave(t, 5)
    fk = {'spine': [('x', -9 + 3 * sh)], 'head': [('x', -26 + 6 * sh), ('z', 6 * K.wave(t, 1))],
          'armR': [('x', -8 + 4 * sh)]}
    fk.update(arm_q('L', (0.4, -0.85, 0.2 + 0.04 * sh), (0.15, -0.98, 0.12), (0.05, -1, 0.05)))
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -5 * K.hop(t, 5))]
        fk['shin' + s] = [('x', 9 * K.hop(t, 5))]
    loc = {'lunettes': (0, 0, 0.004 * sh)}
    for i, ph in enumerate(BOOK_PH):
        loc[f'livre{i + 1}'] = (0, 0, 0.006 * (i + 1) * K.hop(t, 5, ph))
    return P(fk, root=(0, 0.01, 0.012 * K.hop(t, 5) - 0.006), loc=loc)


# danse du robot : quatre poses par boucle, des à-coups raides avec un petit flottement en arrivant
ROBOT = [
    dict(L=((1, 0, 0.05), (0.0, -0.05, 1)), R=((-0.25, 0.1, -1), (0.25, -0.95, 0.0)), head=(32, 0), sp=(0, 8), dip=1),
    dict(L=((1, 0, 0.05), (1, -0.05, 0.02)), R=((-0.35, -0.4, -0.8), (0.3, -0.7, 0.6)), head=(0, -8), sp=(0, 0), dip=0),
    dict(L=((0.15, -1, 0.05), (0.12, -1, 0.05)), R=((-0.25, 0.1, -1), (0.25, -0.95, 0.0)), head=(-32, 0), sp=(0, -8), dip=1),
    dict(L=((0.25, 0.05, -1), (0.1, -1, 0.0)), R=((-0.6, 0.0, -0.4), (0.2, -0.95, 0.15)), head=(0, 10), sp=(-10, 0), dip=0),
]


def dance(t):
    q = t * 4
    i = int(math.floor(q)) % 4
    f = q - math.floor(q)
    e = ss(0.0, 0.3, f)
    wob = math.sin(f * K.TAU * 2.5) * math.exp(-7 * f) * (1 - f)
    A, B = ROBOT[i - 1], ROBOT[i]
    fk = {}
    for s in ('L', 'R'):
        qa = arm_q(s, A[s][0], A[s][1], A[s][1] if s == 'L' else None)
        qb = arm_q(s, B[s][0], B[s][1], B[s][1] if s == 'L' else None)
        for k in qb:
            fk[k] = qa.get(k, Quaternion()).slerp(qb[k], e)
    hz = A['head'][0] + (B['head'][0] - A['head'][0]) * e
    hx = A['head'][1] + (B['head'][1] - A['head'][1]) * e
    fk['head'] = [('z', hz + 5 * wob), ('x', hx)]
    sz = A['sp'][0] + (B['sp'][0] - A['sp'][0]) * e
    sy = A['sp'][1] + (B['sp'][1] - A['sp'][1]) * e
    fk['spine'] = [('z', sz), ('y', sy + 3 * wob)]
    dip = (A['dip'] + (B['dip'] - A['dip']) * e) * 0.5 + 0.5 * K.hop(t, 4) ** 4
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -16 * dip)]
        fk['shin' + s] = [('x', 30 * dip)]
        fk['foot' + s] = [('x', -14 * dip)]
    loc = {f'livre{j + 1}': (0, 0, 0.004 * (j + 1) * abs(wob)) for j in range(4)}
    return P(fk, root=(0, 0, -0.022 * dip), loc=loc)


bake([('Idle', 60, idle), ('Walk', 20, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, laugh), ('Dance', 32, dance)])

K.preview([
    ('face', 'Idle', 52, (0.25, -2.9, 0.95), (0, 0, 0.62)),
    ('troisquarts', 'Idle', 52, (1.9, -2.1, 1.4), (0, 0, 0.62)),
    ('visage', 'Idle', 52, (0.2, -1.25, 1.02), (0, 0, 0.92)),
    ('iso', 'Idle', 0, (2.3, -2.3, 2.7), (0, 0, 0.55)),
    ('page', 'Idle', 17, (1.0, -1.7, 1.2), (-0.05, 0, 0.7)),
    ('lunettes', 'Idle', 41, (1.0, -1.9, 1.15), (0, 0, 0.8)),
    ('marche', 'Walk', 5, (1.6, -2.4, 1.2), (0, 0, 0.6)),
    ('course', 'Run', 4, (2.0, -2.2, 1.2), (0, 0, 0.65)),
    ('alerte', 'Warn', 16, (1.1, -2.6, 1.1), (0, 0, 0.7)),
    ('rire', 'Hit', 8, (2.5, -1.3, 1.1), (0, 0, 0.7)),
    ('robot', 'Dance', 4, (0.6, -2.8, 1.1), (0, 0, 0.65)),
])
K.export()
