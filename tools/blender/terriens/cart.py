# La dame au caddie : petite vieille voûtée et furieuse, chignon gris, lunettes en demi-lune au bout du nez (elle fusille
# du regard par-dessus), robe violette à fleurs, gilet beige, bas épais, sac à main au bras. Elle pousse devant elle
# (côté -Y) un caddie de supermarché en fil de fer plein de courses (baguette et poireaux qui dépassent).
#   Blender -b -P tools/blender/terriens/cart.py -- public/models/terriens/cart.glb [dossier_aperçus]
# Clips : Idle (relit sa liste de courses), Walk (pousse en clopinant, une roue folle), Run (charge penchée comme une
# furie, les roues qui vibrent), Warn (se cabre et recule le caddie pour prendre de l'élan), Hit (brandit le poing,
# le sac à main qui tourne), Dance (petit twist de mamie).
# Pièces nommées : Caddie (panier), Chassis, Poignee, Courses, RoueAvG/RoueAvD/RoueArG/RoueArD (+ Fourche…), SacAMain, Liste,
# Lunettes. Os dédiés : cart (l'engin), pivotXX (pivot des roulettes), roueXX (rotation), bag (sac), liste, skirt, jaw.
import os
import sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, '..')]
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler
import kit as K
import engin as E
from kit import V, ell, cone, rbox, srgb

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/cart.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('cart', OUT, PREVIEW)
E.private_work('cart')

# --- proportions ---------------------------------------------------------------------------------------------
HIP_Z = 0.5
SH = V(0.16, -0.06, 0.875)            # épaule gauche (le dos est voûté : épaules en avant)
L1, L2 = 0.2, 0.19
GRIP = V(0.17, -0.40, 0.83)           # le poing gauche serre la poignée du caddie
WR = V(0.172, -0.348, 0.858)
POLE = V(0.44, 0.12, 0.8)             # coudes en dehors : elle pousse en canard


def elbow(S, T, P, l1, l2):
    S, T, P = Vector(tuple(S)), Vector(tuple(T)), Vector(tuple(P))
    D = T - S
    d = min(D.length, l1 + l2 - 0.004)
    u = D.normalized()
    v = P - S
    v = (v - u * v.dot(u)).normalized()
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    return np.array(S + u * x + v * math.sqrt(max(l1 * l1 - x * x, 0)))


EL = elbow(SH, WR, POLE, L1, L2)
HD = GRIP + (GRIP - WR) / np.linalg.norm(GRIP - WR) * 0.03
LEG = {'L': V(0.09, 0.0, 0), 'R': V(-0.09, 0.0, 0)}
KNEE_Z, ANKLE_Z = 0.27, 0.07
HEAD_C = V(0, -0.1, 1.08)
MOUTH_C, MOUTH_R = V(0, -0.248, 0.993), V(0.048, 0.05, 0.018)
HP = EL + 0.3 * (WR - EL)             # le sac pend au bras gauche, près du coude

# le caddie
BOT = dict(x=0.21, y0=-0.55, y1=-1.12, z=0.36)
TOP = dict(x=0.27, y0=-0.46, y1=-1.26, z=0.8)
BAR_Y, BAR_Z = GRIP[1], GRIP[2]
CASTERS = {'AvG': (0.17, -1.18), 'AvD': (-0.17, -1.18), 'ArG': (0.23, -0.5), 'ArD': (-0.23, -0.5)}
WHEEL_R, TRAIL, SWIVEL_Z = 0.05, 0.025, 0.13

body = [
    # gilet : torse, poitrine basse, bosse du dos voûté, épaules
    ell('torso', (0, 0.0, 0.76), (0.2, 0.16, 0.19), k=0.05),
    ell('bosom', (0, -0.09, 0.755), (0.17, 0.09, 0.085), k=0.05),
    ell('hump', (0, 0.07, 0.875), (0.15, 0.11, 0.1), k=0.05),
    ell('shoulder', (0.13, -0.03, 0.87), (0.08, 0.08, 0.06), k=0.04),
    ell('shoulder', (-0.13, -0.03, 0.87), (0.08, 0.08, 0.06), k=0.04),
    cone('neck', (0, 0.0, 0.9), (0, -0.07, 1.0), 0.06, 0.055, k=0.04),
    # la tête : menton pointu, nez long, chignon gris, mise en plis
    ell('head', tuple(HEAD_C), (0.18, 0.17, 0.185), k=0.04),
    ell('jowl', (0, -0.165, 1.0), (0.12, 0.08, 0.06), k=0.04),
    ell('chin', (0, -0.205, 0.955), (0.055, 0.045, 0.042), k=0.03),
    cone('nose', (0, -0.245, 1.1), (0, -0.335, 1.045), 0.034, 0.017, k=0.025),
    ell('ear', (0.175, -0.08, 1.07), (0.03, 0.04, 0.05), k=0.02),
    ell('ear', (-0.175, -0.08, 1.07), (0.03, 0.04, 0.05), k=0.02),
    ell('brow', (0.07, -0.243, 1.178), (0.045, 0.015, 0.013), k=0.012, R=K.rot(0, -24, 0)),
    ell('brow', (-0.07, -0.243, 1.178), (0.045, 0.015, 0.013), k=0.012, R=K.rot(0, 24, 0)),
    ell('hair', (0, -0.055, 1.12), (0.19, 0.18, 0.178), k=0.03),
    ell('hair', (0.155, -0.04, 1.14), (0.06, 0.08, 0.07), k=0.03),
    ell('hair', (-0.155, -0.04, 1.14), (0.06, 0.08, 0.07), k=0.03),
    ell('bun', (0, 0.03, 1.285), (0.088, 0.082, 0.062), k=0.03),
    ell('mouth', tuple(MOUTH_C), tuple(MOUTH_R), k=0.01, op='sub'),
    # robe : hanches, gros derrière, jupe évasée qui s'arrête sous le genou
    ell('hips', (0, 0.02, 0.55), (0.2, 0.17, 0.12), k=0.05),
    ell('bum', (0, 0.09, 0.52), (0.18, 0.11, 0.11), k=0.05),
    cone('skirt', (0, 0.015, 0.62), (0, 0.0, 0.2), 0.19, 0.265, k=0.04),
    rbox('cut', (0, 0, -0.02), (0.6, 0.6, 0.24), r=0.01, k=0.012, op='sub'),
]
for s, b in LEG.items():
    body.append(cone('leg', tuple(b + V(0, 0, 0.42)), tuple(b + V(0, -0.01, KNEE_Z)), 0.05, 0.046, k=0.02))
    body.append(cone('leg', tuple(b + V(0, -0.01, KNEE_Z)), tuple(b + V(0, 0, ANKLE_Z)), 0.046, 0.034, k=0.02))
    body.append(ell('shoe', tuple(b + V(0, -0.045, 0.04)), (0.055, 0.1, 0.042), k=0.025))
    body.append(rbox('heel', tuple(b + V(0, 0.035, 0.02)), (0.028, 0.025, 0.02), r=0.008, k=0.01))

