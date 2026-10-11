# L'homme à la tondeuse : banlieusard bedonnant en marcel taché, bermuda à carreaux, chaussettes hautes et sandales,
# casquette de camionneur, grosse moustache, lunettes de soleil sur le nez (il regarde par-dessus). Il pousse devant lui
# (côté -Y) une grosse tondeuse rouge pétaradante : la lame tourne sous le carter, un petit pot d'échappement fume.
#   Blender -b -P tools/blender/terriens/mower.py -- public/models/terriens/mower.glb [dossier_aperçus]
# Clips : Idle (s'essuie le front, la tondeuse tremble), Walk (pousse tranquillement), Run (fonce penché, la tondeuse
# saute, rictus), Warn (tire sur le lanceur, le moteur rugit), Hit (ricane en tapotant le guidon),
# Dance (air guitar avec le guidon, la tondeuse cabrée).
# Pièces nommées : Tondeuse (carter), Moteur, Lame, RoueAvG/RoueAvD/RoueArG/RoueArD, Echappement, Fumee, Lanceur, Cordon,
# Guidon, Casquette, Lunettes. Os dédiés : mower (l'engin), lame, roueAv, roueAr, smoke, cord, cordgrip, belly, jaw, cap.
import os
import sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, '..')]
import math
import numpy as np
from mathutils import Vector, Matrix, Euler
import kit as K
import engin as E
from kit import V, ell, cone, rbox, srgb

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/mower.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('mower', OUT, PREVIEW)
E.private_work('mower')

# --- proportions ---------------------------------------------------------------------------------------------
HIP_Z = 0.56
SH = V(0.25, -0.01, 1.05)            # épaule gauche
L1, L2 = 0.25, 0.23                   # bras, avant-bras
GRIP = V(0.2, -0.47, 0.84)            # le poing gauche serre le guidon ici
WR = V(0.205, -0.41, 0.875)           # poignet au repos (sur le guidon)
POLE = V(0.38, 0.25, 0.7)             # les coudes partent en dehors, en arrière


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
WR = SH + (WR - SH) / np.linalg.norm(WR - SH) * min(np.linalg.norm(WR - SH), L1 + L2 - 0.004)
HD = GRIP + (GRIP - WR) / np.linalg.norm(GRIP - WR) * 0.035
LEG = {'L': V(0.13, 0.0, 0), 'R': V(-0.13, 0.0, 0)}
KNEE_Z, ANKLE_Z = 0.30, 0.085
HEAD_C = V(0, -0.05, 1.31)
MOUTH_C, MOUTH_R = V(0, -0.235, 1.163), V(0.075, 0.06, 0.026)

# la tondeuse
YM = -1.0                             # centre du carter
DECK_C = V(0, YM, 0.2)
AX_F, AX_R, WHEEL_R, WHEEL_X = YM - 0.22, YM + 0.22, 0.1, 0.345
BAR_Y, BAR_Z = GRIP[1], GRIP[2]
TUBE_LO = V(0.25, YM + 0.29, 0.27)    # pied du guidon (gauche), sur le carter
TUBE_HI = V(0.25, BAR_Y + 0.01, BAR_Z - 0.02)
PULLEY = V(0.0, YM + 0.14, 0.45)
CGRIP = TUBE_HI + (TUBE_LO - TUBE_HI) * 0.22 + V(0.035, 0, 0)
CGRIP = CGRIP * V(-1, 1, 1)           # sur le tube droit
PIPE = V(-0.19, YM + 0.17, 0.43)       # sortie du pot d'échappement

body = [
    # le ventre, énorme, et le torse
    ell('belly', (0, -0.08, 0.78), (0.3, 0.3, 0.31), k=0.06),
    ell('chest', (0, 0.0, 0.99), (0.25, 0.19, 0.17), k=0.06),
    ell('shoulder', (0.18, 0.0, 1.04), (0.1, 0.1, 0.075), k=0.05),
    ell('shoulder', (-0.18, 0.0, 1.04), (0.1, 0.1, 0.075), k=0.05),
    cone('neck', (0, 0.01, 1.04), (0, -0.03, 1.2), 0.1, 0.095, k=0.04),
    # la tête : bajoues, double menton, gros nez rouge, oreilles
    ell('head', tuple(HEAD_C), (0.215, 0.205, 0.215), k=0.04),
    ell('jowl', (0, -0.11, 1.19), (0.165, 0.13, 0.085), k=0.05),
    ell('chin', (0, -0.165, 1.12), (0.09, 0.07, 0.05), k=0.03),
    ell('nose', (0, -0.275, 1.285), (0.06, 0.06, 0.055), k=0.025),
    ell('ear', (0.21, -0.03, 1.29), (0.035, 0.05, 0.06), k=0.02),
    ell('ear', (-0.21, -0.03, 1.29), (0.035, 0.05, 0.06), k=0.02),
    # moustache de morse, tombante
    ell('mous', (0, -0.25, 1.215), (0.13, 0.045, 0.036), k=0.02),
    ell('mous', (0.115, -0.23, 1.18), (0.042, 0.035, 0.055), k=0.02, R=K.rot(0, 22, 0)),
    ell('mous', (-0.115, -0.23, 1.18), (0.042, 0.035, 0.055), k=0.02, R=K.rot(0, -22, 0)),
    # sourcils broussailleux, cheveux qui dépassent de la casquette
    ell('brow', (0.085, -0.212, 1.428), (0.058, 0.024, 0.021), k=0.015, R=K.rot(0, -12, 0)),
    ell('brow', (-0.085, -0.212, 1.428), (0.058, 0.024, 0.021), k=0.015, R=K.rot(0, 12, 0)),
    ell('hair', (0.2, 0.04, 1.33), (0.05, 0.1, 0.07), k=0.03),
    ell('hair', (-0.2, 0.04, 1.33), (0.05, 0.1, 0.07), k=0.03),
    ell('hair', (0, 0.16, 1.31), (0.15, 0.07, 0.08), k=0.04),
    # la bouche, creusée sous la moustache
    ell('mouth', tuple(MOUTH_C), tuple(MOUTH_R), k=0.012, op='sub'),
    # bermuda : bassin et jambes larges jusqu'au-dessus du genou
    ell('shorts', (0, 0.02, 0.56), (0.26, 0.22, 0.13), k=0.05),
]
for s, b in LEG.items():
    body.append(cone('shortleg', tuple(b * V(0.92, 1, 1) + V(0, 0, HIP_Z)), tuple(b + V(0.005, -0.01, 0.37)), 0.12, 0.105, k=0.04))
    body.append(cone('leg', tuple(b + V(0.005, -0.01, 0.42)), tuple(b + V(0.005, -0.02, KNEE_Z)), 0.055, 0.05, k=0.02))
    body.append(cone('leg', tuple(b + V(0.005, -0.02, KNEE_Z)), tuple(b + V(0.005, 0, ANKLE_Z)), 0.05, 0.044, k=0.02))
    body.append(ell('foot', tuple(b + V(0.005, -0.065, 0.05)), (0.07, 0.13, 0.05), k=0.03))

