# Le hamster dans sa boule : un hamster dodu, roux et blanc, grosses joues, dents de devant, yeux brillants
# surexcités, enfermé dans une grande boule de plastique transparent qui fonce en ligne droite.
#   Blender -b -P tools/blender/terriens/hamster.py -- public/models/terriens/hamster.glb [dossier_aperçus]
# Clips : Idle (se lisse les moustaches), Walk (trottine), Run (pédale comme un dératé), Warn (se frotte les pattes,
# regard fou), Hit (sonné, la tête qui tourne), Dance (se dandine).
#
# Pièces pour le code :
#   « Boule » : la boule, objet à part (pas lié au squelette), origine au centre de la boule (0, 0,42 au-dessus du sol).
#               Le jeu la fait rouler : rotation autour de son axe X local (axe gauche-droite du hamster),
#               angle += vitesse × dt / 0,42 (sens positif = elle roule vers l'avant du hamster).
#   « Rig »   : le squelette (os racine « root »), qui porte le hamster ; il reste debout au fond de la boule.
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion
import kit as K
from kit import V, ell, cone, rbox, srgb, wave, hop, pose

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/hamster.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('hamster', OUT, PREVIEW)

BALL_C = V(0, 0, 0.42)
BALL_R = 0.42

# --- proportions (le hamster accroupi au fond de la boule, un peu penché en avant) ---------------------------
HEAD_C = V(0, -0.07, 0.47)
SH = V(0.115, -0.1, 0.33)       # épaule gauche
WR = V(0.125, -0.19, 0.255)     # poignet
HD = V(0.125, -0.235, 0.235)    # bout de la patte
HIP = V(0.1, 0.045, 0.155)      # hanche gauche
ANK = V(0.1, 0.005, 0.065)      # cheville
TOE = V(0.1, -0.1, 0.04)        # bout du pied
EYE_L = V(0.07, -0.168, 0.505)
EYE_R0 = 0.05

body = [
    # le corps : une poire bien dodue, le ventre en avant
    ell('body', (0, 0.025, 0.215), (0.175, 0.165, 0.175), k=0.06),
    ell('body', (0, -0.035, 0.32), (0.145, 0.13, 0.12), k=0.06),
    # la tête, ronde, et le museau
    ell('head', tuple(HEAD_C), (0.15, 0.135, 0.13), k=0.05),
    ell('muzzle', (0, -0.185, 0.432), (0.065, 0.06, 0.052), k=0.04),
    ell('nose', (0, -0.243, 0.448), (0.024, 0.018, 0.019), k=0.012),
    # les grosses joues qui débordent
    ell('cheek', (0.112, -0.125, 0.415), (0.085, 0.078, 0.07), k=0.04),
    ell('cheek', (-0.112, -0.125, 0.415), (0.085, 0.078, 0.07), k=0.04),
    # la touffe sur le crâne
    ell('tuft', (0, -0.09, 0.595), (0.03, 0.04, 0.035), k=0.03, R=K.rot(-30, 0, 0)),
    ell('tuft', (0.03, -0.05, 0.6), (0.025, 0.035, 0.03), k=0.03, R=K.rot(-20, 25, 0)),
    # la petite queue
    ell('tail', (0, 0.19, 0.12), (0.028, 0.03, 0.024), k=0.02),
]
for sx in (1, -1):
    m = V(sx, 1, 1)
    # oreilles rondes, un peu écartées
    body.append(ell('ear', tuple(V(0.105, -0.025, 0.585) * m), (0.052, 0.022, 0.05), k=0.025, R=K.rot(-10, 0, -sx * 18)))
    # bras courts, pattes roses
    body.append(cone('arm', tuple(SH * m), tuple(WR * m), 0.042, 0.03, k=0.03))
    body.append(ell('paw', tuple(((WR + HD) / 2) * m), (0.032, 0.036, 0.026), k=0.02))
    # cuisses rondes et grands pieds plats
    body.append(ell('haunch', tuple((HIP + V(0.012, 0, -0.03)) * m), (0.08, 0.095, 0.085), k=0.04))
    body.append(cone('leg', tuple(HIP * m), tuple(ANK * m), 0.05, 0.03, k=0.03))
    body.append(ell('foot', tuple(((ANK + TOE) / 2 + V(0, 0, -0.012)) * m), (0.038, 0.07, 0.021), k=0.02))

