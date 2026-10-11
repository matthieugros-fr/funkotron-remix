# Le dentiste fou : grande blouse blanche, gants bleus, yeux exorbités, sourire plein de dents, miroir frontal,
# touffes grises, roulette au poing. Il avance en grands bonds et part dans des fous rires.
#   Blender -b -P tools/blender/terriens/dentist.py -- public/models/terriens/dentist.glb [dossier_aperçus]
# Clips : Idle, Walk, Run (bonds), Warn (il se ramasse avant de charger), Hit (fou rire), Dance.
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import numpy as np
import kit as K
from kit import V, ell, cone, rbox, srgb, wave, hop, pose

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/dentist.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('dentist', OUT, PREVIEW)

# --- proportions ---------------------------------------------------------------------------------------
HIP_Z = 0.62
HEAD_C = V(0, -0.02, 1.47)
SH = V(0.25, 0.0, 1.14)        # épaule gauche
EL = V(0.35, -0.03, 0.88)      # coude
WR = V(0.38, -0.07, 0.66)      # poignet
HD = V(0.385, -0.09, 0.56)     # bout de la main
LEG = {'L': V(0.1, 0.0, 0), 'R': V(-0.1, 0.0, 0)}
KNEE_Z, ANKLE_Z = 0.34, 0.09

body = [
    # la blouse : buste, puis jupe évasée jusqu'aux genoux
    ell('coat', (0, 0.0, 1.0), (0.23, 0.18, 0.29), k=0.05),
    cone('coat_low', (0, 0.0, 0.86), (0, 0.04, 0.42), 0.21, 0.29, k=0.05),
    rbox('coat_low', (0, 0.04, 0.44), (0.27, 0.2, 0.03), r=0.03, k=0.04),      # ourlet bien net
    cone('neck', (0, 0, 1.18), (0, -0.01, 1.3), 0.07, 0.075, k=0.04),
    # la tête : grosse, menton en avant, nez en patate, oreilles
    ell('head', tuple(HEAD_C), (0.24, 0.22, 0.27), k=0.05),
    ell('head', (0, -0.08, 1.34), (0.18, 0.17, 0.12), k=0.06),
    ell('nose', (0, -0.255, 1.45), (0.045, 0.065, 0.06), k=0.03),
    ell('ear', (0.235, -0.01, 1.45), (0.03, 0.05, 0.065), k=0.02),
    ell('ear', (-0.235, -0.01, 1.45), (0.03, 0.05, 0.065), k=0.02),
    # touffes grises en bataille sur les côtés et derrière, crâne dégarni
    ell('hair', (0.2, 0.05, 1.52), (0.09, 0.13, 0.11), k=0.04, R=K.rot(0, 25, 10)),
    ell('hair', (-0.2, 0.05, 1.52), (0.09, 0.13, 0.11), k=0.04, R=K.rot(0, -25, -10)),
    ell('hair', (0.0, 0.17, 1.47), (0.16, 0.08, 0.13), k=0.05),
    ell('hair', (0.24, 0.02, 1.62), (0.05, 0.07, 0.05), k=0.03, R=K.rot(0, 50, 0)),
    ell('hair', (-0.24, 0.02, 1.62), (0.05, 0.07, 0.05), k=0.03, R=K.rot(0, -50, 0)),
    # sourcils broussailleux, froncés vers le haut
    ell('brow', (0.085, -0.205, 1.6), (0.055, 0.02, 0.018), k=0.015, R=K.rot(0, 18, 0)),
    ell('brow', (-0.085, -0.205, 1.6), (0.055, 0.02, 0.018), k=0.015, R=K.rot(0, -18, 0)),
    # la grande bouche ouverte, creusée dans le visage
    ell('mouth', (0, -0.235, 1.335), (0.125, 0.06, 0.05), k=0.015, op='sub'),
]
# jambes de pantalon, souliers vernis
for s, b in LEG.items():
    body.append(cone('trouser', tuple(b + V(0, 0, HIP_Z)), tuple(b + V(0.005, -0.02, KNEE_Z)), 0.075, 0.06, k=0.03))
    body.append(cone('trouser', tuple(b + V(0.005, -0.02, KNEE_Z)), tuple(b + V(0.01, 0, ANKLE_Z + 0.03)), 0.06, 0.05, k=0.02))
    body.append(ell('shoe', tuple(b + V(0.01, -0.07, 0.05)), (0.07, 0.14, 0.055), k=0.03))
# manches et gants de latex
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('sleeve', tuple(SH * m), tuple(EL * m), 0.07, 0.06, k=0.03))
    body.append(cone('sleeve', tuple(EL * m), tuple((WR + V(0, 0, 0.03)) * m), 0.06, 0.065, k=0.02))
    body.append(ell('glove', tuple(((WR + HD) / 2) * m), (0.045, 0.04, 0.07), k=0.03))