SKIN, BURN = srgb('#f2b48c'), srgb('#f08a72')
MARCEL = srgb('#f4eedb')
COL = {'default': MARCEL, 'belly': MARCEL, 'chest': MARCEL, 'shoulder': MARCEL, 'neck': BURN, 'head': SKIN, 'jowl': SKIN,
       'chin': SKIN, 'nose': srgb('#f0786a'), 'ear': srgb('#f09a80'), 'mous': srgb('#5a3420'), 'brow': srgb('#5a3420'),
       'hair': srgb('#6a4630'), 'shorts': srgb('#3a8ad8'), 'shortleg': srgb('#3a8ad8'), 'leg': SKIN, 'foot': srgb('#f8f8f2'),
       'mouth': srgb('#5a1018')}


def hash01(co, k=1.0):
    h = np.sin(co[:, 0] * 127.1 * k + co[:, 1] * 311.7 * k + co[:, 2] * 74.7 * k) * 43758.5453
    return h - np.floor(h)


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    torso = np.isin(tag, ('belly', 'chest', 'shoulder'))
    # bouche : intérieur sombre, langue
    q = (co - MOUTH_C) / MOUTH_R
    inside = (np.linalg.norm(q, axis=1) < 1.4) & np.isin(tag, ('head', 'jowl', 'chin'))
    col[inside] = srgb('#5a1018')
    col[inside & (q[:, 2] < -0.25)] = srgb('#c8505a')
    # marcel : grande encolure (touffe de poils), bretelles, emmanchures profondes
    inner = 0.09 + 0.5 * np.maximum(z - 0.97, 0)
    front = y < -0.02
    scoop = torso & (z > 0.97) & (ax < inner) & (front | (z > 1.06))
    col[scoop] = srgb('#f4a888')
    tuft = scoop & front & (z < 1.06) & (ax < 0.05 + 0.4 * (z - 0.97))
    col[tuft] = srgb('#6a4026')
    arm_hole = torso & (((z > 0.97) & (ax > inner + 0.07)) | ((z > 0.86) & (ax > 0.22 + (0.97 - z) * 0.6)))
    col[arm_hole] = BURN
    # marcel trop court : une bande de ventre nu avec le nombril, puis le bermuda sous la bedaine
    bare = torso & (z < 0.67) & (z > 0.585) & (y < -0.1)
    col[bare] = SKIN
    navel = torso & (np.hypot(x, z - 0.63) < 0.02) & (y < -0.25)
    col[navel] = srgb('#b0604c')
    col[torso & (z <= 0.585)] = srgb('#3a8ad8')
    belt = np.isin(tag, ('belly', 'chest', 'shoulder', 'shorts')) & (z > 0.56) & (z < 0.6) & (y > -0.12)
    col[belt] = srgb('#5a3420')
    # taches : une grande auréole de graisse, du ketchup, du cambouis ; auréoles sous les bras
    for (cx, cz, r, c) in ((0.08, 0.79, 0.08, '#dcc27a'), (-0.11, 0.86, 0.045, '#d8402e'), (-0.06, 0.71, 0.04, '#8a7050')):
        m = torso & (y < -0.1) & ~scoop & ~bare & ~arm_hole & (np.hypot(x - cx, (z - cz) * 1.2) < r)
        col[m] = 0.2 * col[m] + 0.8 * srgb(c)
    # bermuda à carreaux
    sh = np.isin(tag, ('shorts', 'shortleg')) | (torso & (z <= 0.585))
    u = ((x + 1) % 0.11) < 0.035
    w = ((z + 1) % 0.11) < 0.035
    col[sh & (u ^ w)] = srgb('#2a64b8')
    col[sh & u & w] = srgb('#1a4488')
    # chaussettes hautes à rayures, sandales
    leg = tag == 'leg'
    col[leg & (z < 0.27)] = srgb('#f8f8f2')
    col[leg & (z > 0.23) & (z < 0.252)] = srgb('#e8334a')
    col[leg & (z > 0.198) & (z < 0.218)] = srgb('#3a5fbf')
    foot = tag == 'foot'
    fy = y + 0.065
    col[foot & (z < 0.03)] = srgb('#4a2c18')
    col[foot & (z < 0.065) & (np.abs(fy + 0.05) < 0.02)] = srgb('#7a4a24')
    col[foot & (z < 0.075) & (np.abs(fy - 0.03) < 0.018)] = srgb('#7a4a24')
    # visage : joues, barbe de trois jours, coup de soleil sur la nuque
    face = np.isin(tag, ('head', 'jowl', 'chin')) & ~inside
    cheek = face & (np.abs(ax - 0.13) < 0.05) & (np.abs(z - 1.25) < 0.04) & (y < -0.12)
    col[cheek] = srgb('#f2967a')
    stub = np.isin(tag, ('jowl', 'chin')) & ~inside & (y < -0.05) & (z < 1.2)
    col[stub] = 0.7 * col[stub] + 0.3 * srgb('#8a7a8a')
    nape = np.isin(tag, ('head', 'neck', 'jowl')) & (y > 0.05) & (z < 1.22)
    col[nape] = BURN


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.42, -0.45, 0.0), (0.42, 0.36, 1.56), vox=0.0055)
K.decimate(BODY, 7300)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Banlieusard', rough=0.55))