ORANGE, ORANGE_D, CREAM, PINK = srgb('#ee8a2c'), srgb('#c9661c'), srgb('#fff4e2'), srgb('#ff9ab4')
COL = {'default': ORANGE, 'body': ORANGE, 'head': ORANGE, 'muzzle': CREAM, 'cheek': CREAM, 'nose': srgb('#ff6f9a'),
       'tuft': ORANGE_D, 'tail': PINK, 'ear': ORANGE, 'arm': ORANGE, 'paw': PINK, 'haunch': ORANGE, 'leg': ORANGE,
       'foot': PINK}


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # le ventre, le poitrail et la gorge blancs
    belly = np.isin(tag, ('body', 'haunch', 'arm')) & (nor[:, 1] < -0.15) & (np.abs(x) < 0.15 - np.maximum(z - 0.3, 0) * 0.6)
    col[belly] = CREAM
    # le bas du visage blanc (sous les yeux), une liste blanche sur le front
    face = (tag == 'head') & (nor[:, 1] < -0.3) & ((z < 0.455) | (np.abs(x) < 0.022 + np.maximum(0.6 - z, 0) * 0.1))
    col[face] = CREAM
    # le dos un peu plus sombre (une raie), et le dessus du crâne
    back = np.isin(tag, ('body', 'head')) & (nor[:, 1] > 0.4) & (np.abs(x) < 0.06)
    col[back] = ORANGE_D
    # l'intérieur des oreilles rose
    inner = (tag == 'ear') & (nor[:, 1] < -0.2)
    col[inner] = PINK
    # la bouche en « w » sous le nez, rose foncé
    mz = 0.405 + 0.012 * np.cos(np.abs(x) / 0.03 * math.pi)
    mouth = (tag == 'muzzle') & (y < -0.2) & (np.abs(x) < 0.04) & (np.abs(z - mz) < 0.006)
    col[mouth] = srgb('#7a2a3a')
    groove = (tag == 'muzzle') & (y < -0.22) & (np.abs(x) < 0.004) & (z > 0.41) & (z < 0.432)
    col[groove] = srgb('#7a2a3a')
    # les doigts : petits plis sur les pattes et les pieds
    toes = (tag == 'foot') & (y < -0.06) & (np.abs(np.abs(x) - 0.1) % 0.022 < 0.004)
    col[toes] = srgb('#e0708e')


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.3, -0.3, 0.0), (0.3, 0.26, 0.68), vox=0.0042)
K.decimate(BODY, 8000)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Hamster', rough=0.75, spec=0.2))

# --- accessoires du hamster ------------------------------------------------------------------------------------
white = K.mat('Blanc', '#ffffff', rough=0.15)
EYES = K.eyes(tuple(EYE_L), EYE_R0, pupil_dir=(0, -1, 0.04), pupil_r=0.62)
SPARK = []
for sx, n in ((1, 'RefletG'), (-1, 'RefletD')):
    c = EYE_L * V(sx, 1, 1)
    SPARK.append(K.sphere(n, tuple(c + V(0.013 * sx, -0.059, 0.015)), 0.0095, white, seg=10))
    SPARK.append(K.sphere(n + '2', tuple(c + V(-0.008 * sx, -0.06, -0.008)), 0.005, white, seg=8))
teeth = K.mat('Dents', '#fffdf4', rough=0.2)
TEETH = [K.box('DentG', (0.0105, -0.226, 0.392), (0.019, 0.012, 0.036), teeth, bevel=0.004),
         K.box('DentD', (-0.0105, -0.226, 0.392), (0.019, 0.012, 0.036), teeth, bevel=0.004)]
whisk = K.mat('Moustache', '#5a3418', rough=0.6)
WHISK = {'L': [], 'R': []}
for s, sx in (('L', 1), ('R', -1)):
    for k, dz in enumerate((0.03, 0.0, -0.028)):
        a = V(0.045 * sx, -0.215, 0.428 + dz * 0.25)
        b = V(0.2 * sx, -0.235 + abs(dz) * 0.6, 0.432 + dz)
        WHISK[s].append(K.cylinder(f'Moustache{s}{k}', tuple(a), tuple(b), 0.0035, whisk, seg=5, smooth=False))