COL = {'default': srgb('#f4f6ff'), 'coat': srgb('#f4f6ff'), 'coat_low': srgb('#eef1fb'), 'sleeve': srgb('#f4f6ff'),
       'neck': srgb('#f0c39a'), 'head': srgb('#f0c39a'), 'nose': srgb('#f2a88a'), 'ear': srgb('#eab08c'),
       'hair': srgb('#c8ccd8'), 'brow': srgb('#9aa0b0'), 'trouser': srgb('#3a3550'), 'shoe': srgb('#18121f'),
       'glove': srgb('#8fd0ff'), 'mouth': srgb('#5a1018')}
MOUTH_C, MOUTH_R = V(0, -0.235, 1.335), V(0.125, 0.06, 0.05)


def extra(co, nor, col, tag):
    # l'intérieur de la bouche : rouge sombre ; la langue en bas
    q = (co - MOUTH_C) / MOUTH_R
    inside = (np.linalg.norm(q, axis=1) < 1.35) & (tag == 'head')
    col[inside] = srgb('#5a1018')
    col[inside & (q[:, 2] < -0.3)] = srgb('#c8505a')
    # la blouse : chemise bleue et cravate rouge dans l'encolure, couture du devant, poches
    front = co[:, 1] < -0.12
    neckline = (tag == 'coat') & front & (co[:, 2] > 1.02) & (np.abs(co[:, 0]) < 0.11 - (1.22 - co[:, 2]) * 0.35)
    col[neckline] = srgb('#5a8aff')
    col[neckline & (np.abs(co[:, 0]) < 0.022)] = srgb('#e8334a')
    seam = np.isin(tag, ('coat', 'coat_low')) & front & (np.abs(co[:, 0]) < 0.008) & (co[:, 2] < 1.02)
    col[seam] = srgb('#c8cce0')
    pocket = (tag == 'coat_low') & front & (np.abs(np.abs(co[:, 0]) - 0.15) < 0.055) & (np.abs(co[:, 2] - 0.7) < 0.05)
    col[pocket] = srgb('#dde2f2')
    # joues roses
    cheek = (tag == 'head') & (np.abs(np.abs(co[:, 0]) - 0.13) < 0.05) & (np.abs(co[:, 2] - 1.42) < 0.04) & front
    col[cheek] = srgb('#f2a88a')


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.62, -0.5, 0.0), (0.62, 0.45, 1.86), vox=0.0055)
K.decimate(BODY, 11000)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Dentiste', rough=0.5))

# --- accessoires ------------------------------------------------------------------------------------------
EYE_L = (0.088, -0.19, 1.51)
EYES = K.eyes(EYE_L, 0.068, pupil_dir=(0, -1, 0.05), pupil_r=0.3)             # tout petits points : regard fou
white = K.mat('Dents', '#ffffff', rough=0.2)
TEETH = [K.box('DentsHaut', (0, -0.2, 1.36), (0.2, 0.03, 0.032), white, bevel=0.006),
         K.box('DentsBas', (0, -0.205, 1.307), (0.16, 0.03, 0.022), white, bevel=0.005)]
for i in range(-3, 4):  # interstices
    TEETH.append(K.box(f'Fente{i}', (i * 0.028, -0.216, 1.36), (0.004, 0.004, 0.03), K.mat('Fente', '#c8ccd8')))