# --- les bras nus (maillage à part : ils passent tout près du ventre) -------------------------------------------
arms = []
for sx in (1, -1):
    m = V(sx, 1, 1)
    arms += [ell('arm', tuple((SH + V(-0.02, 0, 0)) * m), (0.085, 0.085, 0.085), k=0.04),
             cone('arm', tuple(SH * m), tuple(EL * m), 0.078, 0.062, k=0.03),
             cone('fore', tuple(EL * m), tuple(WR * m), 0.062, 0.05, k=0.025),
             ell('fist', tuple(GRIP * m), (0.052, 0.058, 0.05), k=0.03),
             ell('fist', tuple((GRIP + V(-0.03, 0.015, 0.035)) * m), (0.022, 0.03, 0.02), k=0.015)]
ACOL = {'default': SKIN, 'arm': SKIN, 'fore': SKIN, 'fist': srgb('#f2a882')}


def arm_extra(co, nor, col, tag):
    x, z = co[:, 0], co[:, 2]
    top = (tag == 'arm') & (nor[:, 2] > 0.3)
    col[top] = 0.5 * col[top] + 0.5 * BURN
    # tatouage (un cœur bleu) sur le bras gauche
    tat = (tag == 'arm') & (x > 0.29) & (np.hypot(co[:, 1] - (SH[1] + EL[1]) / 2, z - (SH[2] + EL[2]) / 2 - 0.01) < 0.03)
    col[tat] = srgb('#3a5fbf')


lo = np.minimum(SH, np.minimum(EL, GRIP)) * V(1, 1, 1) - 0.12
hi = np.maximum(SH, np.maximum(EL, GRIP)) + 0.12
ARMS = K.sdf_mesh('Bras', arms, (-hi[0], lo[1], lo[2]), (hi[0], hi[1], hi[2]), vox=0.005)
K.decimate(ARMS, 1300)
ACO, ATAG = K.paint(ARMS, arms, ACOL, arm_extra)
ARMS.data.materials.append(K.vc_material('Bras', rough=0.55))

# --- accessoires de la tête -----------------------------------------------------------------------------------------
EYE_L = (0.082, -0.205, 1.345)
EYES = E.eyes(EYE_L, 0.062, pupil_dir=(0, -1, 0.3), pupil_r=0.46, seg=14)
# lunettes de soleil sur le bout du nez : il regarde par-dessus
glass = K.mat('Verre', '#2a1f4a', rough=0.05, metal=0.3)
gold = K.mat('Or', '#e8b830', rough=0.25, metal=0.8)
LENS_Z, LENS_Y = 1.272, -0.293
specs = []
for sx in (1, -1):
    specs.append(K.sphere('Verre' + ('G' if sx > 0 else 'D'), (sx * 0.085, LENS_Y, LENS_Z), 0.058, glass, scale=(1, 0.28, 0.76), seg=12))
    fr = K.torus('Monture' + ('G' if sx > 0 else 'D'), (sx * 0.085, LENS_Y, LENS_Z), 0.058, 0.008, gold, rot_deg=(90, 0, 0), seg=12)
    fr.scale = (1, 1, 0.76)
    K.activate(fr)
    import bpy
    bpy.ops.object.transform_apply(scale=True)
    specs.append(fr)
    specs.append(K.cylinder('Branche' + ('G' if sx > 0 else 'D'), (sx * 0.142, LENS_Y + 0.01, LENS_Z + 0.01), (sx * 0.212, -0.05, 1.3), 0.007, gold, seg=5))
specs.append(K.cylinder('Pont', (0.03, LENS_Y - 0.012, LENS_Z + 0.012), (-0.03, LENS_Y - 0.012, LENS_Z + 0.012), 0.007, gold, seg=6))
TEETH = [K.box('DentsHaut', (0, -0.245, 1.178), (0.11, 0.03, 0.024), K.mat('Dents', '#fffbe8', rough=0.2), bevel=0.005)]
TEETH.append(K.box('Trou', (0.022, -0.259, 1.178), (0.02, 0.006, 0.025), K.mat('Fente', '#3a1018')))      # une dent en moins
LOWER = [K.box('DentsBas', (0, -0.238, 1.146), (0.095, 0.03, 0.018), K.mat('Dents', '#fffbe8', rough=0.2), bevel=0.004)]

# casquette de camionneur : devant blanc, filet rouge, visière relevée
CAP_P = [
    ell('crown', (0, 0.01, 1.40), (0.232, 0.226, 0.165), k=0.01),
    rbox('cut', (0, 0.0, 1.10), (0.5, 0.5, 0.3), r=0.01, k=0.006, R=K.rot(-14, 0, 0), op='sub'),
    ell('brim', (0, -0.262, 1.468), (0.17, 0.125, 0.012), k=0.012, R=K.rot(-28, 0, 0)),
    ell('button', (0, 0.01, 1.565), (0.024, 0.024, 0.014), k=0.008),
]
CCOL = {'default': srgb('#e8334a'), 'crown': srgb('#e8334a'), 'brim': srgb('#e8334a'), 'button': srgb('#e8334a')}


def cap_extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    panel = (tag == 'crown') & (nor[:, 1] < -0.45) & (z > 1.43)
    col[panel] = srgb('#f6f6f2')
    badge = panel & (np.hypot(x, z - 1.49) < 0.05) & (y < -0.12)
    col[badge] = srgb('#2f9a4a')
    col[badge & (np.hypot(x, z - 1.49) < 0.022)] = srgb('#ffd23f')
    under = (tag == 'brim') & (nor[:, 2] < -0.3)
    col[under] = srgb('#a01a30')
    seam = (tag == 'crown') & ~panel & (np.abs(x) < 0.008)
    col[seam] = srgb('#c8203a')