CARDI, DRESS, SKIN = srgb('#3f9a6a'), srgb('#8a46c8'), srgb('#f4caa8')
COL = {'default': CARDI, 'torso': CARDI, 'bosom': CARDI, 'hump': CARDI, 'shoulder': CARDI, 'neck': SKIN, 'head': SKIN,
       'jowl': SKIN, 'chin': SKIN, 'nose': srgb('#f2b39c'), 'ear': srgb('#f0b8a0'), 'brow': srgb('#9a9aae'),
       'hair': srgb('#d8d8e6'), 'bun': srgb('#c6c6d8'), 'hips': DRESS, 'bum': DRESS, 'skirt': DRESS,
       'leg': srgb('#d39c7a'), 'shoe': srgb('#5a1a2e'), 'heel': srgb('#3a1020'), 'mouth': srgb('#5a1018')}


def flowers(co, col, m):
    """motif à fleurs (roses et blanches, cœur jaune) sur les sommets m, en coordonnées cylindriques"""
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    th = np.arctan2(x, -y)
    n, dz = 16, 0.075
    row = np.floor(z / dz)
    off = (row % 2) * 0.5
    cell = np.floor(th / (math.tau / n) + off)
    cth = (cell + 0.5 - off) * (math.tau / n)
    cz = (row + 0.5) * dz
    r = np.hypot(x, y)
    d = np.hypot((th - cth) * r, z - cz)
    pink = ((cell + row) % 2) == 0
    petal = m & (d < 0.021)
    col[petal & pink] = srgb('#ff86cf')
    col[petal & ~pink] = srgb('#fbeeff')
    col[m & (d < 0.008)] = srgb('#ffd23f')
    leaf = m & (np.abs(d - 0.03) < 0.006) & (np.abs((th - cth) * r) < 0.012) & (z - cz < 0)
    col[leaf] = srgb('#4aa860')


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    top = np.isin(tag, ('torso', 'bosom', 'hump', 'shoulder'))
    # bouche : intérieur sombre, lèvres pincées rose foncé autour
    q = (co - MOUTH_C) / MOUTH_R
    qn = np.linalg.norm(q, axis=1)
    face = np.isin(tag, ('head', 'jowl', 'chin'))
    inside = (qn < 1.35) & face
    col[face & (qn < 1.9) & (y < -0.2)] = srgb('#c8607a')
    col[inside] = srgb('#4a0e18')
    # cheveux : tout ce qui est au-dessus de la lisière (front dégagé, nuque couverte)
    hairline = 0.11 - 0.78 * (y + 0.22)
    hair = np.isin(tag, ('head', 'ear')) & (z - 1.08 > hairline) & ~((tag == 'ear') & (z < 1.1))
    col[hair] = srgb('#d8d8e6')
    curl = np.isin(tag, ('hair', 'bun')) & (np.sin(x * 160) * np.sin(z * 160 + y * 90) > 0.55)
    col[curl] = srgb('#b8b8cc')
    # joues roses, grain de beauté, rides du front
    cheek = face & (np.abs(ax - 0.11) < 0.04) & (np.abs(z - 1.04) < 0.035) & (y < -0.15)
    col[cheek] = srgb('#f2a2a0')
    col[face & (np.hypot(x - 0.045, z - 0.962) < 0.009) & (y < -0.2)] = srgb('#5a3020')
    # gilet ouvert sur la robe, col en dentelle, boutons, poches (avec un mouchoir), côtes en bas
    gap = 0.03 + 0.28 * np.maximum(z - 0.6, 0)
    cardi = (top | np.isin(tag, ('hips', 'bum', 'skirt'))) & (z > 0.56)
    col[cardi] = CARDI
    opening = cardi & (y < -0.06) & (ax < gap)
    col[opening] = DRESS
    collar = (top | (tag == 'neck')) & (z > 0.885) & (z < 0.94) & (y < 0.02) & (ax < 0.12)
    col[collar] = srgb('#fbf6ee')
    for bz in (0.66, 0.73, 0.8):
        btn = top & (y < -0.1) & (np.hypot(ax - (0.03 + 0.28 * (bz - 0.6) + 0.016), z - bz) < 0.011)
        col[btn] = srgb('#f4e8c8')
    pocket = top & (y < -0.08) & (np.abs(ax - 0.12) < 0.045) & (np.abs(z - 0.625) < 0.035)
    col[pocket] = srgb('#35855a')
    col[pocket & (x > 0) & (z > 0.645) & (np.abs(x - 0.11) < 0.022)] = srgb('#ffffff')
    rib = cardi & ~opening & (z < 0.6)
    col[rib] = srgb('#2f7a52')
    col[rib & ((np.arctan2(x, -y) * 40).astype(int) % 2 == 0)] = srgb('#28684a')
    under = np.isin(tag, ('torso', 'hips', 'bum', 'skirt')) & (z <= 0.56)
    col[under] = DRESS
    # robe à fleurs
    dress = under | opening
    flowers(co, col, dress & ~collar)
    # bas épais plus clairs aux genoux, chaussures avec une petite boucle
    shoe = tag == 'shoe'
    col[shoe & (np.abs(x - np.sign(x) * 0.09) < 0.015) & (y < -0.06) & (z > 0.05)] = srgb('#e8b830')


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.36, -0.38, 0.0), (0.36, 0.3, 1.37), vox=0.0052)
K.decimate(BODY, 7000)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Mamie', rough=0.6))