# --- la boule ------------------------------------------------------------------------------------------------
def glass(name, color, alpha, rough=0.05):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = tuple(srgb(color)) + (1,)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Alpha'].default_value = alpha
    for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try:
            setattr(m, attr, val)
        except (AttributeError, TypeError):
            pass
    return m


def place(o, center, zdir, xdir=(1, 0, 0)):
    """oriente une pièce (créée à l'origine) : son axe Z local suit zdir, son X local suit xdir, puis la pose en center"""
    z = Vector(zdir).normalized()
    x = Vector(xdir)
    x = (x - z * x.dot(z)).normalized()
    y = z.cross(x)
    R = Matrix((x, y, z)).transposed().to_4x4()
    o.matrix_world = Matrix.Translation(Vector(center)) @ R
    K.activate(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def join(target, others):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in others:
        o.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return target


GLASS = glass('Verre', '#d4f0ff', 0.25)
GLINT = glass('VerreReflet', '#ffffff', 0.6)
SEAM = K.mat('Bague', '#ff3d9a', rough=0.3)
VENT = K.mat('Grille', '#3fa0e8', rough=0.35)
ball = K.sphere('Boule', tuple(BALL_C), BALL_R, GLASS, seg=36)
TILT = 35
N = Vector((0, math.sin(math.radians(TILT)), math.cos(math.radians(TILT))))   # pôle de la couture (en haut, vers l'arrière)
parts = [K.torus('BouleCouture', tuple(BALL_C), BALL_R + 0.002, 0.014, SEAM, rot_deg=(-TILT, 0, 0), seg=56)]
# la trappe ronde au pôle, avec son loquet
LID_R = 0.11
lid_c = Vector(BALL_C) + N * math.sqrt(BALL_R ** 2 - LID_R ** 2)
parts.append(K.torus('BouleTrappe', tuple(lid_c), LID_R, 0.012, SEAM, rot_deg=(-TILT, 0, 0), seg=28))
latch = K.box('BouleLoquet', (0, 0, 0), (0.05, 0.03, 0.02), SEAM, bevel=0.006)
latch_dir = Quaternion(Vector((1, 0, 0)), math.radians(-20)) @ N
parts.append(place(latch, tuple(Vector(BALL_C) + latch_dir * (BALL_R + 0.006)), tuple(latch_dir)))
# trois rangées de fentes d'aération, à un quart de tour les unes des autres : on voit bien la boule rouler
for k in (1, 2, 3):
    d = Quaternion(Vector((1, 0, 0)), math.radians(90 * k)) @ N
    u = d.cross(Vector((1, 0, 0))).normalized()
    for j in (-1, 0, 1):
        r = (d + u * 0.13 * j).normalized()
        slot = K.box(f'BouleFente{k}{j}', (0, 0, 0), (0.13 - 0.03 * abs(j), 0.02, 0.012), VENT, bevel=0.006)
        parts.append(place(slot, tuple(Vector(BALL_C) + r * (BALL_R + 0.002)), tuple(r)))
# deux reflets peints sur le plastique (en haut à gauche, face au joueur)
for k, (az, el, ln) in enumerate(((-35, 40, 0.11), (-58, 22, 0.05))):
    d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)),
                math.sin(math.radians(el))))
    g = K.sphere(f'BouleReflet{k}', (0, 0, 0), 1.0, GLINT, scale=(0.022, ln, 0.006), seg=12)
    t = d.cross(Vector((0, 0, 1))).cross(d)   # tangente qui monte
    tang = (t * 0.8 + d.cross(t) * 0.6).normalized()
    parts.append(place(g, tuple(Vector(BALL_C) + d * (BALL_R + 0.004)), tuple(d), tuple(d.cross(tang))))
join(ball, parts)
ball.data.name = 'BouleMaillage'
K.activate(ball)
bpy.ops.object.shade_smooth()