CAP = K.sdf_mesh('Casquette', CAP_P, (-0.26, -0.42, 1.3), (0.26, 0.26, 1.6), vox=0.0045)
K.decimate(CAP, 800, symmetric=True)
K.paint(CAP, CAP_P, CCOL, cap_extra)
CAP.data.materials.append(K.vc_material('Casquette', rough=0.6))

# --- la tondeuse ------------------------------------------------------------------------------------------------------
DK = [
    rbox('deck', tuple(DECK_C), (0.3, 0.3, 0.075), r=0.06, k=0.02),
    ell('deck', (0, YM, 0.25), (0.27, 0.27, 0.065), k=0.04),
    rbox('skirt', (0, YM, 0.125), (0.315, 0.315, 0.02), r=0.02, k=0.02),
    rbox('cut', (0, YM, 0.12), (0.275, 0.275, 0.075), r=0.03, k=0.01, op='sub'),
    # supports du guidon, à l'arrière
    rbox('bracket', (0.25, YM + 0.29, 0.25), (0.035, 0.03, 0.05), r=0.01, k=0.01),
    rbox('bracket', (-0.25, YM + 0.29, 0.25), (0.035, 0.03, 0.05), r=0.01, k=0.01),
    # bec de rejet sur le côté droit
    rbox('chute', (-0.3, YM + 0.05, 0.17), (0.06, 0.1, 0.04), r=0.02, k=0.03),
]
DCOL = {'default': srgb('#d8282c'), 'deck': srgb('#d8282c'), 'skirt': srgb('#b01c22'), 'bracket': srgb('#3a3550'),
        'chute': srgb('#2a2440')}


def deck_extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    stripe = (tag == 'deck') & (np.abs(np.abs(x) - 0.2) < 0.018) & (nor[:, 2] > 0.5)
    col[stripe] = srgb('#ffd23f')
    under = nor[:, 2] < -0.5
    col[under & (tag == 'deck')] = srgb('#3a1418')


DECK = K.sdf_mesh('Tondeuse', DK, (-0.4, YM - 0.36, 0.06), (0.4, YM + 0.36, 0.34), vox=0.006)
K.decimate(DECK, 1100, symmetric=False)
K.paint(DECK, DK, DCOL, deck_extra)
DECK.data.materials.append(K.vc_material('Tondeuse', rough=0.35))

MO = [
    cone('block', (0, YM + 0.02, 0.26), (0, YM + 0.02, 0.4), 0.125, 0.115, k=0.02),
    ell('cover', (0, YM + 0.02, 0.43), (0.135, 0.135, 0.06), k=0.03),
    cone('pulley', tuple(PULLEY + V(0, -0.02, -0.02)), tuple(PULLEY + V(0, 0.02, 0.01)), 0.055, 0.05, k=0.01),
    rbox('filter', (0.13, YM - 0.02, 0.36), (0.05, 0.07, 0.05), r=0.015, k=0.02),
    cone('cap', (-0.05, YM - 0.06, 0.46), (-0.05, YM - 0.06, 0.5), 0.028, 0.026, k=0.006),
    cone('plug', (0, YM - 0.12, 0.33), (0, YM - 0.17, 0.35), 0.016, 0.012, k=0.006),
]
MCOL = {'default': srgb('#8a8ca0'), 'block': srgb('#a8acc0'), 'cover': srgb('#2a2434'), 'pulley': srgb('#3a3448'),
        'filter': srgb('#1e1a28'), 'cap': srgb('#ffd23f'), 'plug': srgb('#e8eef8')}


def motor_extra(co, nor, col, tag):
    fins = (tag == 'block') & (((co[:, 2] * 70).astype(int)) % 2 == 0)
    col[fins] = srgb('#7a7c90')
    band = (tag == 'cover') & (np.abs(co[:, 2] - 0.425) < 0.014)
    col[band] = srgb('#ffd23f')


MOTOR = K.sdf_mesh('Moteur', MO, (-0.2, YM - 0.22, 0.2), (0.22, YM + 0.24, 0.53), vox=0.005)
K.decimate(MOTOR, 750, symmetric=False)
K.paint(MOTOR, MO, MCOL, motor_extra)
MOTOR.data.materials.append(K.vc_material('Moteur', rough=0.4))

chrome = K.mat('Chrome', '#c8d0e0', rough=0.2, metal=0.9)
black = K.mat('Caoutchouc', '#1a1624', rough=0.8)
MUFF = [K.cylinder('Echappement', (-0.13, YM + 0.12, 0.34), (-0.2, YM + 0.12, 0.36), 0.045, chrome, seg=10),
        K.cylinder('Echappement2', (-0.19, YM + 0.12, 0.36), tuple(PIPE), 0.017, chrome, seg=8)]
# guidon : deux tubes, la barre, poignées en mousse noire, manette des gaz
HANDLE = []
for sx in (1, -1):
    m = V(sx, 1, 1)
    HANDLE.append(K.cylinder('Tube' + ('G' if sx > 0 else 'D'), tuple(TUBE_LO * m), tuple(TUBE_HI * m), 0.017, chrome, seg=8))
    HANDLE.append(K.sphere('Coude' + ('G' if sx > 0 else 'D'), tuple(TUBE_HI * m + V(0, -0.003, 0.01)), 0.019, chrome, seg=8))
HANDLE.append(K.cylinder('Guidon', (0.26, BAR_Y, BAR_Z), (-0.26, BAR_Y, BAR_Z), 0.018, chrome, seg=8))
for sx in (1, -1):
    HANDLE.append(K.cylinder('Mousse' + ('G' if sx > 0 else 'D'), (sx * 0.12, BAR_Y, BAR_Z), (sx * 0.25, BAR_Y, BAR_Z), 0.026, black, seg=8))