# --- les bras (manches du gilet, mains) : maillage à part -------------------------------------------------------
arms = []
for sx in (1, -1):
    m = V(sx, 1, 1)
    cuff = WR - (WR - EL) / np.linalg.norm(WR - EL) * 0.035
    arms += [ell('sleeve', tuple(SH * m), (0.068, 0.068, 0.068), k=0.03),
             cone('sleeve', tuple(SH * m), tuple(EL * m), 0.06, 0.05, k=0.03),
             cone('sleeve', tuple(EL * m), tuple(cuff * m), 0.05, 0.048, k=0.02),
             cone('cuff', tuple(cuff * m), tuple((WR + (GRIP - WR) * 0.1) * m), 0.046, 0.04, k=0.015),
             ell('hand', tuple(GRIP * m), (0.04, 0.046, 0.038), k=0.025),
             ell('hand', tuple((GRIP + V(-0.026, 0.012, 0.03)) * m), (0.017, 0.024, 0.016), k=0.012)]
ACOL = {'default': CARDI, 'sleeve': CARDI, 'cuff': srgb('#2f7a52'), 'hand': srgb('#f2c0a0')}
lo = np.minimum(SH, np.minimum(EL, GRIP)) - 0.1
hi = np.maximum(SH, np.maximum(EL, GRIP)) + 0.1
ARMS = K.sdf_mesh('Bras', arms, (-hi[0], lo[1], lo[2]), (hi[0], hi[1], hi[2]), vox=0.0045)
K.decimate(ARMS, 1300)
ACO, ATAG = K.paint(ARMS, arms, ACOL)
ARMS.data.materials.append(K.vc_material('Gilet', rough=0.7))

# --- accessoires de la tête ---------------------------------------------------------------------------------------
EYE_L = (0.066, -0.218, 1.122)
EYES = E.eyes(EYE_L, 0.046, pupil_dir=(0, -1, 0.12), pupil_r=0.5, seg=14)
gold = K.mat('Or', '#e8b830', rough=0.25, metal=0.8)
LENS_Z, LENS_Y = 1.07, -0.302
LP = []
for sx in (1, -1):
    c = (sx * 0.062, LENS_Y, LENS_Z)
    LP += [ell('lens', c, (0.043, 0.006, 0.03), k=0.004),
           rbox('cut', (sx * 0.062, LENS_Y, LENS_Z + 0.05), (0.06, 0.02, 0.05), r=0.002, k=0.002, op='sub')]


def lens_extra(co, nor, col, tag):
    for sx in (1, -1):
        q = np.hypot((co[:, 0] - sx * 0.062) / 0.043, (co[:, 2] - LENS_Z) / 0.03)
        rim = ((q > 0.78) | (co[:, 2] > LENS_Z - 0.004)) & (np.abs(co[:, 0] - sx * 0.062) < 0.05)
        col[rim] = srgb('#e8b830')


SPECS = K.sdf_mesh('Lunettes', LP, (-0.12, LENS_Y - 0.02, LENS_Z - 0.04), (0.12, LENS_Y + 0.02, LENS_Z + 0.01), vox=0.0022, smooth=1)
K.decimate(SPECS, 360, symmetric=True)
K.paint(SPECS, LP, {'default': srgb('#c8e8ff'), 'lens': srgb('#c8e8ff')}, lens_extra)
SPECS.data.materials.append(K.vc_material('VerreDemiLune', rough=0.1))
specs = [SPECS, K.cylinder('Pont', (0.022, LENS_Y, LENS_Z - 0.002), (-0.022, LENS_Y, LENS_Z - 0.002), 0.0045, gold, seg=5)]
for sx in (1, -1):
    sd = 'G' if sx > 0 else 'D'
    specs.append(K.cylinder('Branche' + sd, (sx * 0.104, LENS_Y + 0.004, LENS_Z), (sx * 0.172, -0.1, 1.085), 0.0045, gold, seg=5))
    # la chaînette des lunettes, qui pend derrière la nuque
    specs.append(K.cylinder('Chainette' + sd, (sx * 0.172, -0.1, 1.08), (sx * 0.1, 0.02, 0.95), 0.003, gold, seg=4))
pearl = K.mat('Perle', '#fff8f0', rough=0.15)
EARRINGS = [K.sphere('Perle' + ('G' if sx > 0 else 'D'), (sx * 0.18, -0.085, 1.015), 0.017, pearl, seg=8) for sx in (1, -1)]
TOOTH = [K.box('Dent', (0.012, -0.255, 1.006), (0.018, 0.012, 0.022), K.mat('Dents', '#fffbe8', rough=0.2), bevel=0.004)]
PIN = [K.cylinder('Epingle', (-0.07, 0.03, 1.31), (0.08, 0.0, 1.27), 0.005, K.mat('Pique', '#3a2a5a'), seg=5)]

# --- le sac à main ----------------------------------------------------------------------------------------------------
BAGC = HP + V(0, 0, -0.13)
BG = [
    rbox('bag', tuple(BAGC), (0.032, 0.075, 0.055), r=0.022, k=0.01),
    rbox('flap', tuple(BAGC + V(0, 0, 0.035)), (0.036, 0.077, 0.024), r=0.012, k=0.006),
    ell('clasp', tuple(BAGC + V(0.035, 0, 0.02)), (0.008, 0.016, 0.012), k=0.004),
    cone('strap', tuple(BAGC + V(0, 0.05, 0.05)), tuple(HP + V(0, 0.012, 0)), 0.007, 0.007, k=0.004),
    cone('strap', tuple(BAGC + V(0, -0.05, 0.05)), tuple(HP + V(0, -0.012, 0)), 0.007, 0.007, k=0.004),
]
BAG = K.sdf_mesh('SacAMain', BG, tuple(HP + V(-0.06, -0.11, -0.22)), tuple(HP + V(0.06, 0.11, 0.03)), vox=0.0035)
K.decimate(BAG, 420, symmetric=False)
K.paint(BAG, BG, {'default': srgb('#4a1a3a'), 'bag': srgb('#4a1a3a'), 'flap': srgb('#3a1230'), 'clasp': srgb('#e8b830'),
                  'strap': srgb('#3a1230')})