# --- squelette ------------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0.04, 0.14), (0, 0.0, 0.27))
K.bone('spine', (0, 0.0, 0.27), (0, -0.05, 0.385), 'root', True)
K.bone('head', (0, -0.05, 0.385), (0, -0.07, 0.62), 'spine', True)
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('ear' + s, V(0.1, -0.025, 0.55) * m, V(0.115, -0.025, 0.63) * m, 'head')
    K.bone('cheek' + s, V(0.07, -0.1, 0.42) * m, V(0.17, -0.14, 0.41) * m, 'head')
    K.bone('whisk' + s, V(0.04, -0.215, 0.43) * m, V(0.12, -0.225, 0.432) * m, 'head')
    K.bone('eye' + s, EYE_L * m, (EYE_L + V(0, -0.05, 0)) * m, 'head')
    K.bone('arm' + s, SH * m, WR * m, 'spine')
    K.bone('hand' + s, WR * m, HD * m, 'arm' + s, True)
    K.bone('thigh' + s, HIP * m, ANK * m, 'root')
    K.bone('foot' + s, ANK * m, TOE * m, 'thigh' + s, True)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'muzzle', 'nose', 'tuft'):
        return ['head']
    if tg == 'cheek':
        return ['head', 'cheek' + s]
    if tg == 'ear':
        return ['head', 'ear' + s] if p[2] < 0.56 else ['ear' + s]
    if tg == 'body':
        return ['root', 'spine'] + (['head'] if p[2] > 0.38 else [])
    if tg == 'arm':
        return ['spine', 'arm' + s]
    if tg == 'paw':
        return ['arm' + s, 'hand' + s]
    if tg == 'haunch':
        return ['root', 'thigh' + s]
    if tg == 'leg':
        return ['root', 'thigh' + s]
    if tg == 'foot':
        return ['thigh' + s, 'foot' + s]
    return ['root']


W = K.skin(BODY, CO, TAG, allowed)
for o in EYES[0::2] + TEETH:
    K.attach(o, 'head')
K.attach(EYES[1], 'eyeL')
K.attach(EYES[3], 'eyeR')
for o in SPARK[:2]:
    K.attach(o, 'eyeL')
for o in SPARK[2:]:
    K.attach(o, 'eyeR')
for s in ('L', 'R'):
    for o in WHISK[s]:
        K.attach(o, 'whisk' + s)


# --- cuisson des animations (avec échelle par os : joues qui gonflent, pupilles qui rétrécissent) ---------------
SC_BONES = ['cheekL', 'cheekR', 'eyeL', 'eyeR']


def bake(clips):
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
            for bname, rots in st['fk'].items():
                pb[bname].rotation_quaternion = K.q_world(bname, rots)
            pb['root'].location = REST['root'].to_3x3().inverted() @ Vector(st['root'])
            if st['scale']:
                sc = REST['root'].to_3x3().inverted() @ Vector(st['scale'])
                pb['root'].scale = (abs(sc[0]), abs(sc[1]), abs(sc[2]))
            for bname, sc in st.get('sc', {}).items():
                pb[bname].scale = sc            # repère de l'os : y = le long de l'os
            for b in pb:
                b.keyframe_insert('rotation_quaternion', frame=f)
            pb['root'].keyframe_insert('location', frame=f)
            for bname in ['root'] + SC_BONES:
                pb[bname].keyframe_insert('scale', frame=f)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
    arm.animation_data.action = None
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    K.log('animations', [c[0] for c in clips])


def P(fk, root=(0, 0, 0), scale=None, sc=None):
    d = pose(fk, root=root, scale=scale)
    d['sc'] = sc or {}
    return d


def mirror_side(fk, s, rots):
    fk[s] = rots


def puff(k):
    return {'cheekL': (1 + k, 1 + k * 0.6, 1 + k), 'cheekR': (1 + k, 1 + k * 0.6, 1 + k)}


def pupils(k):
    return {'eyeL': (k, 1, k), 'eyeR': (k, 1, k)}


