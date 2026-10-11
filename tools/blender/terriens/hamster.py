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
TOE = V(0.1, -0.088, 0.042)     # bout du pied
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
K.decimate(BODY, 7200)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Hamster', rough=0.75, spec=0.2))

# --- accessoires du hamster ------------------------------------------------------------------------------------
white = K.mat('Blanc', '#ffffff', rough=0.15)
PUP_R = 0.52


def eyes(c_left, r, pr, seg=18):
    """comme K.eyes, en plus léger : blanc, pupille aplatie qui dépasse un peu, deux éclats de lumière"""
    w, p = white, K.mat('Pupille', '#1a1033', rough=0.2)
    out, spark = [], []
    for sx, n in ((1, 'OeilG'), (-1, 'OeilD')):
        c = V(c_left[0] * sx, c_left[1], c_left[2])
        out.append(K.sphere(n, tuple(c), r, w, seg=seg))
        out.append(K.sphere(n + 'P', tuple(c + V(0, -r * 0.93, 0)), r * pr, p, scale=(1, 0.5, 1), seg=14))
        spark.append(K.sphere(n + 'Eclat', tuple(c + V(0.011 * sx, -r * 0.93 - r * pr * 0.42, 0.012)), 0.0085, w, seg=8))
        spark.append(K.sphere(n + 'Eclat2', tuple(c + V(-0.007 * sx, -r * 0.93 - r * pr * 0.45, -0.008)), 0.0045, w, seg=6))
    return out, spark


EYES, SPARK = eyes(EYE_L, EYE_R0, PUP_R)
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


def glint(name, axis, rho, half, width, m, n=14):
    """reflet peint : un croissant posé sur la boule, le long d'un petit cercle d'axe axis (rayon angulaire rho)"""
    A = Vector(axis).normalized()
    e1 = A.cross(Vector((0, 0, 1))).normalized()
    e2 = A.cross(e1)
    verts, faces = [], []
    for i in range(n + 1):
        th = -half + 2 * half * i / n
        w = width * math.sin(math.pi * i / n) + 1e-4
        for dr in (-w, w):
            r = rho + dr
            d = A * math.cos(r) + (e1 * math.cos(th) + e2 * math.sin(th)) * math.sin(r)
            verts.append(tuple(Vector(BALL_C) + d * (BALL_R + 0.004)))
    for i in range(n):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        faces.append((a, b, c, d))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    K.S['scene'].collection.objects.link(o)
    me.materials.append(m)
    # les faces doivent regarder vers l'extérieur de la boule
    me.update()
    p0 = me.polygons[0]
    if p0.normal.dot(Vector(p0.center) - Vector(BALL_C)) < 0:
        for p in me.polygons:
            p.flip()
    return o


GLASS = glass('Verre', '#d4f0ff', 0.25)
GLINT = glass('VerreReflet', '#ffffff', 0.55)
SEAM = K.mat('Bague', '#ff3d9a', rough=0.3)
VENT = K.mat('Grille', '#3fa0e8', rough=0.35)
ball = K.sphere('Boule', tuple(BALL_C), BALL_R, GLASS, seg=32)


def rolldir(phi):
    """direction dans le plan de roulement (YZ) : phi = 0 en haut, 90 devant (vers -Y), 180 en bas"""
    return Vector((0, -math.sin(math.radians(phi)), math.cos(math.radians(phi))))


# la couture des deux demi-boules, penchée vers l'avant : elle passe bas devant (sous le museau) et haut derrière
PHI_N = 35
N = rolldir(PHI_N)
parts = [K.torus('BouleCouture', tuple(BALL_C), BALL_R + 0.002, 0.013, SEAM, rot_deg=(PHI_N, 0, 0), seg=48)]
# la trappe ronde au pôle opposé (en bas derrière au repos : on la voit passer quand la boule roule), et son loquet
LID_R = 0.11
lid_d = rolldir(PHI_N + 180)
parts.append(K.torus('BouleTrappe', tuple(Vector(BALL_C) + lid_d * math.sqrt(BALL_R ** 2 - LID_R ** 2)), LID_R, 0.012, SEAM,
                     rot_deg=(PHI_N + 180, 0, 0), seg=24))