BAG.data.materials.append(K.vc_material('SacVernis', rough=0.25))

# --- la liste de courses (cachée dans la main sauf quand elle la relit) ------------------------------------------------
GR = GRIP * V(-1, 1, 1)
paper = K.mat('Papier', '#fbf8ec', rough=0.9)
ink = K.mat('Encre', '#3a5fbf', rough=0.9)
LISTE = [K.box('Liste', tuple(GR + V(0, 0, 0.075)), (0.07, 0.003, 0.1), paper)]
for i in range(4):
    LISTE.append(K.box(f'ListeLigne{i}', tuple(GR + V(-0.004 + 0.006 * (i % 2), -0.002, 0.105 - i * 0.02)), (0.045 - 0.01 * (i % 2), 0.002, 0.004), ink))

# --- le caddie ----------------------------------------------------------------------------------------------------------
chrome = K.mat('Chrome', '#c8d0e0', rough=0.25, metal=0.85)
red = K.mat('PlastiqueRouge', '#e8334a', rough=0.4)


def lerp(a, b, f):
    return a + (b - a) * f


def ring(f):
    """rectangle du panier à la hauteur relative f (0 = fond, 1 = bord)"""
    return lerp(BOT['x'], TOP['x'], f), lerp(BOT['y0'], TOP['y0'], f), lerp(BOT['y1'], TOP['y1'], f), lerp(BOT['z'], TOP['z'], f)


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


rods = []
W = 0.0065


def rod(a, b, r=W, seg=4):
    rods.append(K.cylinder('fil', tuple(a), tuple(b), r, chrome, seg=seg, smooth=False))


# côtés : barreaux obliques, deux ceintures, le bord du haut plus épais
for i in range(8):
    f = i / 7
    for sx in (1, -1):
        rod((sx * BOT['x'], lerp(BOT['y0'], BOT['y1'], f), BOT['z']), (sx * TOP['x'], lerp(TOP['y0'], TOP['y1'], f), TOP['z']))
for j in range(1, 5):
    f = j / 5
    for (yb, yt) in ((BOT['y1'], TOP['y1']), (BOT['y0'], TOP['y0'])):
        rod((lerp(-BOT['x'], BOT['x'], f), yb, BOT['z']), (lerp(-TOP['x'], TOP['x'], f), yt, TOP['z']))
for f, r, sg in ((0.0, 0.008, 4), (0.36, W, 4), (0.7, W, 4), (1.0, 0.012, 6)):
    hx, y0, y1, z = ring(f)
    for a, b in (((hx, y0), (hx, y1)), ((-hx, y0), (-hx, y1)), ((-hx, y0), (hx, y0)), ((-hx, y1), (hx, y1))):
        rod((a[0], a[1], z), (b[0], b[1], z), r, sg)
# le fond en grille
for j in range(1, 5):
    x = lerp(-BOT['x'], BOT['x'], j / 5)
    rod((x, BOT['y0'], BOT['z']), (x, BOT['y1'], BOT['z']))
for i in range(1, 5):
    y = lerp(BOT['y0'], BOT['y1'], i / 5)
    rod((-BOT['x'], y, BOT['z']), (BOT['x'], y, BOT['z']))
BASKET = join(rods, 'Caddie')

frame = []
hx, y0, _, zt = ring(1.0)
frame.append(K.cylinder('cadre', (0.3, BAR_Y, BAR_Z), (-0.3, BAR_Y, BAR_Z), 0.011, chrome, seg=6))
for sx in (1, -1):
    m = V(sx, 1, 1)
    frame.append(K.cylinder('cadre', tuple(V(0.29, BAR_Y, BAR_Z) * m), tuple(V(hx, y0, zt) * m), 0.01, chrome, seg=6))
    ax, ay = CASTERS['Ar' + ('G' if sx > 0 else 'D')]
    fx, fy = CASTERS['Av' + ('G' if sx > 0 else 'D')]
    frame.append(K.cylinder('cadre', tuple(V(0.29, BAR_Y, BAR_Z) * m), (sx * abs(ax), ay, SWIVEL_Z + 0.01), 0.012, chrome, seg=6))
    frame.append(K.cylinder('cadre', (sx * abs(ax), ay, SWIVEL_Z + 0.01), (sx * abs(fx), fy, SWIVEL_Z + 0.01), 0.012, chrome, seg=6))
    frame.append(K.cylinder('cadre', (sx * abs(fx) * 1.05, fy + 0.06, SWIVEL_Z), (sx * BOT['x'] * 0.9, BOT['y1'] + 0.02, BOT['z']), 0.009, chrome, seg=6))
frame.append(K.cylinder('cadre', (0.17, CASTERS['AvG'][1], SWIVEL_Z + 0.01), (-0.17, CASTERS['AvG'][1], SWIVEL_Z + 0.01), 0.012, chrome, seg=6))
for i in range(4):   # la grille du bas, pour les packs d'eau
    x = lerp(-0.16, 0.16, i / 3)
    frame.append(K.cylinder('cadre', (x, -0.56, SWIVEL_Z + 0.035), (x * 0.85, -1.12, SWIVEL_Z + 0.035), 0.006, chrome, seg=4, smooth=False))
CHASSIS = join(frame, 'Chassis')
HANDLE = [K.cylinder('Poignee', (0.27, BAR_Y, BAR_Z), (-0.27, BAR_Y, BAR_Z), 0.02, red, seg=10),
          K.box('Siege', (0, TOP['y0'] - 0.07, TOP['z'] - 0.07), (0.4, 0.018, 0.11), red, rot_deg=(-14, 0, 0), bevel=0.006),
          K.box('Plaque', (0, TOP['y1'] - 0.006, TOP['z'] - 0.07), (0.22, 0.012, 0.075), K.mat('PlaqueBleue', '#3a5fbf', rough=0.4), bevel=0.005)]