# --- animations -----------------------------------------------------------------------------------------------
def idle(t):
    # assis, il se lisse les moustaches : deux coups de pattes vers l'extérieur, la tête qui accompagne
    g = 0.5 - 0.5 * math.cos(K.TAU * 2 * t)          # 0 : pattes au museau, 1 : écartées le long des moustaches
    look = wave(t, 1, 0.1)
    fk = {'root': [('x', -6)], 'spine': [('x', -8), ('y', 3 * look)],
          'head': [('x', 4 + 4 * g), ('z', 8 * look), ('y', 5 * wave(t, 2, 0.25))],
          'whiskL': [('z', -12 * g)], 'whiskR': [('z', 12 * g)],
          'earL': [('y', -6 * wave(t, 2))], 'earR': [('y', 6 * wave(t, 2))],
          'eyeL': [('z', 12 * look)], 'eyeR': [('z', 12 * look)]}
    for s, sx in (('L', 1), ('R', -1)):
        fk['arm' + s] = [('x', -78 + 6 * g), ('z', sx * (-34 + 40 * g))]
        fk['hand' + s] = [('x', -30), ('z', sx * (-20 + 30 * g))]
        fk['thigh' + s] = [('x', -6)]
        fk['foot' + s] = [('x', 6)]
    return P(fk, root=(0, 0.01, -0.006 + 0.006 * wave(t, 2)), sc=puff(0.05 * g))


def legs(fk, ph, swing=28, lift=22, arms=30):
    """trot : jambes et pattes en diagonale (arrière gauche avec avant droite)"""
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (ph + o))
        up = max(0.0, math.cos(K.TAU * (ph + o)))
        fk['thigh' + s] = [('x', -swing * w)]
        fk['foot' + s] = [('x', lift * up - 10 * w)]
        a = 'R' if s == 'L' else 'L'
        fk['arm' + a] = [('x', -arms * w - 15 * up)]
        fk['hand' + a] = [('x', -25 * up)]


def walk(t):
    # il trottine sur place au fond de la boule, content
    fk = {'root': [('x', 12)], 'spine': [('x', 6), ('y', 4 * wave(t, 1))], 'head': [('x', -14), ('z', 6 * wave(t, 1)), ('y', -4 * wave(t, 1))],
          'earL': [('x', -8 * hop(t, 2))], 'earR': [('x', -8 * hop(t, 2))],
          'whiskL': [('z', 6 * wave(t, 2))], 'whiskR': [('z', -6 * wave(t, 2))]}
    legs(fk, t)
    return P(fk, root=(0, 0, 0.018 * hop(t, 2)), sc=puff(0.04 * hop(t, 2)))