band = K.torus('Bandeau', (0, -0.02, 1.62), 0.215, 0.014, K.mat('Bandeau', '#3a3550', rough=0.6), rot_deg=(-12, 0, 0))
mirror = K.cylinder('Miroir', (0, -0.235, 1.68), (0, -0.265, 1.69), 0.075, K.mat('Miroir', '#e8eef8', rough=0.05, metal=0.9), seg=24)
mrim = K.torus('MiroirBord', (0, -0.25, 1.685), 0.075, 0.009, K.mat('Chrome', '#9aa3b8', rough=0.25, metal=0.8), rot_deg=(90, 0, 0))
# la roulette : un manche coudé tenu dans la main droite (x < 0), la fraise tourne au bout
steel = {'default': srgb('#9aa3b8'), 'grip': srgb('#e8eef8'), 'head': srgb('#c8d0e0'), 'ring': srgb('#ff5fd2')}
HR = HD * V(-1, 1, 1)
DRILL = K.solid('Roulette', [
    cone('grip', tuple(HR + V(0, 0.07, 0.04)), tuple(HR + V(0, -0.12, 0.06)), 0.036, 0.03, k=0.01),
    cone('ring', tuple(HR + V(0, -0.12, 0.06)), tuple(HR + V(0, -0.15, 0.065)), 0.032, 0.03, k=0.005),
    cone('default', tuple(HR + V(0, -0.15, 0.065)), tuple(HR + V(0, -0.26, 0.07)), 0.028, 0.02, k=0.01),
    ell('head', tuple(HR + V(0, -0.28, 0.07)), (0.03, 0.035, 0.03), k=0.01),
], tuple(HR + V(-0.08, -0.36, -0.06)), tuple(HR + V(0.08, 0.14, 0.16)), steel, faces=1600, vox=0.004, rough=0.25)
BIT_A, BIT_B = HR + V(0, -0.28, 0.045), HR + V(0, -0.29, -0.06)
bit = K.cone_mesh('Fraise', tuple(BIT_A), tuple(BIT_B), 0.014, 0.002, K.mat('Fraise', '#e8eef8', rough=0.1, metal=1.0), seg=8, smooth=False)
bitfl = K.box('FraiseAilette', tuple((BIT_A + BIT_B) / 2), (0.03, 0.004, 0.05), K.mat('Fraise2', '#ffd23f', metal=0.6))

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, HIP_Z + 0.18))
K.bone('spine', (0, 0, HIP_Z + 0.18), (0, 0, 1.2), 'root', True)
K.bone('head', (0, 0, 1.2), (0, 0, 1.75), 'spine', True)
K.bone('coat', (0, 0.02, 0.84), (0, 0.04, 0.42), 'root')
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0, HIP_Z), b + V(0.005, -0.02, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0.005, -0.02, KNEE_Z), b + V(0.01, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0.01, 0, ANKLE_Z), b + V(0.01, -0.16, 0.03), 'shin' + s, True)
K.bone('bit', BIT_A, BIT_B, 'handR')
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'nose', 'ear', 'hair', 'brow', 'mouth'):
        return ['head']
    if tg == 'neck':
        return ['spine', 'head']
    if tg == 'coat':
        return ['root', 'spine'] + (['arm' + s] if abs(p[0]) > 0.2 and p[2] > 1.05 else [])
    if tg == 'coat_low':
        return ['root', 'coat']
    if tg == 'sleeve':
        return ['spine', 'arm' + s, 'forearm' + s]
    if tg == 'glove':
        return ['forearm' + s, 'hand' + s]
    if tg == 'trouser':
        return ['root', 'thigh' + s, 'shin' + s] if p[2] > 0.5 else ['thigh' + s, 'shin' + s]
    if tg == 'shoe':
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES + TEETH + [band, mirror, mrim]:
    K.attach(o, 'head')
K.attach(DRILL, 'handR')
K.attach(bit, 'bit')
K.attach(bitfl, 'bit')
BIT_AX = tuple((BIT_B - BIT_A) / np.linalg.norm(BIT_B - BIT_A))


# --- animations ---------------------------------------------------------------------------------------------
def legs(fk, ph, lift=30, knee=50, plant=0.0):
    """marche : ph phase de la jambe gauche ; la droite est en opposition"""
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (ph + o))
        up = max(0.0, math.cos(K.TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -15 * up + plant)]


def drill_spin(fk, t, turns=12):
    fk['bit'] = [(BIT_AX, 360 * turns * t)]


def idle(t):
    fk = {'spine': [('x', 6), ('y', 3 * K.wave(t))], 'head': [('x', -4), ('z', 10 * K.wave(t, 1, 0.25)), ('y', 6 * K.wave(t, 2))],
          'armR': [('x', -38)], 'forearmR': [('x', -45)], 'armL': [('y', -12), ('x', -10 + 8 * K.wave(t, 2))],
          'forearmL': [('x', -50)], 'coat': [('x', 3 * K.wave(t))]}
    drill_spin(fk, t, 16 if (t * 4) % 1 < 0.5 else 0)
    return pose(fk, root=(0, 0, -0.01 + 0.012 * K.wave(t, 2)))


def walk(t):
    # pas de loup qui lève les genoux, buste penché, roulette en avant
    fk = {'spine': [('x', 14), ('y', 4 * K.wave(t))], 'head': [('x', -12), ('z', 8 * K.wave(t))],
          'armR': [('x', -50)], 'forearmR': [('x', -35)], 'armL': [('x', 25 * K.wave(t, 1, 0.5)), ('y', -15)],
          'forearmL': [('x', -40)], 'coat': [('x', 6 + 4 * K.wave(t, 2))]}
    legs(fk, t, lift=38, knee=70)
    drill_spin(fk, t, 8)
    return pose(fk, root=(0, 0, 0.035 * K.hop(t, 2)))