# roulettes : chape pivotante + roue grise avec un repère rouge (on la voit tourner)
grey = K.mat('Caoutchouc', '#2e2a3a', rough=0.8)
hub = K.mat('Moyeu', '#b8bccc', rough=0.4)
WHEEL_OBJ = {}
for c, (x, y) in CASTERS.items():
    wy = y + TRAIL
    fork = [K.cylinder('Pivot' + c, (x, y, SWIVEL_Z + 0.01), (x, y, SWIVEL_Z - 0.012), 0.024, chrome, seg=8),
            K.box('Chape' + c + 'a', (x + 0.024, wy - 0.006, (SWIVEL_Z + 0.05) / 2), (0.006, 0.04, SWIVEL_Z - 0.04), chrome),
            K.box('Chape' + c + 'b', (x - 0.024, wy - 0.006, (SWIVEL_Z + 0.05) / 2), (0.006, 0.04, SWIVEL_Z - 0.04), chrome)]
    whl = [K.cylinder('Roue' + c, (x - 0.017, wy, WHEEL_R), (x + 0.017, wy, WHEEL_R), WHEEL_R, grey, seg=12),
           K.cylinder('Roue' + c + 'Moyeu', (x - 0.019, wy, WHEEL_R), (x + 0.019, wy, WHEEL_R), 0.024, hub, seg=8),
           K.box('Roue' + c + 'Repere', (x, wy, WHEEL_R + 0.032), (0.04, 0.014, 0.012), K.mat('Repere', '#e8334a'))]
    WHEEL_OBJ[c] = (fork, whl)

# les courses : baguette, poireaux, vin rouge, lessive, céréales, chou, oranges
CS = [
    cone('bread', (0.12, -0.78, 0.4), (0.22, -1.24, 1.04), 0.04, 0.033, k=0.01),
    cone('leek', (-0.14, -0.74, 0.39), (-0.2, -0.76, 0.86), 0.032, 0.03, k=0.01),
    cone('leek', (-0.1, -0.86, 0.39), (-0.15, -0.9, 0.84), 0.03, 0.028, k=0.01),
    ell('leaf', (-0.27, -0.74, 0.98), (0.012, 0.03, 0.13), k=0.015, R=K.rot(-8, -26, 0)),
    ell('leaf', (-0.19, -0.8, 1.0), (0.012, 0.03, 0.13), k=0.015, R=K.rot(12, -6, 0)),
    ell('leaf', (-0.14, -0.98, 0.95), (0.012, 0.028, 0.12), k=0.015, R=K.rot(20, -14, 0)),
    ell('leaf', (-0.21, -0.92, 0.96), (0.012, 0.028, 0.12), k=0.015, R=K.rot(-14, -24, 0)),
    cone('bottle', (0.12, -0.62, 0.38), (0.12, -0.62, 0.62), 0.036, 0.036, k=0.01),
    cone('bottle', (0.12, -0.62, 0.62), (0.13, -0.64, 0.76), 0.03, 0.013, k=0.02),
    rbox('soap', (-0.1, -0.93, 0.52), (0.07, 0.05, 0.13), r=0.012, k=0.008),
    rbox('cereal', (0.06, -1.02, 0.54), (0.1, 0.035, 0.15), r=0.008, k=0.008),
    ell('cabbage', (-0.11, -1.08, 0.46), (0.085, 0.08, 0.08), k=0.01),
    ell('orange', (0.13, -0.84, 0.42), (0.045, 0.045, 0.045), k=0.005),
    ell('orange', (0.06, -0.8, 0.42), (0.045, 0.045, 0.045), k=0.005),
    ell('orange', (0.1, -0.82, 0.49), (0.045, 0.045, 0.045), k=0.005),
]
CSCOL = {'default': srgb('#d8a050'), 'bread': srgb('#e0a850'), 'leek': srgb('#f4f6e8'), 'leaf': srgb('#2f8a3a'),
         'bottle': srgb('#1e3a24'), 'soap': srgb('#ff8a2a'), 'cereal': srgb('#ffd23f'), 'cabbage': srgb('#7ac85a'),
         'orange': srgb('#ff9a1a')}


def shop_extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # entailles de la baguette
    a, b = V(0.12, -0.78, 0.4), V(0.22, -1.24, 1.04)
    t = ((co - a) @ (b - a)) / ((b - a) @ (b - a))
    col[(tag == 'bread') & (np.abs((t * 9) % 1 - 0.5) < 0.12) & (nor[:, 2] > 0.2)] = srgb('#f6e0a8')
    col[(tag == 'bread') & (nor[:, 2] < -0.3)] = srgb('#b87a30')
    # poireaux : blanc en bas, vert clair puis vert foncé
    col[(tag == 'leek') & (z > 0.66)] = srgb('#b8e090')
    col[(tag == 'leek') & (z > 0.78)] = srgb('#5aa848')
    # vin : étiquette, capsule
    col[(tag == 'bottle') & (np.abs(z - 0.52) < 0.045)] = srgb('#f4eedb')
    col[(tag == 'bottle') & (np.abs(z - 0.52) < 0.02)] = srgb('#a01a30')
    col[(tag == 'bottle') & (z > 0.72)] = srgb('#a01a30')
    # paquets : bandes et logos
    col[(tag == 'soap') & (np.abs(z - 0.55) < 0.03)] = srgb('#3a5fbf')
    col[(tag == 'cereal') & (np.hypot(x - 0.06, z - 0.56) < 0.05)] = srgb('#e8334a')
    col[(tag == 'cabbage') & (np.sin(np.arctan2(x + 0.11, y + 1.08) * 7 + z * 30) > 0.6)] = srgb('#4aa040')