HANDLE.append(K.box('Manette', (0.25, TUBE_HI[1] - 0.06, TUBE_HI[2] - 0.11), (0.03, 0.05, 0.035), K.mat('Rouge', '#e8334a'), bevel=0.006))
# roues : pneu noir, jante jaune hexagonale (on la voit tourner)
WHEELS = {'roueAv': [], 'roueAr': []}
for bn, yy in (('roueAv', AX_F), ('roueAr', AX_R)):
    for sx in (1, -1):
        n = ('RoueAv' if bn == 'roueAv' else 'RoueAr') + ('G' if sx > 0 else 'D')
        c = (sx * WHEEL_X, yy, WHEEL_R)
        WHEELS[bn].append(K.torus(n, c, WHEEL_R - 0.028, 0.03, black, rot_deg=(0, 90, 0), seg=12))
        WHEELS[bn].append(K.cylinder(n + 'Jante', (sx * (WHEEL_X - 0.022), yy, WHEEL_R), (sx * (WHEEL_X + 0.022), yy, WHEEL_R), 0.058,
                                     K.mat('Jante', '#ffd23f', rough=0.4), seg=6, smooth=False))
        WHEELS[bn].append(K.box(n + 'Boulon', (sx * (WHEEL_X + 0.024), yy, WHEEL_R + 0.03), (0.01, 0.022, 0.022), K.mat('Boulon', '#3a3550')))
# la lame sous le carter
steel = K.mat('Metal', '#d8e0ee', rough=0.15, metal=1.0)
BLADE = [K.box('Lame', (0, YM, 0.15), (0.5, 0.06, 0.012), steel), K.cylinder('LameMoyeu', (0, YM, 0.14), (0, YM, 0.2), 0.035, chrome, seg=10)]
for sx in (1, -1):
    BLADE.append(K.box('LameAilette' + ('G' if sx > 0 else 'D'), (sx * 0.22, YM + sx * 0.02, 0.158), (0.06, 0.02, 0.02), steel, rot_deg=(sx * 30, 0, 0)))
# le lanceur à corde : poignée en T sur le tube droit, cordon jusqu'au moteur
CORD = K.cylinder('Cordon', tuple(PULLEY), tuple(CGRIP), 0.006, K.mat('Cordon', '#f4eedb', rough=0.8), seg=5)
LANCEUR = K.cylinder('Lanceur', tuple(CGRIP + V(0.04, 0, 0)), tuple(CGRIP + V(-0.04, 0, 0)), 0.017, black, seg=8)
# la fumée : trois boules grises qui gonflent et montent
smoke_m = K.mat('Fumee', '#b8b4c8', rough=0.9, alpha=0.8)
SMOKE = [K.sphere('Fumee', tuple(PIPE + V(-0.02, 0.03, 0.07)), 0.05, smoke_m, seg=10),
         K.sphere('Fumee2', tuple(PIPE + V(-0.05, 0.06, 0.12)), 0.04, smoke_m, seg=10),
         K.sphere('Fumee3', tuple(PIPE + V(0.01, 0.07, 0.15)), 0.033, smoke_m, seg=8)]

# --- squelette ------------------------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, HIP_Z + 0.2))
K.bone('spine', (0, 0, HIP_Z + 0.2), (0, 0, 1.12), 'root', True)
K.bone('head', (0, 0, 1.12), (0, 0, 1.6), 'spine', True)
K.bone('jaw', (0, -0.06, 1.22), (0, -0.21, 1.13), 'head')
K.bone('cap', (0, 0.16, 1.42), (0, -0.12, 1.5), 'head')
K.bone('belly', (0, -0.12, 0.78), (0, -0.32, 0.78), 'root')
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b * V(0.92, 1, 1) + V(0, 0, HIP_Z), b + V(0.005, -0.02, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0.005, -0.02, KNEE_Z), b + V(0.005, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0.005, 0, ANKLE_Z), b + V(0.005, -0.17, 0.03), 'shin' + s, True)
K.bone('mower', (0, YM, 0.12), (0, YM + 0.3, 0.12))
K.bone('lame', (0, YM, 0.17), (0, YM, 0.07), 'mower')
K.bone('roueAv', (0, AX_F, WHEEL_R), (0.12, AX_F, WHEEL_R), 'mower')
K.bone('roueAr', (0, AX_R, WHEEL_R), (0.12, AX_R, WHEEL_R), 'mower')
K.bone('smoke', tuple(PIPE), tuple(PIPE + V(0, 0, 0.12)), 'mower')
K.bone('cord', tuple(PULLEY), tuple(CGRIP), 'mower')
K.bone('cordgrip', tuple(CGRIP), tuple(CGRIP + (CGRIP - PULLEY) / np.linalg.norm(CGRIP - PULLEY) * 0.06), 'mower')
K.rig_end()
CORD_LEN = float(np.linalg.norm(CGRIP - PULLEY))


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'nose', 'ear', 'hair', 'brow', 'mous'):
        return ['head']
    if tg == 'chin':
        return ['jaw', 'head']
    if tg == 'jowl':
        return ['head', 'jaw'] if (p[1] < -0.14 and p[2] < 1.17) else ['head', 'spine']
    if tg == 'neck':
        return ['spine', 'head']
    if tg in ('chest', 'shoulder'):
        return ['spine']
    if tg == 'belly':
        return ['root', 'spine', 'belly'] if p[2] > 0.62 else ['root', 'belly']
    if tg == 'shorts':
        return ['root'] + (['thigh' + s] if abs(p[0]) > 0.08 and p[2] < 0.56 else [])
    if tg == 'shortleg':
        return ['root', 'thigh' + s] if p[2] > 0.5 else ['thigh' + s]
    if tg == 'leg':
        return ['thigh' + s, 'shin' + s] if p[2] > ANKLE_Z + 0.04 else ['shin' + s, 'foot' + s]
    if tg == 'foot':
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


def arm_allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg == 'arm':
        return ['spine', 'arm' + s] if np.linalg.norm(p - SH * V(1 if s == 'L' else -1, 1, 1)) < 0.06 else ['arm' + s, 'forearm' + s]
    if tg == 'fore':
        return ['arm' + s, 'forearm' + s]
    return ['forearm' + s, 'hand' + s]


K.skin(BODY, CO, TAG, allowed)
K.skin(ARMS, ACO, ATAG, arm_allowed, smooth=3)
for o in EYES + specs + TEETH:
    K.attach(o, 'head')