latch_d = rolldir(PHI_N + 180 - 19)
latch = K.box('BouleLoquet', (0, 0, 0), (0.05, 0.03, 0.02), SEAM)
parts.append(place(latch, tuple(Vector(BALL_C) + latch_d * (BALL_R + 0.006)), tuple(latch_d)))
# deux rangées de fentes d'aération : sur le dessus et dessous ; avec la couture et la trappe, la rotation se lit
for k, phi in enumerate((-10, 170)):
    d = rolldir(phi)
    u = d.cross(Vector((1, 0, 0))).normalized()
    for j in (-1, 0, 1):
        r = (d + u * 0.12 * j).normalized()
        slot = K.box(f'BouleFente{k}{j}', (0, 0, 0), (0.13 - 0.035 * abs(j), 0.02, 0.012), VENT)
        parts.append(place(slot, tuple(Vector(BALL_C) + r * (BALL_R + 0.002)), tuple(r)))
# deux reflets en croissant, en haut à gauche
parts.append(glint('BouleReflet0', (0.45, -0.55, 0.7), math.radians(22), math.radians(55), math.radians(3.2), GLINT))
parts.append(glint('BouleReflet1', (0.45, -0.55, 0.7), math.radians(30), math.radians(22), math.radians(1.6), GLINT))
join(ball, parts)
ball.data.name = 'BouleMaillage'
# origine au centre de la boule (le jeu la fait tourner sur elle-même)
ball.data.transform(Matrix.Translation(-Vector(BALL_C)))
ball.location = tuple(BALL_C)
K.activate(ball)
bpy.ops.object.shade_smooth()