SHOP = K.sdf_mesh('Courses', CS, (-0.3, -1.3, 0.33), (0.3, -0.38, 1.13), vox=0.0055)
K.decimate(SHOP, 1700, symmetric=False)
K.paint(SHOP, CS, CSCOL, shop_extra)
SHOP.data.materials.append(K.vc_material('Courses', rough=0.6))

# --- squelette ------------------------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, HIP_Z + 0.14))
K.bone('spine', (0, 0, HIP_Z + 0.14), (0, -0.05, 0.93), 'root', True)
K.bone('head', (0, -0.05, 0.93), (0, -0.13, 1.32), 'spine', True)
K.bone('jaw', (0, -0.14, 1.04), (0, -0.25, 0.96), 'head')
K.bone('skirt', (0, 0.015, 0.6), (0, 0.0, 0.22), 'root')
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0, HIP_Z), b + V(0, -0.01, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0, -0.01, KNEE_Z), b + V(0, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0, 0, ANKLE_Z), b + V(0, -0.13, 0.025), 'shin' + s, True)
K.bone('bag', tuple(HP), tuple(HP + V(0, 0, -0.16)), 'forearmL')
K.bone('liste', tuple(GR), tuple(GR + V(0, 0, 0.1)), 'handR')
K.bone('cart', (0, -0.85, 0.13), (0, -0.55, 0.13))
for c, (x, y) in CASTERS.items():
    K.bone('pivot' + c, (x, y, SWIVEL_Z), (x, y, 0.07), 'cart')
    K.bone('roue' + c, (x, y + TRAIL, WHEEL_R), (x + 0.08, y + TRAIL, WHEEL_R), 'pivot' + c)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'nose', 'ear', 'hair', 'brow', 'bun'):
        return ['head']
    if tg == 'chin':
        return ['jaw', 'head']
    if tg == 'jowl':
        return ['head', 'jaw'] if (p[1] < -0.2 and p[2] < 0.99) else ['head']
    if tg == 'neck':
        return ['spine', 'head']
    if tg in ('torso', 'bosom', 'hump', 'shoulder'):
        return ['spine'] + (['root'] if p[2] < 0.7 else [])
    if tg in ('hips', 'bum'):
        return ['root'] + (['thigh' + s] if p[2] < 0.5 and abs(p[0]) > 0.06 else [])
    if tg == 'skirt':
        return ['root', 'skirt'] if p[2] > 0.45 else ['skirt'] + (['thigh' + s] if p[1] < -0.08 else [])
    if tg == 'leg':
        return ['thigh' + s, 'shin' + s] if p[2] > ANKLE_Z + 0.04 else ['shin' + s, 'foot' + s]
    if tg in ('shoe', 'heel'):
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


def arm_allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg == 'sleeve':
        near = np.linalg.norm(p - SH * V(1 if s == 'L' else -1, 1, 1)) < 0.05
        return ['spine', 'arm' + s] if near else ['arm' + s, 'forearm' + s]
    if tg == 'cuff':
        return ['forearm' + s, 'hand' + s]
    return ['forearm' + s, 'hand' + s]


K.skin(BODY, CO, TAG, allowed)
K.skin(ARMS, ACO, ATAG, arm_allowed, smooth=3)
for o in EYES + specs + EARRINGS + PIN + TOOTH:
    K.attach(o, 'head')
K.attach(BAG, 'bag')
for o in LISTE:
    K.attach(o, 'liste')
for o in [BASKET, CHASSIS, SHOP] + HANDLE:
    K.attach(o, 'cart')
for c, (fork, whl) in WHEEL_OBJ.items():
    for o in fork:
        K.attach(o, 'pivot' + c)
    for o in whl:
        K.attach(o, 'roue' + c)

# --- animations ---------------------------------------------------------------------------------------------------------
TAU = math.tau
wave, hop, seg, path = K.wave, K.hop, E.seg, E.path
REST = K.S['REST']


def cart_steps(st, steps=(), off=(0, 0, 0), ground=True):
    """pose le caddie par une suite de rotations (pivot, (rx, ry, rz) en degrés) puis le repose sur ses roulettes"""
    Mw = Matrix.Identity(4)
    for piv, (rx, ry, rz) in steps:
        pv = Vector(tuple(piv))
        R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix().to_4x4()
        Mw = Matrix.Translation(pv) @ R @ Matrix.Translation(-pv) @ Mw
    st['mat']['cart'] = Matrix.Translation(Vector(tuple(off))) @ Mw @ REST['cart']
    if ground:
        M = E.fk_eval(st)
        low = min(E.point(M, 'cart', (x, y + TRAIL, WHEEL_R)).z for (x, y) in CASTERS.values()) - WHEEL_R
        st['mat']['cart'] = Matrix.Translation((0, 0, -low)) @ st['mat']['cart']


def wheels(st, turns, swivel=None):
    for c in CASTERS:
        st['fk']['roue' + c] = [('x', 360 * turns)]
        st['fk']['pivot' + c] = [('z', (swivel or {}).get(c, 0.0))]


def hand_on_bar(st, s, M=None, lift=(0, 0, 0)):
    M = M or E.fk_eval(st)
    m = V(1 if s == 'L' else -1, 1, 1)
    T = E.point(M, 'cart', WR * m) + Vector(lift)
    E.ik_arm(st, s, T, E.point(M, 'spine', POLE * m), hand=E.direction(M, 'cart', (HD - WR) * m))


def hands_on_bar(st):
    M = E.fk_eval(st)
    hand_on_bar(st, 'L', M)
    hand_on_bar(st, 'R', M)


def bag(st, d):
    """le sac pend (direction monde d) depuis l'avant-bras gauche"""
    E.aim(st, 'bag', d)


def legs(fk, ph, lift=(26, 26), knee=(45, 45), plant=0.0):
    for (s, o), li, kn in zip((('L', 0.0), ('R', 0.5)), lift, knee):
        w = math.sin(TAU * (ph + o))
        up = max(0.0, math.cos(TAU * (ph + o)))
        fk['thigh' + s] = [('x', -li * w)]
        fk['shin' + s] = [('x', kn * up)]
        fk['foot' + s] = [('x', -12 * up + plant)]