for o in LOWER:
    K.attach(o, 'jaw')
K.attach(CAP, 'cap')
for o in [DECK, MOTOR] + MUFF + HANDLE:
    K.attach(o, 'mower')
for bn, obs in WHEELS.items():
    for o in obs:
        K.attach(o, bn)
for o in BLADE:
    K.attach(o, 'lame')
for o in SMOKE:
    K.attach(o, 'smoke')
K.attach(CORD, 'cord')
K.attach(LANCEUR, 'cordgrip')

# --- animations ---------------------------------------------------------------------------------------------------------
TAU = math.tau
wave, hop, seg, path = K.wave, K.hop, E.seg, E.path
REST = K.S['REST']


def mower_at(st, off=(0, 0, 0), rx=0.0, ry=0.0, rz=0.0, piv=(0, YM, 0.0)):
    piv = Vector(tuple(piv))
    R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix().to_4x4()
    st['mat']['mower'] = Matrix.Translation(Vector(tuple(off)) + piv) @ R @ Matrix.Translation(-piv) @ REST['mower']


def run_motor(st, t, blade, wheels=0, puffs=2, big=1.0):
    st['fk']['lame'] = [('z', 360 * blade * t)]
    st['fk']['roueAv'] = [('x', 360 * wheels * t)]
    st['fk']['roueAr'] = [('x', 360 * wheels * t)]
    p = (puffs * t) % 1.0
    st['scl']['smoke'] = max(0.02, math.sin(math.pi * p) ** 0.8 * big)
    st['loc']['smoke'] = (0.02 * p, 0.05 * p, 0.12 * p)


def hand_on_bar(st, s, M=None, lift=(0, 0, 0)):
    """poignet posé sur le guidon (là où il est au repos), qui suit la tondeuse"""
    M = M or E.fk_eval(st)
    m = V(1 if s == 'L' else -1, 1, 1)
    T = E.point(M, 'mower', WR * m) + Vector(lift)
    hd = E.direction(M, 'mower', (HD - WR) * m)
    pole = E.point(M, 'spine', POLE * m)
    E.ik_arm(st, s, T, pole, hand=hd)


def hands_on_bar(st):
    M = E.fk_eval(st)
    hand_on_bar(st, 'L', M)
    hand_on_bar(st, 'R', M)


def legs(fk, ph, lift=30, knee=50, plant=0.0, spread=0.0):
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(TAU * (ph + o))
        up = max(0.0, math.cos(TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w), ('y', spread * (1 if s == 'L' else -1))]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -12 * up + plant)]


def belly(st, amp, n, ph=0.0):
    j = math.sin(TAU * (n * 1.0 * st['_t'] + ph))
    st['loc']['belly'] = (0, 0, amp * j)
    st['scl']['belly'] = (1 + 0.6 * amp * j, 1, 1 - 0.8 * amp * j)


def P(t, **kw):
    st = E.pose(**kw)
    st['_t'] = t
    return st


def idle(t):
    # il souffle, s'essuie le front du revers du poignet, secoue la sueur, reprend le guidon ; le moteur tourne au ralenti
    wipe = seg(t, 0.22, 0.32) * (1 - seg(t, 0.62, 0.72))
    fk = {'spine': [('x', 3 + 2 * wave(t)), ('z', -8 * wipe)], 'head': [('x', 6 * wipe - 3), ('y', -6 * wipe), ('z', 4 * wave(t, 1, 0.3))],
          'cap': [('x', -16 * wipe)], 'jaw': [('x', 4 + 4 * wave(t, 2))]}
    legs(fk, 0, 0, 0, spread=3)
    st = P(t, fk=fk, root=(0, 0, -0.004 * wave(t, 2)))
    belly(st, 0.012, 2)
    mower_at(st, off=(0, 0, 0.003 + 0.003 * wave(t, 30)), rx=0.5 * wave(t, 22), ry=0.7 * wave(t, 26, 0.3))
    run_motor(st, t, 10, 0, puffs=3, big=0.7)
    M = E.fk_eval(st)
    hand_on_bar(st, 'L', M)
    m = V(-1, 1, 1)
    bar = E.point(M, 'mower', WR * m)
    brow_a = E.point(M, 'head', (-0.17, -0.27, 1.39))
    brow_b = E.point(M, 'head', (-0.04, -0.33, 1.4))
    flick = E.point(M, 'spine', (-0.48, -0.22, 1.02))
    T = path(t, [(0.0, bar), (0.18, bar), (0.3, brow_a), (0.4, brow_b), (0.48, brow_a), (0.56, brow_b), (0.62, brow_a),
                 (0.69, flick), (0.74, flick + Vector((0, -0.02, 0.07))), (0.9, bar), (1.0, bar)])
    side = seg(t, 0.2, 0.3) * (1 - seg(t, 0.8, 0.9))
    pole = E.point(M, 'spine', POLE * m).lerp(E.point(M, 'spine', (-0.75, 0.0, 1.3)), side)
    hand_dir = E.direction(M, 'mower', (HD - WR) * m).lerp(Vector((1, -0.2, 0.25)), side * (1 - seg(t, 0.64, 0.7)))
    hand_dir = hand_dir.lerp(Vector((-0.3, 0, -1)), seg(t, 0.64, 0.7) * (1 - seg(t, 0.76, 0.86)))
    E.ik_arm(st, 'R', T, pole, hand=hand_dir)
    return st


def walk(t):
    # pousse tranquillement : dandinement, ventre qui ballotte, tête qui regarde l'herbe
    fk = {'spine': [('x', 7), ('y', 3 * wave(t)), ('z', 3 * wave(t))], 'head': [('x', -2), ('z', 10 * wave(t, 1, 0.2)), ('y', -3 * wave(t))],
          'jaw': [('x', 3)]}
    legs(fk, t, lift=26, knee=45, spread=2)
    st = P(t, fk=fk, root=(0.015 * wave(t), 0, 0.018 * hop(t, 2) - 0.01))
    st['fk']['root'] = [('z', -5 * wave(t)), ('y', 3 * wave(t))]
    belly(st, 0.018, 2, -0.15)
    mower_at(st, off=(0, 0, 0.004 * hop(t, 4)), rx=0.6 * wave(t, 4), ry=0.8 * wave(t, 2))
    run_motor(st, t, 4, 2, puffs=2)
    hands_on_bar(st)
    return st


