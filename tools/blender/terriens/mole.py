# La taupe chapardeuse : taupe de velours brun, gros nez rose, petits yeux plissés de filou, casque de chantier jaune
# avec sa lampe, énormes pattes avant à griffes, et un petit sac de butin. Elle file sous terre (on ne voit que la butte
# qui avance), surgit au contact, chaparde un cadeau et se sauve.
#   Blender -b -P tools/blender/terriens/mole.py -- public/models/terriens/mole.glb [dossier_aperçus]
# Clips : Idle (renifle), Walk / Run (creuse : les pattes avant moulinent), Warn (sort la tête, renifle frénétiquement),
# Hit (ricane en serrant son sac), Dance (se dandine).
#
# Pièces pour le code :
#   « Butte » : la butte de terre, objet à part (pas lié au squelette), origine au sol au centre (0, 0, 0) : elle reste
#               au sol pendant que le jeu enfonce la taupe (on peut l'agiter : échelle en hauteur, rotation sur Y).
#   « Rig »   : le squelette (os racine « root ») qui porte la taupe et tous ses accessoires : c'est lui qu'on descend
#               pour l'enfoncer sous terre (−0,72 : tout est caché ; −0,47 : le haut du casque pointe dans le trou de la butte).
#   « Butin » : le sac de butin, tenu dans la patte droite (os handR) ; à n'afficher que quand elle a volé un cadeau.
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
OUT = argv[0] if argv else '/tmp/mole.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('mole', OUT, PREVIEW)

# --- proportions ------------------------------------------------------------------------------------------------
HEAD_C = V(0, -0.06, 0.465)
HEAD_R = V(0.135, 0.13, 0.115)
SH = V(0.145, -0.04, 0.37)      # épaule gauche
EL = V(0.225, -0.1, 0.3)        # coude
WR = V(0.215, -0.205, 0.35)     # poignet : avant-bras relevé devant la poitrine
PALM = Vector((0.42, -0.88, 0.22)).normalized()    # la paume regarde devant (un peu dehors)
_f = Vector((0.15, -0.4, -0.9))
FING = (_f - PALM * _f.dot(PALM)).normalized()      # les mains pendent, doigts vers le bas (pose de la taupe qui quémande)
UPH = FING.cross(PALM).normalized()                 # axe en travers de la main
HD = V(*(Vector(WR) + FING * 0.15))                 # bout de la patte


def mx(v, sx):
    """symétrique d'un vecteur (côté droit : sx = -1)"""
    return Vector((v[0] * sx, v[1], v[2]))


HIP = V(0.1, 0.04, 0.13)
ANK = V(0.11, 0.0, 0.05)
TOE = V(0.11, -0.11, 0.025)

body = [
    # un gros corps en poire, tout en velours
    ell('body', (0, 0.03, 0.24), (0.2, 0.185, 0.21), k=0.06),
    ell('body', (0, -0.01, 0.37), (0.165, 0.15, 0.12), k=0.07),
    ell('belly', (0, -0.07, 0.22), (0.15, 0.12, 0.15), k=0.05),
    # la tête fondue dans le corps (pas de cou), le long museau et le gros nez rose
    ell('head', tuple(HEAD_C), tuple(HEAD_R), k=0.06),
    cone('snout', (0, -0.15, 0.452), (0, -0.27, 0.425), 0.066, 0.036, k=0.04),
    ell('nose', (0, -0.3, 0.433), (0.056, 0.046, 0.044), k=0.025),
    ell('mouth', (0, -0.222, 0.4), (0.042, 0.04, 0.014), k=0.012, op='sub'),
    # petite queue rose
    cone('tail', (0, 0.19, 0.12), (0, 0.26, 0.15), 0.025, 0.012, k=0.02),
]
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('arm', tuple(SH * m), tuple(EL * m), 0.06, 0.05, k=0.04))
    body.append(cone('arm', tuple(EL * m), tuple(WR * m), 0.05, 0.045, k=0.03))
    # la grosse patte-pelle : un disque rose, paume vers l'avant
    Rh = np.array([list(mx(PALM, sx)), list(mx(FING, sx)), list(mx(UPH, sx))]).T   # colonnes : axes locaux
    c = Vector(WR * m) + mx(FING, sx) * 0.068
    body.append(ell('paw', tuple(c), (0.034, 0.074, 0.092), k=0.03, R=Rh))
    body.append(cone('leg', tuple(HIP * m), tuple(ANK * m), 0.06, 0.04, k=0.04))
    body.append(ell('foot', tuple(((ANK + TOE) / 2 + V(0, 0, -0.012)) * m), (0.045, 0.07, 0.024), k=0.02))