def P(t, **kw):
    st = E.pose(**kw)
    st['scl']['liste'] = 0.02
    return st


def idle(t):
    # elle relit sa liste de courses (en marmonnant), lève les yeux par-dessus ses lunettes, fait « tss tss », reprend
    up = seg(t, 0.05, 0.2) * (1 - seg(t, 0.82, 0.95))
    glare = seg(t, 0.46, 0.52) * (1 - seg(t, 0.66, 0.72))
    fk = {'spine': [('x', 4 + 2 * wave(t))], 'head': [('x', 10 * up * (1 - glare) - 6 * glare), ('z', 9 * glare * wave(t, 6)), ('y', 4 * up)],
          'jaw': [('x', 5 * up * (1 - glare) * hop(t, 9) + 2)], 'skirt': [('x', 1.5 * wave(t))]}
    legs(fk, 0, (0, 0), (0, 0))
    fk['thighR'] = [('x', -6)]
    fk['shinR'] = [('x', 10)]
    st = P(t, fk=fk, root=(0, 0, -0.004 - 0.004 * wave(t, 2)))
    cart_steps(st)
    wheels(st, 0)
    st['scl']['liste'] = 0.02 + 0.98 * seg(t, 0.08, 0.2) * (1 - seg(t, 0.8, 0.9))
    M = E.fk_eval(st)
    hand_on_bar(st, 'L', M)
    m = V(-1, 1, 1)
    bar = E.point(M, 'cart', WR * m)
    read = E.point(M, 'spine', (-0.05, -0.37, 0.93))
    T = path(t, [(0.0, bar), (0.05, bar), (0.2, read), (0.82, read + Vector((0.01, 0, 0.012 * wave(t, 3)))), (0.95, bar), (1.0, bar)])
    T = T + Vector((0, 0, 0.01 * wave(t, 3))) * up
    side = seg(t, 0.03, 0.18) * (1 - seg(t, 0.85, 0.97))
    pole = E.point(M, 'spine', POLE * m).lerp(E.point(M, 'spine', (-0.4, 0.0, 0.62)), side)
    hd = E.direction(M, 'cart', (HD - WR) * m).lerp(Vector((0.05, -0.15, 1.0)), side)
    E.ik_arm(st, 'R', T, pole, hand=hd)
    M = E.fk_eval(st)
    E.set_world_rot(st, 'liste', Matrix.Rotation(math.radians(-12 * side), 3, 'X') @ REST['liste'].to_3x3(), M)
    bag(st, (0.03 * wave(t), 0.04 * wave(t, 1, 0.25), -1))
    return st


def walk(t):
    # elle pousse en clopinant : la jambe droite raide, le corps qui plonge à chaque pas ; une roulette folle
    fk = {'spine': [('x', 12 + 3 * hop(t, 1)), ('y', 4 * wave(t))], 'head': [('x', -8 - 3 * hop(t, 1)), ('z', 5 * wave(t))],
          'jaw': [('x', 2)], 'skirt': [('x', 4 * wave(t, 2)), ('y', 3 * wave(t))]}
    legs(fk, t, lift=(28, 18), knee=(50, 10))
    dip = max(0.0, math.sin(TAU * (t + 0.25)))      # appui sur la mauvaise jambe
    st = P(t, fk=fk, root=(0.012 * wave(t), 0, -0.012 - 0.03 * dip ** 2 + 0.01 * hop(t, 2)))
    st['fk']['root'] = [('y', 5 * dip - 2), ('z', -4 * wave(t))]
    cart_steps(st, [((0, -0.85, 0), (0.5 * wave(t, 4), 0.6 * wave(t, 2), 0))])
    wheels(st, 6 * t, {'AvG': 28 * wave(t, 3), 'AvD': 4 * wave(t, 2)})
    hands_on_bar(st)
    bag(st, (0.08 * wave(t), 0.18 * wave(t, 2, 0.2), -1))
    return st


def run(t):
    # elle charge, penchée sur son caddie comme une furie : petites jambes à toute allure, roulettes qui vibrent
    fk = {'spine': [('x', 34 + 3 * wave(t, 4)), ('y', 4 * wave(t, 2))], 'head': [('x', -30 + 4 * wave(t, 4)), ('z', 4 * wave(t, 2))],
          'jaw': [('x', 10 + 6 * hop(t, 4))], 'skirt': [('x', -14 + 5 * wave(t, 4))]}
    legs(fk, 2 * t, lift=(40, 40), knee=(72, 72))
    st = P(t, fk=fk, root=(0, -0.07, 0.03 * hop(t, 4) - 0.04))
    st['fk']['root'] = [('z', -5 * wave(t, 2))]
    cart_steps(st, [((0, -0.85, 0), (1.5 * wave(t, 5), 1.2 * wave(t, 7, 0.3), 1.0 * wave(t, 3)))], off=(0, -0.08, 0))
    st['mat']['cart'] = Matrix.Translation((0, 0, 0.012 * hop(t, 6))) @ st['mat']['cart']
    wheels(st, 6 * t, {'AvG': 22 * wave(t, 5), 'AvD': 18 * wave(t, 6, 0.3), 'ArG': 14 * wave(t, 7, 0.6), 'ArD': 16 * wave(t, 4)})
    hands_on_bar(st)
    bag(st, (0.15 * wave(t, 2), 0.9, -0.45 + 0.3 * wave(t, 4)))
    return st