def run(t):
    # il pédale comme un dératé : penché en avant, oreilles plaquées, joues qui ballottent, pattes en moulinet
    fk = {'root': [('x', 22)], 'spine': [('x', 10)], 'head': [('x', -22 + 4 * wave(t, 6)), ('y', 3 * wave(t, 3))],
          'earL': [('x', -55), ('y', 12)], 'earR': [('x', -55), ('y', -12)],
          'whiskL': [('z', 22 + 8 * wave(t, 6))], 'whiskR': [('z', -22 - 8 * wave(t, 6))]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        ph = 3 * t + o
        w, c = math.sin(K.TAU * ph), math.cos(K.TAU * ph)
        fk['thigh' + s] = [('x', -38 * w)]
        fk['foot' + s] = [('x', 30 * max(0.0, c) - 18 * w)]
        a = 'R' if s == 'L' else 'L'
        fk['arm' + a] = [('x', -30 - 45 * w)]
        fk['hand' + a] = [('x', -20 - 30 * max(0.0, c))]
    return P(fk, root=(0, -0.02, 0.022 * hop(t, 6) - 0.01), sc=puff(0.14 + 0.06 * wave(t, 6)))


def warn(t):
    # il se frotte les pattes, l'œil fou (pupilles en tête d'épingle qui louchent), ramassé prêt à foncer
    e = min(1.0, t / 0.35)
    rub = wave(t, 4)
    fk = {'root': [('x', 16 * e)], 'spine': [('x', 4 * e)], 'head': [('x', -14 * e), ('y', 6 * wave(t, 2) * e)],
          'earL': [('x', -30 * e)], 'earR': [('x', -30 * e)],
          'eyeL': [('z', -14 * e), ('x', -12 * e)], 'eyeR': [('z', -10 * e), ('x', 14 * e)],
          'whiskL': [('z', 15 * e * wave(t, 8))], 'whiskR': [('z', -15 * e * wave(t, 8))]}
    for s, sx in (('L', 1), ('R', -1)):
        k = rub if s == 'L' else -rub
        fk['arm' + s] = [('x', (-62 + 14 * k) * e), ('z', sx * -42 * e)]
        fk['hand' + s] = [('x', -20 * e), ('z', sx * (-30 + 10 * k) * e)]
        fk['thigh' + s] = [('x', -18 * e)]
        fk['foot' + s] = [('x', 14 * e)]
    return P(fk, root=(0, 0.01 * e, -0.025 * e), sc={**puff(0.1 * e), **pupils(1 - 0.5 * e)})


def hit(t):
    # sonné : la tête décrit des ronds, le corps tangue à contretemps, les yeux tournent en spirale
    a = K.TAU * t
    b = K.TAU * 2 * t
    fk = {'root': [('x', 4), ('y', 6 * math.sin(a))], 'spine': [('y', 6 * math.sin(a)), ('x', 5 * math.cos(a))],
          'head': [('x', 14 * math.cos(a)), ('y', -16 * math.sin(a)), ('z', 6 * math.sin(a))],
          'earL': [('y', 25), ('x', 10 * math.sin(b))], 'earR': [('y', -25), ('x', 10 * math.sin(b))],
          'eyeL': [('z', 28 * math.cos(b)), ('x', 28 * math.sin(b))], 'eyeR': [('z', -28 * math.cos(b)), ('x', 28 * math.sin(b))],
          'whiskL': [('z', -15)], 'whiskR': [('z', 15)]}
    for s, sx in (('L', 1), ('R', -1)):
        fk['arm' + s] = [('x', 10 + 8 * math.sin(a + (0 if s == 'L' else 2))), ('y', sx * 25)]
        fk['hand' + s] = [('x', 20)]
        fk['thigh' + s] = [('x', -10 + 6 * sx * math.sin(a))]
        fk['foot' + s] = [('x', 8)]
    return P(fk, root=(0.012 * math.sin(a), 0, -0.01), sc=pupils(0.85))


def dance(t):
    # il se dandine : les fesses d'un côté, la tête de l'autre, une patte en l'air à chaque temps
    side = wave(t, 1)
    b = hop(t, 2)
    fk = {'root': [('y', -10 * side)], 'spine': [('y', 14 * side), ('x', -4)], 'head': [('y', -12 * side), ('x', 8 * b - 4)],
          'earL': [('x', -10 * b)], 'earR': [('x', -10 * b)],
          'whiskL': [('z', 10 * b)], 'whiskR': [('z', -10 * b)],
          'eyeL': [('z', 15 * side)], 'eyeR': [('z', 15 * side)]}
    up_l, up_r = max(0.0, side), max(0.0, -side)
    fk['armL'] = [('x', -40 - 90 * up_l), ('y', 30 * up_l)]
    fk['handL'] = [('x', -30 * up_l), ('z', 30 * wave(t, 4) * up_l)]
    fk['armR'] = [('x', -40 - 90 * up_r), ('y', -30 * up_r)]
    fk['handR'] = [('x', -30 * up_r), ('z', 30 * wave(t, 4) * up_r)]
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -14 * (1 - b))]
        fk['foot' + s] = [('x', 10 * (1 - b))]
    return P(fk, root=(0.025 * side, 0, -0.02 * (1 - b)), sc=puff(0.06 * b))


bake([('Idle', 60, idle), ('Walk', 20, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)])

K.preview([
    ('face', 'Idle', 0, (0.25, -2.4, 0.75), (0, 0, 0.4)),
    ('troisquarts', 'Walk', 0, (1.7, -1.8, 1.3), (0, 0, 0.38)),
    ('jeu', 'Run', 4, (2.6, -2.6, 3.1), (0, 0, 0.35)),
    ('visage', 'Idle', 0, (0.15, -1.25, 0.55), (0, 0, 0.45)),
    ('moustaches', 'Idle', 15, (0.6, -1.4, 0.7), (0, 0, 0.42)),
    ('course', 'Run', 4, (2.0, -0.6, 0.7), (0, 0, 0.38)),
    ('alerte', 'Warn', 16, (0.6, -1.5, 0.75), (0, 0, 0.42)),
    ('sonne', 'Hit', 8, (0.5, -1.5, 0.75), (0, 0, 0.42)),
    ('danse', 'Dance', 8, (0.4, -1.8, 0.8), (0, 0, 0.42)),
], size=560)
K.export()