def run(t):
    # grands bonds : deux par boucle, jambes repliées en l'air, blouse qui vole, bras qui moulinent
    h = K.hop(t, 2)
    land = max(0.0, 1 - h / 0.18)            # au moment de toucher le sol
    air = max(0.0, (h - 0.15) / 0.85)
    fk = {'spine': [('x', 18 - 12 * land)], 'head': [('x', -14 + 18 * land), ('z', 6 * K.wave(t, 2))],
          'coat': [('x', 10 + 38 * air)],
          'armR': [('x', -110 + 20 * K.wave(t, 2)), ('y', 20)], 'forearmR': [('x', -30)],
          'armL': [('y', -70 - 40 * air), ('x', 30 * K.wave(t, 4))], 'forearmL': [('y', -40 * air)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -55 * air + 10 * land)]
        fk['shin' + s] = [('x', 85 * air + 20 * land)]
        fk['foot' + s] = [('x', -20 * air)]
    drill_spin(fk, t, 24)
    sq = 0.14 * land
    return pose(fk, root=(0, 0, 0.42 * h - 0.06 * land), scale=(1 + sq * 0.6, 1 + sq * 0.6, 1 - sq))


def warn(t):
    # il se ramasse, regarde sa proie, lève la roulette qui vrombit
    e = min(1.0, t / 0.6)
    fk = {'spine': [('x', 25 * e)], 'head': [('x', -22 * e), ('y', 8 * K.wave(t, 3) * e)],
          'armR': [('x', -120 * e), ('y', 15 * e)], 'forearmR': [('x', -50 * e)],
          'armL': [('y', -50 * e), ('x', -40 * e)], 'forearmL': [('x', -70 * e)], 'coat': [('x', -8 * e)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -35 * e)]
        fk['shin' + s] = [('x', 60 * e)]
        fk['foot' + s] = [('x', -25 * e)]
    drill_spin(fk, t, 10)
    return pose(fk, root=(0, 0, -0.1 * e), scale=(1 + 0.05 * e, 1 + 0.05 * e, 1 - 0.06 * e))


def laugh(t):
    # fou rire : tête en arrière, épaules secouées, main sur le ventre, roulette brandie
    sh = K.wave(t, 6)
    fk = {'spine': [('x', -18 + 5 * sh), ('y', 4 * K.wave(t, 3))], 'head': [('x', -32 + 8 * sh), ('z', 10 * K.wave(t, 1.5 if False else 1))],
          'armR': [('y', 150), ('x', -20)], 'forearmR': [('y', 30 + 10 * sh)],
          'armL': [('x', -25), ('y', 15)], 'forearmL': [('x', -100), ('z', -40)], 'handL': [('x', 20)],
          'coat': [('x', -6 + 4 * sh)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -10 * K.hop(t, 6))]
        fk['shin' + s] = [('x', 18 * K.hop(t, 6))]
    drill_spin(fk, t, 20)
    return pose(fk, root=(0, 0.02, 0.05 * K.hop(t, 6) - 0.02))


def dance(t):
    # disco : bras en l'air à tour de rôle, genoux qui fléchissent en rythme (2 temps par boucle)
    b = K.hop(t, 2)
    side = K.wave(t, 1)
    fk = {'spine': [('y', 10 * side), ('x', 5)], 'head': [('y', -12 * side), ('x', -10 * b)],
          'armL': [('y', -150 if side > 0 else -40), ('x', -10)], 'forearmL': [('y', -20)],
          'armR': [('y', 150 if side < 0 else 40), ('x', -10)], 'forearmR': [('y', 20)],
          'coat': [('x', 10 * b)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -20 * (1 - b))]
        fk['shin' + s] = [('x', 35 * (1 - b))]
    drill_spin(fk, t, 8)
    return pose(fk, root=(0.05 * side, 0, -0.05 * (1 - b)))


K.bake([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, laugh), ('Dance', 32, dance)])

K.preview([
    ('face', 'Idle', 0, (0.3, -3.6, 1.3), (0, 0, 0.95)),
    ('troisquarts', 'Idle', 0, (2.4, -2.6, 1.8), (0, 0, 0.95)),
    ('visage', 'Idle', 0, (0.25, -1.6, 1.5), (0, 0, 1.45)),
    ('bond', 'Run', 6, (3.4, -1.0, 1.3), (0, 0, 1.1)),
    ('reception', 'Run', 0, (3.4, -1.0, 1.3), (0, 0, 0.9)),
    ('fourire', 'Hit', 4, (1.4, -3.2, 1.4), (0, 0, 1.0)),
    ('alerte', 'Warn', 16, (1.4, -3.2, 1.2), (0, 0, 0.8)),
    ('danse', 'Dance', 8, (0.8, -3.4, 1.3), (0, 0, 1.0)),
])
K.export()