# --- les étoiles qui tournent autour de la tête quand il est sonné (os « stars », réduit à rien hors du clip Hit) ---
def star(name, c, normal, r_out, r_in, thick, m):
    n = Vector(normal).normalized()
    e1 = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
    e1 = (e1 - n * e1.dot(n)).normalized()
    e2 = n.cross(e1)
    C = Vector(c)
    verts = [tuple(C + n * thick), tuple(C - n * thick)]
    for i in range(10):
        a = i * math.pi / 5
        r = r_out if i % 2 == 0 else r_in
        p = C + (e1 * math.cos(a) + e2 * math.sin(a)) * r
        verts += [tuple(p + n * thick * 0.3), tuple(p - n * thick * 0.3)]
    faces = []
    for i in range(10):
        a, b = 2 + 2 * i, 2 + 2 * ((i + 1) % 10)
        faces += [(0, b, a), (1, a + 1, b + 1), (a, b, b + 1, a + 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    K.S['scene'].collection.objects.link(o)
    me.materials.append(m)
    # faces tournées vers l'extérieur
    for p in me.polygons:
        if p.normal.dot(Vector(p.center) - C) < 0:
            p.flip()
    return o


STAR_C = V(0, -0.06, 0.69)
STAR_MAT = K.mat('Etoile', '#ffe14a', rough=0.3, emit='#ffcc22')
STARS = []
for k in range(4):
    a = k * math.pi / 2 + 0.4
    d = Vector((math.cos(a), math.sin(a), 0))
    STARS.append(star(f'Etoile{k}', tuple(Vector(STAR_C) + d * 0.135 + Vector((0, 0, 0.02 * (k % 2)))), tuple(d), 0.035, 0.015, 0.01, STAR_MAT))
STARS = [join(STARS[0], STARS[1:])]
STARS[0].name = 'Etoiles'

# --- squelette ------------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0.04, 0.14), (0, 0.0, 0.27))
K.bone('spine', (0, 0.0, 0.27), (0, -0.05, 0.385), 'root', True)
K.bone('head', (0, -0.05, 0.385), (0, -0.07, 0.62), 'spine', True)
K.bone('stars', tuple(STAR_C), tuple(STAR_C + V(0, 0, 0.06)), 'head')
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
K.attach(STARS[0], 'stars')


# --- cuisson des animations (avec échelle par os : joues qui gonflent, pupilles qui rétrécissent) ---------------
SC_BONES = ['cheekL', 'cheekR', 'eyeL', 'eyeR', 'stars']


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
            pb['stars'].scale = (0.001, 0.001, 0.001)       # les étoiles n'existent que dans Hit
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
def leg(fk, s, lean, a, toe=0.0):
    """jambe arrière : a = angle de la cuisse dans le monde (+ = vers l'arrière), le bassin étant penché de lean ;
    le pied reste à plat (toe > 0 : il relève les orteils)"""
    fk['thigh' + s] = [('x', a - lean)]
    fk['foot' + s] = [('x', -a - toe)]


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
        leg(fk, s, -6, -4)
    return P(fk, root=(0, 0.01, 0.004 * wave(t, 2)), sc=puff(0.05 * g))


def walk(t):
    # il trottine sur place au fond de la boule, content : jambes et pattes en diagonale
    lean = 12
    fk = {'root': [('x', lean)], 'spine': [('x', 6), ('y', 4 * wave(t, 1))],
          'head': [('x', -14), ('z', 6 * wave(t, 1)), ('y', -4 * wave(t, 1))],
          'earL': [('x', -8 * hop(t, 2))], 'earR': [('x', -8 * hop(t, 2))],
          'whiskL': [('z', 6 * wave(t, 2))], 'whiskR': [('z', -6 * wave(t, 2))]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        ph = K.TAU * (t + o)
        leg(fk, s, lean, 26 * math.sin(ph), 28 * max(0.0, -math.cos(ph)))
        a = 'R' if s == 'L' else 'L'
        fk['arm' + a] = [('x', -28 * math.sin(ph) - 18 * max(0.0, -math.cos(ph)))]
        fk['hand' + a] = [('x', -25 * max(0.0, -math.cos(ph)))]
    return P(fk, root=(0, 0, 0.016 * hop(t, 2)), sc=puff(0.04 * hop(t, 2)))


def run(t):
    # il pédale comme un dératé : penché en avant, oreilles plaquées, joues qui ballottent, pattes en moulinet
    lean = 20
    fk = {'root': [('x', lean)], 'spine': [('x', 10)], 'head': [('x', -24 + 4 * wave(t, 6)), ('y', 3 * wave(t, 3))],
          'earL': [('x', -55), ('y', 12)], 'earR': [('x', -55), ('y', -12)],
          'whiskL': [('z', 22 + 8 * wave(t, 6))], 'whiskR': [('z', -22 - 8 * wave(t, 6))],
          'eyeL': [('x', -8)], 'eyeR': [('x', -8)]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        ph = K.TAU * (3 * t + o)
        leg(fk, s, lean, 42 * math.sin(ph), 40 * max(0.0, -math.cos(ph)))
        a = 'R' if s == 'L' else 'L'
        fk['arm' + a] = [('x', -50 - 40 * math.sin(ph))]
        fk['hand' + a] = [('x', -20 - 40 * max(0.0, -math.cos(ph)))]
    return P(fk, root=(0, -0.015, 0.008 + 0.018 * hop(t, 6)), sc=puff(0.14 + 0.06 * wave(t, 6)))


def warn(t):
    # il se frotte les pattes, l'œil fou (pupilles en tête d'épingle qui louchent), ramassé prêt à foncer
    e = min(1.0, t / 0.35)
    rub = wave(t, 4)
    lean = 18 * e
    fk = {'root': [('x', lean)], 'spine': [('x', 4 * e)], 'head': [('x', -16 * e), ('y', 6 * wave(t, 2) * e)],
          'earL': [('x', -30 * e)], 'earR': [('x', -30 * e)],
          'eyeL': [('z', -14 * e), ('x', -12 * e)], 'eyeR': [('z', -10 * e), ('x', 14 * e)],
          'whiskL': [('z', 15 * e * wave(t, 8))], 'whiskR': [('z', -15 * e * wave(t, 8))]}
    for s, sx in (('L', 1), ('R', -1)):
        k = rub if s == 'L' else -rub
        fk['arm' + s] = [('x', (-62 + 14 * k) * e), ('z', sx * -42 * e)]
        fk['hand' + s] = [('x', -20 * e), ('z', sx * (-30 + 10 * k) * e)]
        leg(fk, s, lean, 14 * e, 0)
    return P(fk, root=(0, 0.015 * e, 0.006 * e), sc={**puff(0.1 * e), **pupils(1 - 0.5 * e)})


def hit(t):
    # sonné : la tête décrit des ronds, le corps tangue à contretemps, les yeux tournent en spirale, des étoiles
    a = K.TAU * t
    b = K.TAU * 2 * t
    lean = 4
    fk = {'root': [('x', lean), ('y', 6 * math.sin(a))], 'spine': [('y', 6 * math.sin(a)), ('x', 5 * math.cos(a))],
          'head': [('x', 14 * math.cos(a)), ('y', -16 * math.sin(a)), ('z', 6 * math.sin(a))],
          'earL': [('y', 25), ('x', 10 * math.sin(b))], 'earR': [('y', -25), ('x', 10 * math.sin(b))],
          'eyeL': [('z', 28 * math.cos(b)), ('x', 28 * math.sin(b))], 'eyeR': [('z', -28 * math.cos(b)), ('x', 28 * math.sin(b))],
          'whiskL': [('z', -15)], 'whiskR': [('z', 15)], 'stars': [('z', 360 * 2 * t)]}
    for s, sx in (('L', 1), ('R', -1)):
        fk['arm' + s] = [('x', 10 + 8 * math.sin(a + (0 if s == 'L' else 2))), ('y', sx * 25)]
        fk['hand' + s] = [('x', 20)]
        leg(fk, s, lean, 5 * sx * math.sin(a))
        fk['thigh' + s].append(('y', -6 * math.sin(a)))
    return P(fk, root=(0.012 * math.sin(a), 0, 0.014), sc={**pupils(0.85), 'stars': (1, 1, 1)})


def dance(t):
    # il se dandine : les fesses d'un côté, la tête de l'autre, une patte en l'air à chaque temps, petits sauts
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
    for s, sx in (('L', 1), ('R', -1)):
        leg(fk, s, 0, 0, 20 * b)
        fk['thigh' + s].append(('y', 10 * side))
    return P(fk, root=(0.02 * side, 0, 0.004 + 0.03 * b), sc=puff(0.06 * b))


bake([('Idle', 60, idle), ('Walk', 20, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)])



def check_inside():
    """distance maximale des sommets du hamster au centre de la boule, clip par clip"""
    arm = K.S['arm']
    ad = arm.animation_data
    C = Vector(BALL_C)
    for tr in ad.nla_tracks:
        tr.mute = True
    for tr in ad.nla_tracks:
        act = tr.strips[0].action
        ad.action = act
        ad.action_slot = act.slots[0]
        worst, wf = 0.0, 0
        for f in range(0, int(tr.strips[0].frame_end) + 1):
            K.S['scene'].frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            ev = BODY.evaluated_get(dg)
            me = ev.to_mesh()
            ds = [((ev.matrix_world @ v.co - C).length, i) for i, v in enumerate(me.vertices)]
            dmax, vi = max(ds)
            pos = tuple(round(x, 2) for x in (ev.matrix_world @ me.vertices[vi].co))
            ev.to_mesh_clear()
            if dmax > worst:
                worst, wf, wv = dmax, f, (TAG[vi], pos)
        K.log(f'{tr.name}: le hamster va jusqu’à {worst:.3f} du centre (image {wf}, {wv}) ; paroi intérieure à {BALL_R - 0.012:.3f}')
    ad.action = None
    for tr in ad.nla_tracks:
        tr.mute = False
    K.S['scene'].frame_set(0)


K.S['arm'].location.z += 0.012
check_inside()
EXTRA = [] if not os.environ.get('HAMSTER_DEBUG') else [
    (f'dbg_run{f}', 'Run', f, (1.6, -0.5, 0.55), (0, 0, 0.4)) for f in (0, 2, 4, 6)] + [
    (f'dbg_hit{f}', 'Hit', f, (0.5, -1.5, 0.9), (0, 0, 0.45)) for f in (0, 8, 15)] + [
    (f'dbg_warn{f}', 'Warn', f, (0.5, -1.4, 0.6), (0, 0, 0.42)) for f in (4, 10)] + [
    ('dbg_iso', 'Walk', 0, (1.6, -1.6, 2.0), (0, 0, 0.35))]
K.preview(EXTRA + [
    ('face', 'Idle', 0, (0.25, -2.4, 0.75), (0, 0, 0.4)),
    ('troisquarts', 'Walk', 0, (1.7, -1.8, 1.3), (0, 0, 0.38)),
    ('jeu', 'Run', 4, (1.7, -1.9, 2.3), (0, 0, 0.36)),
    ('visage', 'Idle', 0, (0.15, -1.25, 0.55), (0, 0, 0.45)),
    ('moustaches', 'Idle', 15, (0.6, -1.4, 0.7), (0, 0, 0.42)),
    ('course', 'Run', 4, (2.0, -0.6, 0.7), (0, 0, 0.38)),
    ('alerte', 'Warn', 16, (0.6, -1.5, 0.75), (0, 0, 0.42)),
    ('sonne', 'Hit', 8, (0.5, -1.5, 0.75), (0, 0, 0.42)),
    ('danse', 'Dance', 8, (0.4, -1.8, 0.8), (0, 0, 0.42)),
], size=300 if EXTRA else 560)
# la boule qui roule (le jeu la fait tourner autour de son axe X) : aperçu avec un quart de tour
ball.rotation_euler = (math.radians(75), 0, 0)
K.preview([('roule', 'Run', 8, (1.7, -1.9, 2.3), (0, 0, 0.36))], size=300 if EXTRA else 560)
ball.rotation_euler = (0, 0, 0)
K.export()