def warn(t):
    # elle se cabre en tirant le caddie vers elle (l'avant se lève), puis se jette en avant pour charger
    a = seg(t, 0.0, 0.5) * (1 - seg(t, 0.55, 0.85))
    c = seg(t, 0.55, 0.9)
    fk = {'spine': [('x', 8 - 22 * a + 30 * c)], 'head': [('x', -20 * a - 24 * c)], 'jaw': [('x', 3 + 14 * c)],
          'skirt': [('x', 6 * a - 10 * c)]}
    for s, sg in (('L', 1), ('R', -1)):
        fk['thigh' + s] = [('x', -16 * a - 30 * c * (1 if s == 'L' else 0.3))]
        fk['shin' + s] = [('x', 24 * a + 40 * c * (1 if s == 'L' else 0.3))]
        fk['foot' + s] = [('x', -8 * a - 12 * c)]
    st = P(t, fk=fk, root=(0, 0.07 * a - 0.05 * c, 0.02 * a - 0.04 * c))
    back = 0.18 * a - 0.06 * c
    cart_steps(st, [((0, CASTERS['ArG'][1] + TRAIL, 0), (-12 * a, 0, 0))], off=(0, back, 0))
    wheels(st, -back / (TAU * WHEEL_R))
    hands_on_bar(st)
    bag(st, (0, -0.4 * a + 0.6 * c, -1))
    return st


def hit(t):
    # elle brandit le poing gauche en hurlant, le sac à main tourne autour du bras, elle tape du pied
    sh = wave(t, 6)
    stamp = hop(t, 3)
    fk = {'spine': [('x', -4 + 2 * sh), ('y', -6)], 'head': [('x', -12 + 3 * sh), ('z', 10 * wave(t, 3))],
          'jaw': [('x', 6 + 12 * hop(t, 5))], 'skirt': [('x', 3 * sh)]}
    legs(fk, 0, (0, 0), (0, 0))
    fk['thighR'] = [('x', -24 * stamp)]
    fk['shinR'] = [('x', 30 * stamp)]
    fk['footR'] = [('x', -10 * stamp)]
    st = P(t, fk=fk, root=(0, 0.02, 0.01 * stamp))
    knock = max(0.0, 1 - stamp / 0.15)
    cart_steps(st, [((0, -0.85, 0), (0.8 * knock, 0, 0))])
    wheels(st, 0)
    M = E.fk_eval(st)
    hand_on_bar(st, 'R', M)
    fist = E.point(M, 'spine', (0.2, -0.22, 1.3)) + Vector((0.035 * wave(t, 6), 0.02 * wave(t, 6, 0.25), 0.03 * hop(t, 6)))
    E.ik_arm(st, 'L', fist, E.point(M, 'spine', (0.6, 0.1, 0.9)), hand=Vector((0, -0.2, 1)))
    M = E.fk_eval(st)
    f = E.direction(M, 'forearmL', (WR - EL))
    p1 = f.cross(Vector((0, 0, 1)))
    p1 = p1.normalized() if p1.length > 1e-3 else Vector((1, 0, 0))
    p2 = f.cross(p1).normalized()
    th = TAU * 2 * t
    bag(st, (p1 * math.cos(th) + p2 * math.sin(th)) * 0.9 - f * 0.35)
    return st


def dance(t):
    # petit twist de mamie : les hanches tournent d'un côté, les épaules de l'autre, genoux serrés, coudes au corps,
    # elle descend un peu en se dandinant (2 temps par boucle) ; le caddie attend sagement
    tw = wave(t, 2)
    b = hop(t, 2)
    fk = {'spine': [('z', -16 * tw), ('x', 8), ('y', 4 * wave(t, 1))], 'head': [('z', 8 * tw), ('y', 8 * wave(t, 2, 0.25)), ('x', -4)],
          'jaw': [('x', 6)], 'skirt': [('z', -14 * wave(t, 2, 0.12)), ('x', 3)]}
    for s, sg in (('L', 1), ('R', -1)):
        fk['thigh' + s] = [('x', -24 - 6 * (1 - b)), ('y', -5 * sg)]
        fk['shin' + s] = [('x', 40 + 10 * (1 - b))]
        fk['foot' + s] = [('x', -14), ('z', -22 * tw)]
    st = P(t, fk=fk, root=(0.02 * tw, 0.04, -0.06 - 0.03 * (1 - b)))
    st['fk']['root'] = [('z', 24 * tw)]
    cart_steps(st, [((0, -0.2, 0), (0, 0, 38))], off=(0.12, 0.05, 0))
    wheels(st, 0)
    M = E.fk_eval(st)
    for s, sg in (('L', 1), ('R', -1)):
        T = E.point(M, 'spine', (sg * 0.27, -0.24, 0.72 + 0.03 * wave(t, 4))) + Vector((0.05 * -tw, 0, 0))
        E.ik_arm(st, s, T, E.point(M, 'spine', (sg * 0.5, 0.15, 0.62)), hand=Vector((-0.4 * sg, -1, 0.3)))
    bag(st, (0.25 * wave(t, 2, 0.1), 0.1, -1))
    return st


MOV = ['cart', 'liste']
E.bake([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 20, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)], MOV)

K.log('triangles : corps', E.tris([BODY, ARMS]), 'total', E.tris())
E.tris_report()

K.preview([
    ('face', 'Idle', 0, (0.3, -4.0, 1.1), (0, -0.5, 0.65)),
    ('troisquarts', 'Idle', 0, (2.8, -3.0, 1.8), (0, -0.5, 0.6)),
    ('jeu', 'Walk', 0, (2.5, -3.3, 3.4), (0, -0.5, 0.5)),
    ('visage', 'Idle', 0, (0.35, -1.55, 1.2), (0, -0.12, 1.02)),
    ('liste', 'Idle', 34, (1.0, -2.6, 1.3), (0, -0.25, 0.85)),
    ('marche', 'Walk', 6, (3.4, -1.6, 1.1), (0, -0.5, 0.6)),
    ('course', 'Run', 5, (3.4, -1.2, 1.0), (0, -0.55, 0.55)),
    ('alerte', 'Warn', 7, (2.6, -2.4, 1.2), (0, -0.45, 0.6)),
    ('alerte2', 'Warn', 16, (2.6, -2.4, 1.2), (0, -0.45, 0.6)),
    ('poing', 'Hit', 9, (1.4, -3.2, 1.3), (0, -0.3, 0.8)),
    ('twist', 'Dance', 8, (0.4, -3.4, 1.2), (0, -0.25, 0.65)),
    ('twist2', 'Dance', 20, (-1.5, -2.8, 2.6), (0, -0.25, 0.55)),
])
K.export()
E.cleanup()