BROWN, BROWN_L, BROWN_D = srgb('#5e3b2b'), srgb('#80563f'), srgb('#47291d')
PINK, PINK_D = srgb('#ff8fb4'), srgb('#e86a96')
COL = {'default': BROWN, 'body': BROWN, 'belly': BROWN_L, 'head': BROWN, 'snout': srgb('#8a5a48'), 'nose': srgb('#ff6f9e'),
       'tail': PINK, 'arm': BROWN, 'paw': PINK, 'leg': BROWN, 'foot': PINK}


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # le museau passe du brun au rose vers le bout
    sn = tag == 'snout'
    k = np.clip((-y[sn] - 0.17) / 0.1, 0, 1)[:, None]
    col[sn] = col[sn] * (1 - k) + PINK_D * k
    # le velours : plus clair sur le dessus (reflet), plus sombre dans le dos
    top = np.isin(tag, ('body', 'head')) & (nor[:, 2] > 0.75)
    col[top] = col[top] * 0.6 + BROWN_L * 0.4
    back = np.isin(tag, ('body',)) & (nor[:, 1] > 0.6)
    col[back] = BROWN_D
    # la bouche creusée sous le museau : rouge sombre
    q = (co - V(0, -0.222, 0.4)) / V(0.042, 0.04, 0.014)
    col[(np.linalg.norm(q, axis=1) < 1.5) & (tag == 'snout')] = srgb('#4a1420')
    # les doigts des pieds
    toes = (tag == 'foot') & (y < -0.07)
    col[toes & (np.abs(np.abs(x) - 0.11) % 0.024 < 0.005)] = PINK_D


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.42, -0.4, 0.0), (0.42, 0.32, 0.62), vox=0.0045)
K.decimate(BODY, 7500)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Taupe', rough=0.7, spec=0.3))