def run(t):
    # il fonce penché en avant, petites jambes frénétiques, la tondeuse saute, rictus de fou
    h = hop(t, 2)
    fk = {'spine': [('x', 32 + 3 * wave(t, 4)), ('y', 4 * wave(t, 2))], 'head': [('x', -34 + 4 * wave(t, 4)), ('z', 5 * wave(t, 2))],
          'jaw': [('x', 14 + 4 * wave(t, 4))], 'cap': [('x', -6 - 4 * wave(t, 4))]}
    legs(fk, 2 * t, lift=48, knee=85)
    st = P(t, fk=fk, root=(0, -0.07, 0.035 * hop(t, 4) - 0.035))
    st['fk']['root'] = [('z', -6 * wave(t, 2))]
    belly(st, 0.03, 4, -0.2)
    mower_at(st, off=(0, -0.1, 0.07 * h), rx=-7 * h + 2, ry=2.5 * wave(t, 2), piv=(0, AX_R, 0.0))
    run_motor(st, t, 5, 4, puffs=4, big=1.2)
    hands_on_bar(st)
    return st


def warn(t):
    # il lâche le guidon, attrape le lanceur et tire d'un grand coup : le moteur rugit, la fumée jaillit
    reach = seg(t, 0.0, 0.25)
    yank = seg(t, 0.28, 0.5)
    back = seg(t, 0.62, 0.92)
    roar = seg(t, 0.45, 0.55)
    bend = reach * (1 - yank)
    fk = {'spine': [('x', 14 * bend - 8 * yank * (1 - back)), ('z', -18 * yank * (1 - back) - 6 * bend), ('y', 6 * bend)],
          'head': [('x', 10 * bend - 14 * yank * (1 - back)), ('z', 10 * yank * (1 - back))],
          'jaw': [('x', 3 + 16 * roar)], 'cap': [('x', -10 * roar * (1 - back))]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -25 * (bend + 0.5 * yank)), ('y', 6 * (1 if s == 'L' else -1))]
        fk['shin' + s] = [('x', 40 * (bend + 0.5 * yank))]
        fk['foot' + s] = [('x', -14 * (bend + 0.5 * yank))]
    st = P(t, fk=fk, root=(0, 0.03 * yank * (1 - back), -0.06 * bend - 0.03 * yank))
    belly(st, 0.025, 3)
    shake = roar
    mower_at(st, off=(0.01 * shake * wave(t, 5), 0, 0.012 * shake * hop(t, 6)), rx=2 * shake * wave(t, 6), ry=2 * shake * wave(t, 7, 0.2))
    st['fk']['lame'] = [('z', 360 * 3 * t * t)]
    st['fk']['roueAv'] = [('x', 0)]
    st['fk']['roueAr'] = [('x', 0)]
    st['scl']['smoke'] = max(0.02, 0.1 + 2.2 * roar * (1 - 0.5 * back))
    st['loc']['smoke'] = (0.04 * roar, 0.12 * roar, 0.18 * roar)
    # trajet de la poignée du lanceur (repère de la tondeuse) : elle suit la main
    M = E.fk_eval(st)
    hand_on_bar(st, 'L', M)
    pull = E.point(M, 'spine', (-0.62, -0.2, 1.12)) - E.point(M, 'mower', CGRIP)
    gpos = Vector(tuple(CGRIP)) + pull * yank * (1 - seg(t, 0.55, 0.75))
    st['loc']['cordgrip'] = tuple(gpos - Vector(tuple(CGRIP)))
    M = E.fk_eval(st)
    g = E.point(M, 'cordgrip', CGRIP)
    pul = E.point(M, 'mower', PULLEY)
    E.aim(st, 'cord', g - pul, M)
    st['scl']['cord'] = (1, (g - pul).length / CORD_LEN, 1)
    bar = E.point(M, 'mower', WR * V(-1, 1, 1))
    sh = E.point(M, 'spine', SH * V(-1, 1, 1))
    u = (sh - g).normalized()
    on_grip = g + u * 0.06
    T = path(t, [(0.0, bar), (0.22, on_grip)]) if t < 0.22 else (on_grip if t < 0.6 else path(t, [(0.6, on_grip), (0.95, bar)]))
    pole = E.point(M, 'spine', (-0.6, 0.45, 0.8))
    hd = (-u).lerp(E.direction(M, 'mower', (HD - WR) * V(-1, 1, 1)), seg(t, 0.62, 0.95))
    E.ik_arm(st, 'R', T, pole, hand=hd)
    return st


def hit(t):
    # il ricane, les épaules secouées, et tapote le guidon de sa tondeuse (« brave bête »)
    sh = wave(t, 6)
    fk = {'spine': [('x', -6 + 3 * sh), ('y', 3 * wave(t, 3))], 'head': [('x', -16 + 5 * sh), ('z', 12 * wave(t, 1, 0.25)), ('y', 6)],
          'jaw': [('x', 6 + 8 * hop(t, 6))], 'cap': [('x', -4 * hop(t, 6))]}
    legs(fk, 0, 0, 0, spread=3)
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -6 * hop(t, 6)), ('y', 3 * (1 if s == 'L' else -1))]
        fk['shin' + s] = [('x', 10 * hop(t, 6))]
    st = P(t, fk=fk, root=(0, 0.02, 0.012 * hop(t, 6) - 0.01))
    belly(st, 0.035, 6)
    pat = hop(t, 3) ** 0.6
    knock = max(0.0, 1 - hop(t, 3) / 0.12)
    mower_at(st, off=(0, 0, -0.006 * knock), rx=1.0 * knock)
    run_motor(st, t, 5, 0, puffs=2, big=0.7)
    M = E.fk_eval(st)
    hand_on_bar(st, 'L', M)
    hand_on_bar(st, 'R', M, lift=(0.0, 0.0, 0.1 * pat))
    return st


def ground(st):
    """remonte la tondeuse pour que sa roue la plus basse touche le sol"""
    M = E.fk_eval(st)
    low = min(E.point(M, 'mower', (sx * WHEEL_X, yy, WHEEL_R)).z for sx in (1, -1) for yy in (AX_F, AX_R)) - WHEEL_R
    st['mat']['mower'] = Matrix.Translation((0, 0, -low)) @ st['mat']['mower']


def mower_steps(st, steps, off=(0, 0, 0)):
    """pose la tondeuse par une suite de rotations (pivot, (rx, ry, rz) en degrés), puis la repose au sol"""
    Mw = Matrix.Identity(4)
    for piv, (rx, ry, rz) in steps:
        pv = Vector(tuple(piv))
        R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix().to_4x4()
        Mw = Matrix.Translation(pv) @ R @ Matrix.Translation(-pv) @ Mw
    st['mat']['mower'] = Matrix.Translation(Vector(tuple(off))) @ Mw @ REST['mower']
    ground(st)


def guitar(neck_dir, bar_pos, face=(0, -1, 0)):
    """matrice monde de la tondeuse tenue comme une guitare : le manche (carter → guidon) suit neck_dir,
    le carter regarde vers face, le milieu du guidon est en bar_pos"""
    B, D = Vector((0, BAR_Y, BAR_Z)), Vector(tuple(DECK_C))
    X, N = Vector((1, 0, 0)), (B - D).normalized()
    F0 = Matrix((X, N, X.cross(N))).transposed()
    N1 = Vector(tuple(neck_dir)).normalized()
    U1 = Vector(tuple(face))
    U1 = (U1 - N1 * U1.dot(N1)).normalized()
    F1 = Matrix((N1.cross(U1), N1, U1)).transposed()
    R = (F1 @ F0.transposed()).to_4x4()
    return Matrix.Translation(Vector(tuple(bar_pos))) @ R @ Matrix.Translation(-B) @ REST['mower']


def dance(t):
    # air guitar : il soulève la tondeuse (moteur en marche !) et la tient comme une guitare, le carter sur la hanche
    # droite, le guidon en manche vers le haut à gauche ; accroupi, jambes écartées, il gratte et secoue la tête (2 temps)
    b = hop(t, 2)
    side = wave(t, 1)
    dn = 1 - b
    fk = {'spine': [('x', -6 + 10 * dn), ('y', 5 * side), ('z', 6)], 'head': [('x', 36 * dn - 18), ('y', -8 * side)],
          'jaw': [('x', 16)], 'cap': [('x', -10 * b)]}
    for s, sg in (('L', 1), ('R', -1)):
        fk['thigh' + s] = [('x', -40 - 14 * dn), ('y', 22 * sg)]
        fk['shin' + s] = [('x', 62 + 22 * dn)]
        fk['foot' + s] = [('x', -22 - 8 * dn), ('y', -16 * sg)]
    drop = 0.12 + 0.05 * dn
    st = P(t, fk=fk, root=(0.02 * side, 0.02, -drop))
    belly(st, 0.03, 2, 0.1)
    tilt = math.radians(6 * side)
    neck = (math.cos(math.radians(32) + tilt), 0.1, math.sin(math.radians(32) + tilt))
    st['mat']['mower'] = guitar(neck, (0.4, -0.43, 0.98 - drop + 0.03 * b))
    run_motor(st, t, 5, 1, puffs=2)
    M = E.fk_eval(st)
    E.ik_arm(st, 'L', E.point(M, 'mower', WR * V(-1, 1, 1)), E.point(M, 'spine', (0.7, 0.1, 0.7)),
             hand=E.direction(M, 'mower', (HD - WR) * V(-1, 1, 1)))
    strum = wave(t, 8)
    across = E.direction(M, 'mower', (1, 0, 0))
    pick = E.point(M, 'mower', (0.0, YM + 0.36, 0.36)) + E.direction(M, 'mower', (0, -0.6, 0.8)) * 0.07 + across * 0.07 * strum
    E.ik_arm(st, 'R', pick, E.point(M, 'spine', (-0.8, 0.1, 0.8)), hand=across * (0.5 * strum) + Vector((0.3, -0.4, -0.6)))
    return st


MOV = ['mower', 'belly', 'smoke', 'cord', 'cordgrip']
E.bake([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)], MOV)

body_tris = E.tris([BODY, ARMS])
K.log('triangles : corps', body_tris, 'total', E.tris())
E.tris_report()

K.preview([
    ('face', 'Idle', 0, (0.3, -4.2, 1.3), (0, -0.45, 0.75)),
    ('troisquarts', 'Idle', 0, (2.9, -3.2, 2.0), (0, -0.45, 0.65)),
    ('jeu', 'Walk', 0, (2.6, -3.3, 3.6), (0, -0.45, 0.55)),
    ('visage', 'Idle', 0, (0.35, -1.75, 1.45), (0, -0.1, 1.28)),
    ('essuie', 'Idle', 26, (1.0, -3.0, 1.5), (0, -0.3, 0.95)),
    ('marche', 'Walk', 6, (3.6, -1.6, 1.3), (0, -0.45, 0.7)),
    ('course', 'Run', 6, (3.6, -1.2, 1.2), (0, -0.5, 0.65)),
    ('alerte', 'Warn', 9, (-2.4, -2.6, 1.5), (0, -0.35, 0.8)),
    ('ricane', 'Hit', 7, (1.4, -3.4, 1.4), (0, -0.4, 0.85)),
    ('danse', 'Dance', 8, (0.4, -3.8, 1.3), (0, -0.3, 0.7)),
    ('danse2', 'Dance', 20, (1.8, -3.0, 2.4), (0, -0.3, 0.7)),
    ('dessous', 'Idle', 0, (1.2, -2.8, 0.18), (0, -1.0, 0.2)),
])
K.export()
E.cleanup()