# --- petits outils ------------------------------------------------------------------------------------------------
def tube(name, pts, r, m, taper=True, ring=6):
    """tube le long d'une suite de points (rayon qui s'affine aux deux bouts)"""
    pts = [Vector(p) for p in pts]
    verts, faces = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        a = d.cross(Vector((0, 0, 1)))
        if a.length < 1e-3:
            a = d.cross(Vector((1, 0, 0)))
        a.normalize()
        b = d.cross(a)
        rr = r * (math.sin(math.pi * (0.15 + 0.7 * i / (n - 1))) if taper else 1)
        for j in range(ring):
            t = K.TAU * j / ring
            verts.append(tuple(p + (a * math.cos(t) + b * math.sin(t)) * rr))
    for i in range(n - 1):
        for j in range(ring):
            a0, a1 = i * ring + j, i * ring + (j + 1) % ring
            faces.append((a0, a1, a1 + ring, a0 + ring))
    faces.append(tuple(range(ring))[::-1])
    faces.append(tuple(range((n - 1) * ring, n * ring)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    K.S['scene'].collection.objects.link(o)
    me.materials.append(m)
    K.activate(o)
    bpy.ops.object.shade_smooth()
    return o


def on_head(x, z, out=0.003):
    """point de la surface avant de la tête, à (x, z)"""
    q = 1 - (x / HEAD_R[0]) ** 2 - ((z - HEAD_C[2]) / HEAD_R[2]) ** 2
    y = HEAD_C[1] - HEAD_R[1] * math.sqrt(max(q, 0.0))
    return Vector((x, y - out, z))


def join(target, others):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in others:
        o.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return target


def solid_clip(name, prims, lo, hi, colors, faces, vox, clip, rough=0.8, extra=None):
    ob = K.sdf_mesh(name, prims, lo, hi, vox=vox, clip=clip)
    K.decimate(ob, faces, symmetric=False)
    K.paint(ob, prims, colors, extra)
    ob.data.materials.append(K.vc_material(name + 'Mat', rough=rough, spec=0.15))
    return ob


# --- les yeux plissés (deux arcs noirs, l'air rusé) -----------------------------------------------------------------
black = K.mat('Pupille', '#1a1033', rough=0.3)
EYES = []
for sx, n in ((1, 'OeilG'), (-1, 'OeilD')):
    cx, cz = 0.074 * sx, 0.522
    pts = []
    for i in range(9):
        a = math.radians(15 + 150 * i / 8)
        x = cx + 0.03 * math.cos(a)
        z = cz + 0.018 * math.sin(a) - 0.005 * sx * math.cos(a)   # un peu de travers : œil de filou
        pts.append(on_head(x, z, 0.008))
    EYES.append(tube(n, pts, 0.0095, black))
    # une petite paupière inférieure qui remonte (les yeux qui se plissent)
    pts = [on_head(cx + 0.022 * math.cos(math.radians(a)), cz - 0.013 - 0.004 * math.sin(math.radians(a)), 0.007)
           for a in range(200, 341, 35)]
    EYES.append(tube(n + 'Pli', pts, 0.004, K.mat('Pli', '#3a2018', rough=0.6)))

# --- dents, moustaches -------------------------------------------------------------------------------------------
teeth = K.mat('Dents', '#fffdf0', rough=0.2)
TEETH = [K.box('DentG', (0.0095, -0.252, 0.398), (0.017, 0.01, 0.026), teeth),
         K.box('DentD', (-0.0095, -0.252, 0.398), (0.017, 0.01, 0.026), teeth)]
whisk = K.mat('Moustache', '#e8d8c8', rough=0.5)
WHISK = []
for sx in (1, -1):
    for k, dz in enumerate((0.022, 0.0, -0.02)):
        a = Vector((0.03 * sx, -0.262, 0.432 + dz * 0.3))
        b = Vector((0.15 * sx, -0.26 + abs(dz), 0.44 + dz * 1.4))
        mid = (a + b) / 2 + Vector((0, -0.01, 0.008))
        WHISK.append(tube(f'Moustache{"GD"[sx < 0]}{k}', [a, mid, b], 0.003, whisk, ring=4))

# --- le casque de chantier jaune, sa lampe -------------------------------------------------------------------------
HAT_C = V(0, -0.05, 0.556)
hat_prims = [
    ell('dome', tuple(HAT_C), (0.145, 0.15, 0.105), k=0.02),
    ell('ridge', tuple(HAT_C + V(0, 0, 0.012)), (0.03, 0.155, 0.1), k=0.015),
    ell('brim', tuple(HAT_C + V(0, -0.025, -0.005)), (0.165, 0.185, 0.015), k=0.02),
    rbox('mount', tuple(HAT_C + V(0, -0.15, 0.04)), (0.035, 0.02, 0.03), r=0.01, k=0.01),
]
HAT_COL = {'default': srgb('#ffc61a'), 'ridge': srgb('#ffd84a'), 'brim': srgb('#f2ae0a'), 'mount': srgb('#3a3a48')}
HAT = solid_clip('Casque', hat_prims, tuple(HAT_C + V(-0.2, -0.22, -0.03)), tuple(HAT_C + V(0.2, 0.2, 0.12)), HAT_COL, 1600, 0.004,
                 clip=lambda X, Y, Z: (HAT_C[2] - 0.022) - Z, rough=0.35)
LAMP_A, LAMP_B = HAT_C + V(0, -0.16, 0.045), HAT_C + V(0, -0.215, 0.05)
lamp = K.cylinder('Lampe', tuple(LAMP_A), tuple(LAMP_B), 0.036, K.mat('Metal', '#4a4a5a', rough=0.35, metal=0.6), seg=16)
lens = K.cylinder('LampeVerre', tuple(LAMP_B), tuple(LAMP_B + V(0, -0.006, 0)), 0.029, K.mat('Lumiere', '#fff6c0', rough=0.1, emit='#fff2a0'), seg=16)
lrim = K.torus('LampeBord', tuple(LAMP_B), 0.032, 0.006, K.mat('Chrome', '#c8ccd8', rough=0.25, metal=0.8), rot_deg=(90, 0, 0), seg=16)
HAT_TILT = Matrix.Translation((0, -0.04, 0.47)) @ Matrix.Rotation(math.radians(-16), 4, 'X') @ Matrix.Translation((0, 0.04, -0.47))
for o in (HAT, lamp, lens, lrim):
    o.matrix_world = HAT_TILT @ o.matrix_world

# --- les griffes (ivoire), cinq par patte avant -----------------------------------------------------------------------
claw = K.mat('Griffe', '#fff0d2', rough=0.3)
CLAWS = {'L': [], 'R': []}
for s, sx in (('L', 1), ('R', -1)):
    f, p, u = mx(FING, sx), mx(PALM, sx), mx(UPH, sx)
    base_c = Vector(WR * V(sx, 1, 1)) + f * 0.122
    for k in range(5):
        o = (k - 2) / 2
        b0 = base_c + u * (0.066 * o) - f * 0.026 * o ** 2
        tip = b0 + f * 0.07 + u * 0.022 * o + p * 0.034
        mid = b0 + f * 0.044 + u * 0.011 * o + p * 0.007
        CLAWS[s].append(tube(f'Griffe{s}{k}', [b0, mid, tip], 0.021, claw, ring=6))

# --- la butte de terre (au sol, pas liée au squelette) ---------------------------------------------------------------
mound = [ell('dirt', (0, 0, -0.04), (0.37, 0.36, 0.22), k=0.05),
         ell('hole', (0, -0.01, 0.2), (0.09, 0.09, 0.07), k=0.04, op='sub')]
rng = np.random.default_rng(7)
for k in range(11):
    a = k * K.TAU / 11 + rng.uniform(-0.2, 0.2)
    r = rng.uniform(0.18, 0.33)
    z = 0.17 * math.sqrt(max(0.0, 1 - (r / 0.37) ** 2)) - 0.01
    sz = rng.uniform(0.035, 0.06)
    mound.append(ell('clod' if k % 4 else 'stone', (r * math.cos(a), r * math.sin(a), z), (sz, sz * 0.9, sz * 0.75), k=0.02))
DIRT_COL = {'default': srgb('#7a4a26'), 'dirt': srgb('#7a4a26'), 'clod': srgb('#5c341a'), 'stone': srgb('#9a8f86')}


def dirt_extra(co, nor, col, tag):
    # le trou sombre au sommet, de la terre plus claire sur les flancs
    r = np.hypot(co[:, 0], co[:, 1] + 0.01)
    col[(r < 0.1) & (co[:, 2] > 0.1)] = srgb('#2a160c')
    side = (tag == 'dirt') & (nor[:, 2] < 0.6) & (r > 0.12)
    col[side] = srgb('#8c5a30')
    rnd = np.sin(co[:, 0] * 91) * np.sin(co[:, 1] * 77) * np.sin(co[:, 2] * 53)
    col[(tag == 'dirt') & (rnd > 0.55)] = srgb('#6a3e1e')


BUTTE = solid_clip('Butte', mound, (-0.42, -0.42, -0.02), (0.42, 0.42, 0.24), DIRT_COL, 1800, 0.006,
                   clip=lambda X, Y, Z: -Z, rough=0.95, extra=dirt_extra)
BUTTE.data.name = 'ButteMaillage'

# --- le sac de butin (construit tel qu'il doit être tenu dans la pose « Hit », puis ramené au repos) -----------------
SACK_C = V(-0.065, -0.29, 0.2)
sack_prims = [
    ell('sack', tuple(SACK_C), (0.075, 0.068, 0.07), k=0.03),
    ell('sack', tuple(SACK_C + V(0, 0.005, -0.026)), (0.08, 0.072, 0.052), k=0.04),
    cone('neck', tuple(SACK_C + V(0, 0, 0.052)), tuple(SACK_C + V(-0.01, 0, 0.088)), 0.036, 0.027, k=0.02),
    ell('tie', tuple(SACK_C + V(-0.006, 0, 0.073)), (0.038, 0.038, 0.012), k=0.008),
    rbox('gift', tuple(SACK_C + V(-0.01, 0.0, 0.11)), (0.036, 0.032, 0.032), r=0.006, k=0.006, R=K.rot(0, -18, 20)),
    ell('bow', tuple(SACK_C + V(-0.024, -0.004, 0.148)), (0.027, 0.011, 0.014), k=0.006, R=K.rot(0, -18, 20)),
    ell('patch', tuple(SACK_C + V(-0.035, -0.058, -0.01)), (0.025, 0.011, 0.023), k=0.01),
]
SACK_COL = {'default': srgb('#c99a5a'), 'sack': srgb('#c99a5a'), 'neck': srgb('#b88a4a'), 'tie': srgb('#e8334a'),
            'gift': srgb('#ff6ad5'), 'bow': srgb('#ffe14a'), 'patch': srgb('#8a6a3a')}


def sack_extra(co, nor, col, tag):
    # le ruban jaune du cadeau, la couture du sac
    g = tag == 'gift'
    col[g & ((np.abs(co[:, 0] - SACK_C[0] + 0.01) < 0.007) | (np.abs(co[:, 1] - SACK_C[1]) < 0.008))] = srgb('#ffe14a')
    s = tag == 'sack'
    col[s & (np.abs(co[:, 0] - SACK_C[0]) < 0.004) & (co[:, 1] > SACK_C[1])] = srgb('#a07a40')


BUTIN = K.sdf_mesh('Butin', sack_prims, tuple(SACK_C + V(-0.13, -0.12, -0.1)), tuple(SACK_C + V(0.13, 0.12, 0.2)), vox=0.0035)
K.decimate(BUTIN, 1400, symmetric=False)
K.paint(BUTIN, sack_prims, SACK_COL, sack_extra)
BUTIN.data.materials.append(K.vc_material('ButinMat', rough=0.6))
BUTIN.data.name = 'ButinMaillage'

# --- squelette ------------------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0.03, 0.14), (0, 0.01, 0.3))
K.bone('spine', (0, 0.01, 0.3), (0, -0.03, 0.42), 'root', True)
K.bone('head', (0, -0.03, 0.42), (0, -0.06, 0.62), 'spine', True)
K.bone('snout', (0, -0.14, 0.452), (0, -0.33, 0.428), 'head')
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    K.bone('thigh' + s, HIP * m, ANK * m, 'root')
    K.bone('foot' + s, ANK * m, TOE * m, 'thigh' + s, True)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg == 'head':
        return ['head', 'spine'] if p[2] < 0.43 else ['head']
    if tg in ('snout', 'nose'):
        return ['head', 'snout'] if p[1] > -0.2 else ['snout']
    if tg in ('body', 'belly'):
        return ['root', 'spine'] + (['head'] if p[2] > 0.42 else []) + (['arm' + s] if abs(p[0]) > 0.13 and p[2] > 0.3 else [])
    if tg == 'arm':
        return ['spine', 'arm' + s, 'forearm' + s]
    if tg == 'paw':
        return ['forearm' + s, 'hand' + s] if np.linalg.norm(p - WR * V(1 if s == 'L' else -1, 1, 1)) < 0.03 else ['hand' + s]
    if tg == 'leg':
        return ['root', 'thigh' + s]
    if tg == 'foot':
        return ['thigh' + s, 'foot' + s]
    return ['root']


K.skin(BODY, CO, TAG, allowed)
for o in EYES + [HAT, lamp, lens, lrim]:
    K.attach(o, 'head')
for o in TEETH + WHISK:
    K.attach(o, 'snout')
for s in ('L', 'R'):
    for o in CLAWS[s]:
        K.attach(o, 'hand' + s)


# --- animations -----------------------------------------------------------------------------------------------------
def leg(fk, s, lean, a, toe=0.0):
    """jambe : a = angle de la cuisse dans le monde (+ = vers l'arrière), bassin penché de lean ; pied à plat"""
    fk['thigh' + s] = [('x', a - lean)]
    fk['foot' + s] = [('x', -a - toe)]


def clutch(fk, k=1.0, sh=0.0):
    """les deux pattes serrent le sac contre la poitrine (k : 0 → 1)"""
    for s, sx in (('L', 1), ('R', -1)):
        fk['arm' + s] = [('z', sx * -38 * k), ('x', (-8 + 5 * sh) * k)]
        fk['forearm' + s] = [('z', sx * -15 * k)]
        fk['hand' + s] = [('z', sx * -35 * k), ('x', 10 * k)]


def sniff(t, n, amp):
    return {'snout': [('z', amp * wave(t, n)), ('x', -amp * 0.6 * hop(t, n))]}


def idle(t):
    # elle renifle l'air : trois petits coups de museau, la tête qui se lève, pattes repliées sur le sac
    burst = max(0.0, math.sin(K.TAU * t)) ** 2           # les reniflements arrivent par salves
    look = wave(t, 1, 0.3)
    fk = {'root': [('x', -4)], 'spine': [('x', -6 + 2 * wave(t, 2)), ('y', 3 * look)],
          'head': [('x', -10 * burst), ('z', 12 * look)],
          'snout': [('z', 10 * burst * wave(t, 8)), ('x', -12 * burst - 4 * burst * hop(t, 8))]}
    clutch(fk, 1.0)
    for s in ('L', 'R'):
        leg(fk, s, -4, 0)
    return pose(fk, root=(0, 0, 0.006 * wave(t, 2)))


def dig(t, n, amp, lean):
    """elle creuse : les pattes avant moulinent en brasse (en avant, en haut, puis dehors et en arrière)"""
    # buste peu penché : la tête (et le casque) reste au-dessus de la butte quand le jeu l'enfonce à moitié
    fk = {'root': [('x', lean)], 'spine': [('x', lean * 0.4), ('z', 8 * wave(t, n))],
          'head': [('x', -lean * 0.8), ('z', -6 * wave(t, n))], 'snout': [('z', 8 * wave(t, 2 * n)), ('x', 6)]}
    for s, sx, o in (('L', 1, 0.0), ('R', -1, 0.5)):
        ph = K.TAU * (n * t + o)
        fk['arm' + s] = [('x', -amp * (0.55 + 0.45 * math.sin(ph))), ('z', sx * amp * 0.55 * math.cos(ph))]
        fk['forearm' + s] = [('x', -0.4 * amp * max(0.0, math.sin(ph))), ('z', sx * 25 * math.cos(ph))]
        fk['hand' + s] = [('x', 20 * math.cos(ph)), ('y', sx * 15)]
        leg(fk, s, lean, 18 * math.sin(ph + 0.5 * math.pi * sx))
    return fk


def walk(t):
    fk = dig(t, 1, 75, 12)
    return pose(fk, root=(0, 0, 0.012 * hop(t, 2)))


def run(t):
    fk = dig(t, 2, 100, 18)
    return pose(fk, root=(0, 0, 0.018 * hop(t, 4)))


def warn(t):
    # elle sort la tête, se dresse, et renifle frénétiquement de droite et de gauche
    e = min(1.0, t / 0.3)
    fk = {'root': [('x', -8 * e)], 'spine': [('x', -6 * e)], 'head': [('x', -18 * e), ('z', 22 * wave(t, 2) * e)],
          'snout': [('z', 14 * e * wave(t, 8)), ('x', -16 * e * hop(t, 8))]}
    clutch(fk, 0.9 * e)
    for s in ('L', 'R'):
        leg(fk, s, -8 * e, 0)
    st = 1 + 0.08 * e * (1 - 0.3 * hop(t, 4))
    return pose(fk, root=(0, 0, -0.1 + 0.1 * e), scale=(1 / math.sqrt(st), 1 / math.sqrt(st), st))


def hit(t):
    # elle ricane, épaules secouées, en serrant son sac contre elle ; la tête rentrée, de travers
    sh = wave(t, 6)
    fk = {'root': [('x', 8)], 'spine': [('x', 10 + 4 * sh), ('y', 4 * wave(t, 1))],
          'head': [('x', -2 + 6 * sh), ('y', -14), ('z', 10 * wave(t, 1))],
          'snout': [('x', -10 - 6 * hop(t, 6)), ('z', 6 * sh)]}
    clutch(fk, 1.0, sh)
    for s in ('L', 'R'):
        leg(fk, s, 8, 0)
    return pose(fk, root=(0, 0, 0.012 * hop(t, 6)))


def dance(t):
    # elle se dandine : les hanches d'un côté, la tête de l'autre, une grosse patte en l'air à chaque temps
    side = wave(t, 1)
    b = hop(t, 2)
    fk = {'root': [('y', -10 * side)], 'spine': [('y', 16 * side), ('x', -4)], 'head': [('y', -14 * side), ('x', 8 * b - 4)],
          'snout': [('z', 10 * wave(t, 4))]}
    for s, sx in (('L', 1), ('R', -1)):
        up = max(0.0, side * sx)
        fk['arm' + s] = [('y', sx * (20 + 110 * up)), ('x', -30)]
        fk['forearm' + s] = [('y', sx * 40 * up), ('x', -30 * (1 - up))]
        fk['hand' + s] = [('z', sx * 30 * wave(t, 4) * up)]
        leg(fk, s, 0, 0, 15 * b)
        fk['thigh' + s].append(('y', 10 * side))
    return pose(fk, root=(0.02 * side, 0, 0.03 * b))


# le sac est construit à l'endroit voulu dans la pose « Hit » (serré contre la poitrine) : on le ramène au repos
def pose_matrix(fn, t, bname):
    arm, pb, REST = K.S['arm'], K.S['arm'].pose.bones, K.S['REST']
    st = fn(t)
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    for b, rots in st['fk'].items():
        pb[b].rotation_quaternion = K.q_world(b, rots)
    pb['root'].location = REST['root'].to_3x3().inverted() @ Vector(st['root'])
    bpy.context.view_layer.update()
    M = (arm.matrix_world @ pb[bname].matrix) @ (arm.matrix_world @ arm.data.bones[bname].matrix_local).inverted()
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
    bpy.context.view_layer.update()
    return M


BUTIN.matrix_world = pose_matrix(hit, 0.0, 'handR').inverted() @ BUTIN.matrix_world
K.attach(BUTIN, 'handR')

K.bake([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)])

EXTRA = [] if not os.environ.get('MOLE_DEBUG') else [
    (f'dbg_dig{f}', 'Run', f, (1.6, -1.6, 1.0), (0, 0, 0.35)) for f in (0, 3, 6, 9)] + [
    (f'dbg_hit{f}', 'Hit', f, (0.5, -1.6, 0.7), (0, 0, 0.38)) for f in (0, 5)] + [
    (f'dbg_warn{f}', 'Warn', f, (0.6, -1.6, 0.7), (0, 0, 0.38)) for f in (0, 8, 16)] + [
    ('dbg_iso', 'Idle', 0, (1.6, -1.6, 2.0), (0, 0, 0.3))]
K.preview(EXTRA + [
    ('face', 'Idle', 0, (0.25, -2.2, 0.7), (0, 0, 0.36)),
    ('troisquarts', 'Idle', 20, (1.6, -1.6, 1.2), (0, 0, 0.36)),
    ('jeu', 'Hit', 5, (1.6, -1.8, 2.2), (0, 0, 0.3)),
    ('visage', 'Idle', 0, (0.15, -1.15, 0.6), (0, 0, 0.47)),
    ('creuse', 'Run', 3, (1.7, -1.3, 0.9), (0, 0, 0.34)),
    ('alerte', 'Warn', 16, (0.6, -1.7, 0.8), (0, 0, 0.38)),
    ('ricane', 'Hit', 5, (0.6, -1.6, 0.7), (0, 0, 0.38)),
    ('danse', 'Dance', 8, (0.4, -1.9, 0.8), (0, 0, 0.36)),
], size=300 if EXTRA else 560)
K.S['arm'].location.z = -0.47
K.preview([('sousterre', 'Run', 4, (1.6, -1.8, 2.0), (0, 0, 0.1))], size=300 if EXTRA else 560)
K.S['arm'].location.z = 0.0
K.export()
