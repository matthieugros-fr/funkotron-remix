# Le croque-mitaine : grand monstre poilu, voûté, violet très sombre, longs bras qui traînent jusqu'au sol, griffes
# crochues, gueule pleine de crocs, yeux jaunes qui luisent. Dans le jeu il est presque invisible de loin : le code
# fait varier l'opacité de la matière `Fourrure`, seuls les yeux (`Lueur`, émissive) restent visibles.
#   Blender -b -P tools/blender/terriens/boogey.py -- public/models/terriens/boogey.glb [dossier_aperçus]
# Clips : Idle (se balance, respire lourdement, griffes qui pianotent), Walk (rôde, voûté), Run (se jette en avant,
# bras tendus), Warn (se dresse de toute sa taille, bras écartés : « BOU ! »), Hit (rire grave), Dance (se dandine).
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import numpy as np
import bpy
import openvdb as vdb
from mathutils import Vector
import kit as K
from kit import V, ell, cone, srgb, pose

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/boogey.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('boogey', OUT, PREVIEW)
# volumes de travail dans un dossier à soi (d'autres terriens peuvent être modelés en même temps)
K.S['work'] = os.path.join(os.path.dirname(os.path.abspath(PREVIEW)) if PREVIEW else '/tmp', 'work_boogey')
os.makedirs(K.S['work'], exist_ok=True)
TAU = math.tau


# =====================================================================================================
# Maillage rapide : chaque volume n'est évalué que dans sa boîte englobante (même résultat que K.sdf_mesh)
# =====================================================================================================
def _bbox(p, m):
    if p['kind'] == 'ell':
        e = np.sqrt(((p['R'] * p['r'][None, :]) ** 2).sum(1))
        return p['c'] - e - m, p['c'] + e + m
    if p['kind'] == 'box':
        e = np.abs(p['R']) @ p['h']
        return p['c'] - e - m, p['c'] + e + m
    r = max(p['r1'], p['r2'])
    return np.minimum(p['a'], p['b']) - r - m, np.maximum(p['a'], p['b']) + r + m


def mesh(name, prims, lo, hi, vox=0.006, clip=None, smooth=2):
    lo = np.floor(V(*lo) / vox) * vox
    n = np.ceil((V(*hi) - lo) / vox).astype(int) + 1
    ax = [lo[i] + np.arange(n[i]) * vox for i in range(3)]
    d = np.ones(tuple(n), dtype=np.float32)
    for p in prims:
        a, b = _bbox(p, p['k'] + 4 * vox)
        i0 = np.clip(np.floor((a - lo) / vox).astype(int), 0, n)
        i1 = np.clip(np.ceil((b - lo) / vox).astype(int) + 1, 0, n)
        if np.any(i1 <= i0):
            continue
        sl = tuple(slice(int(i0[i]), int(i1[i])) for i in range(3))
        dp = K.sd_prim(p, ax[0][sl[0]][:, None, None], ax[1][sl[1]][None, :, None], ax[2][sl[2]][None, None, :])
        blk = d[sl]
        d[sl] = K.smin(blk, dp, p['k']) if p['op'] == 'add' else -K.smin(-blk, dp, p['k'])
    if clip is not None:
        d = np.maximum(d, clip(ax[0][:, None, None], ax[1][None, :, None], ax[2][None, None, :]))
    band = np.where(d > vox * 3, 0.0, -d).astype(np.float32)
    g = vdb.FloatGrid()
    g.copyFromArray(band, ijk=tuple(int(round(c / vox)) for c in lo))
    g.name = 'density'
    g.transform = vdb.createLinearTransform(voxelSize=vox)
    path = os.path.join(K.S['work'], f'vol_{name}.vdb')
    vdb.write(path, grids=[g])
    bpy.ops.object.volume_import(filepath=path)
    vo = bpy.context.active_object
    ob = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    K.S['scene'].collection.objects.link(ob)
    md = ob.modifiers.new('V', 'VOLUME_TO_MESH')
    md.object = vo
    md.grid_name = 'density'
    md.threshold = 0.00001
    md.resolution_mode = 'GRID'
    K.apply_mod(ob, 'V')
    K.remove(vo)
    if smooth:
        sm = ob.modifiers.new('S', 'SMOOTH')
        sm.factor = 0.5
        sm.iterations = smooth
        K.apply_mod(ob, 'S')
    K.activate(ob)
    bpy.ops.object.shade_smooth()
    return ob


def ss(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def along(d):
    """matrice de rotation dont l'axe z local suit la direction d"""
    return np.array(Vector(tuple(d)).normalized().to_track_quat('Z', 'Y').to_matrix(), dtype=np.float64)


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / max(np.linalg.norm(v), 1e-9)


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


# =====================================================================================================
# Proportions : voûté, la tête en avant sous la bosse, les bras jusqu'au sol, jambes courtes et fléchies
# =====================================================================================================
HIP_Z = 0.74
HEAD_C = V(0, -0.3, 1.62)
MOUTH_C, MOUTH_R = V(0, -0.55, 1.505), V(0.15, 0.08, 0.045)
EYE = V(0.1, -0.48, 1.635)
JAW_A, JAW_B = V(0, -0.26, 1.54), V(0, -0.56, 1.42)
SH, EL, WR, HD = V(0.4, -0.02, 1.58), V(0.58, -0.06, 1.04), V(0.56, -0.22, 0.46), V(0.565, -0.29, 0.3)
HIP, KNEE, ANKLE, TOE = V(0.19, 0.08, HIP_Z), V(0.24, -0.12, 0.44), V(0.24, 0.06, 0.13), V(0.25, -0.22, 0.05)
FDX = (-0.055, 0.0, 0.055)                  # écart des trois doigts (main gauche)


def fingers(sx):
    """(base, bout) des trois doigts de la main gauche (sx = 1) ou droite (sx = -1)"""
    m = V(sx, 1, 1)
    out = []
    for dx in FDX:
        b = HD * m + V(dx * sx, -0.02, -0.005)
        out.append((b, b + V(dx * 0.3 * sx, -0.075, -0.135)))
    return out


TORSO = dict(c=V(0, 0.08, 1.22), r=V(0.4, 0.34, 0.38), R=K.rot(18, 0, 0))
HUMP = dict(c=V(0, 0.18, 1.52), r=V(0.4, 0.32, 0.3), R=K.rot(25, 0, 0))
BELLY = dict(c=V(0, -0.02, 0.92), r=V(0.36, 0.32, 0.32), R=np.eye(3))
HEADE = dict(c=HEAD_C, r=V(0.23, 0.22, 0.2), R=np.eye(3))

body = [
    ell('belly', tuple(BELLY['c']), tuple(BELLY['r']), k=0.08),
    ell('fur', tuple(TORSO['c']), tuple(TORSO['r']), k=0.08, R=TORSO['R']),
    ell('hump', tuple(HUMP['c']), tuple(HUMP['r']), k=0.08, R=HUMP['R']),
    ell('scruff', (0, -0.12, 1.57), (0.24, 0.2, 0.18), k=0.07),
    ell('head', tuple(HEAD_C), tuple(HEADE['r']), k=0.05),
    ell('muzzle', (0, -0.42, 1.5), (0.2, 0.16, 0.11), k=0.05),
    ell('nose', (0, -0.565, 1.6), (0.07, 0.045, 0.04), k=0.03),
]
for sx in (1, -1):
    m = V(sx, 1, 1)
    body += [
        ell('shoulder', (0.36 * sx, 0.0, 1.56), (0.17, 0.17, 0.17), k=0.06),
        ell('brow', (0.095 * sx, -0.465, 1.703), (0.105, 0.05, 0.034), k=0.03, R=K.rot(0, -20 * sx, 0)),
        cone('ear', (0.17 * sx, -0.24, 1.74), (0.33 * sx, -0.15, 1.93), 0.06, 0.008, k=0.03),
        cone('arm', tuple(SH * m), tuple(EL * m), 0.14, 0.105, k=0.05),
        cone('forearm', tuple(EL * m), tuple(WR * m), 0.112, 0.082, k=0.04),
        ell('hand', tuple((WR + HD) / 2 * m + V(0, -0.01, 0)), (0.105, 0.09, 0.115), k=0.04, R=along((HD - WR) * m)),
        cone('leg', tuple(HIP * m), tuple(KNEE * m), 0.16, 0.115, k=0.05),
        cone('shin', tuple(KNEE * m), tuple(ANKLE * m), 0.11, 0.075, k=0.04),
        ell('foot', (0.25 * sx, -0.08, 0.07), (0.11, 0.19, 0.065), k=0.04),
    ]
    for b, t in fingers(sx):
        body.append(cone('finger', tuple(b), tuple(t), 0.042, 0.03, k=0.025))
    for dx in (-0.06, 0.0, 0.06):
        body.append(cone('toe', ((0.25 + dx) * sx, -0.19, 0.06), ((0.25 + dx * 1.2) * sx, -0.29, 0.045), 0.036, 0.03, k=0.02))
body.append(ell('mouth', tuple(MOUTH_C), tuple(MOUTH_R), k=0.015, op='sub'))

# --- la fourrure : des touffes pointues, couchées vers l'arrière et vers le bas -------------------------------
rng = np.random.default_rng(11)
TUFTS = []


def surf(e, n):
    u = rng.normal(size=(n, 3))
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    p = e['c'] + (u * e['r']) @ e['R'].T
    nr = (u / e['r']) @ e['R'].T
    return p, nr / np.linalg.norm(nr, axis=1, keepdims=True)


def sprout(tag, e, count, keep, flow, L=(0.1, 0.16), r=0.05, gap=0.085, sym=True):
    """touffes sur la surface d'un ellipsoïde : keep(p, n) choisit l'endroit, flow le sens de la mèche"""
    P, N = surf(e, 600)
    done = []
    for p, nn in zip(P, N):
        if len(done) >= count:
            break
        if (sym and p[0] < 0) or not keep(p, nn):
            continue
        if any(np.linalg.norm(p - q) < gap for q in done):
            continue
        done.append(p)
        for sx in ((1, -1) if sym else (1,)):
            m = V(sx, 1, 1)
            pp, n2 = p * m, nn * m
            d = unit(n2 + V(flow[0] * sx, flow[1], flow[2]))
            ln = rng.uniform(*L)
            TUFTS.append(cone(tag, tuple(pp - n2 * 0.03), tuple(pp - n2 * 0.03 + d * ln), r, 0.006, k=0.025))


sprout('tuft_back', HUMP, 16, lambda p, n: n[1] > 0.1 or n[2] > 0.55, (0.1, 0.5, -0.2), L=(0.12, 0.19), r=0.058, gap=0.1)
sprout('tuft_back', TORSO, 7, lambda p, n: n[1] > 0.35 and 0.92 < p[2] < 1.3, (0.0, 0.25, -0.7), L=(0.1, 0.15))
sprout('tuft_hip', BELLY, 6, lambda p, n: 0.66 < p[2] < 0.82 and n[1] > -0.4 and abs(n[0]) > 0.2, (0.2, 0.1, -1.2), L=(0.08, 0.13), r=0.045)
sprout('tuft_chest', TORSO, 5, lambda p, n: n[1] < -0.45 and 1.28 < p[2] < 1.48, (0.0, -0.3, -1.1), L=(0.1, 0.15), r=0.05, gap=0.08)
sprout('tuft_hip', BELLY, 3, lambda p, n: n[1] < 0.1 and abs(n[0]) > 0.55 and 0.78 < p[2] < 1.0, (0.3, 0.0, -1.0), L=(0.09, 0.13), r=0.045)
sprout('tuft_head', HEADE, 5, lambda p, n: n[2] > 0.6 and p[1] > -0.4, (0.0, 0.9, 0.2), L=(0.1, 0.16), r=0.045, gap=0.07)
sprout('tuft_head', HEADE, 3, lambda p, n: n[0] > 0.75 and 1.5 < p[2] < 1.64, (0.2, 0.3, -0.8), L=(0.07, 0.11), r=0.04, gap=0.06)
for sx in (1, -1):
    m = V(sx, 1, 1)
    sprout('tuft_sh', dict(c=V(0.36 * sx, 0.0, 1.56), r=V(0.17, 0.17, 0.17), R=np.eye(3)), 4,
           lambda p, n, sx=sx: n[2] > 0.15 and n[0] * sx > 0.3, (0.2 * sx, 0.3, -0.1), L=(0.1, 0.15), sym=False)
    a, b = SH * m, EL * m
    for u in (0.3, 0.6, 0.85):
        c = a + (b - a) * u
        out = unit(V(sx, 0.5, 0))
        TUFTS.append(cone('tuft_arm', tuple(c + out * 0.07), tuple(c + out * 0.07 + unit(out + V(0, 0.2, -0.9)) * 0.13), 0.05, 0.006, k=0.025))
    a, b = EL * m, WR * m
    TUFTS.append(cone('tuft_fore', tuple(a + V(0.02 * sx, 0.05, 0)), tuple(a + V(0.08 * sx, 0.2, -0.08)), 0.06, 0.006, k=0.03))   # coude
    for u, o in ((0.3, 0.9), (0.45, -0.15), (0.55, 0.9), (0.7, -0.1), (0.8, 0.9)):
        c = a + (b - a) * u
        out = unit(V(sx, o, 0))
        TUFTS.append(cone('tuft_fore', tuple(c + out * 0.05), tuple(c + out * 0.05 + unit(out + V(0, 0.3, -1.0)) * 0.12), 0.045, 0.006, k=0.025))
    for u, side in ((0.35, V(sx, 0.3, 0)), (0.7, V(sx, 0.2, 0))):
        c = HIP * m + (KNEE * m - HIP * m) * u
        TUFTS.append(cone('tuft_leg', tuple(c + unit(side) * 0.1), tuple(c + unit(side) * 0.1 + unit(side + V(0, 0.4, -0.9)) * 0.12), 0.05, 0.006, k=0.025))
    c = KNEE * m + (ANKLE * m - KNEE * m) * 0.35
    TUFTS.append(cone('tuft_leg', tuple(c + V(0, 0.08, 0)), tuple(c + V(0.03 * sx, 0.2, -0.1)), 0.045, 0.006, k=0.025))
body = body[:-1] + TUFTS + body[-1:]          # la bouche creusée en dernier
K.log(len(TUFTS), 'touffes')

FUR = srgb('#2a1838')
COL = {'default': FUR, 'fur': FUR, 'hump': srgb('#2c1a3c'), 'scruff': srgb('#2c1a3c'), 'belly': srgb('#1c1934'),
       'head': srgb('#301d40'), 'muzzle': srgb('#3a2448'), 'nose': srgb('#120a18'), 'brow': srgb('#1a0f24'),
       'ear': srgb('#2a1838'), 'shoulder': FUR, 'arm': FUR, 'forearm': FUR, 'hand': srgb('#241530'),
       'finger': srgb('#221430'), 'leg': FUR, 'shin': FUR, 'foot': srgb('#221430'), 'toe': srgb('#221430'),
       'tuft_back': srgb('#3e2758'), 'tuft_hip': srgb('#3a2552'), 'tuft_head': srgb('#3e2758'), 'tuft_sh': srgb('#3e2758'),
       'tuft_chest': srgb('#3a2552'), 'tuft_arm': srgb('#3a2552'), 'tuft_fore': srgb('#3a2552'), 'tuft_leg': srgb('#3a2552')}
HEADT = ('head', 'muzzle', 'nose', 'brow', 'ear', 'tuft_head')


def extra(co, nor, col, tag):
    # poil inégal : des mèches plus claires, d'autres plus sombres
    nz = 0.5 + 0.5 * np.sin(co[:, 0] * 37 + np.sin(co[:, 2] * 23) * 2) * np.sin(co[:, 1] * 29 + co[:, 2] * 41)
    col *= (0.78 + 0.44 * nz)[:, None]
    # la gueule : rouge sombre dedans, langue, babines
    hd = np.isin(tag, HEADT)
    q = (co - MOUTH_C) / MOUTH_R
    qn = np.linalg.norm(q, axis=1)
    inner = hd & (qn < 1.45) & ((nor * q).sum(1) < -0.05)
    lips = hd & ~inner & (qn < 1.3) & (co[:, 1] < MOUTH_C[1] + 0.06)
    col[lips] = srgb('#4a1a30')
    col[inner] = srgb('#4a0a18')
    col[inner & (q[:, 2] < -0.25)] = srgb('#9a2a3e')
    # intérieur des oreilles
    col[(tag == 'ear') & (nor[:, 1] < -0.35)] = srgb('#5a2048')


K.log('maillage du corps')
BODY = mesh('Body', body, (-0.86, -0.72, 0.0), (0.86, 0.72, 2.08), vox=0.006, clip=lambda X, Y, Z: -0.002 - Z)
K.decimate(BODY, 9800)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Fourrure', rough=0.9, spec=0.1))

# --- les yeux luisants (fente noire), les crocs, les griffes ----------------------------------------------------
lueur = bpy.data.materials.new('Lueur')
lueur.use_nodes = True
bs = lueur.node_tree.nodes['Principled BSDF']
bs.inputs['Base Color'].default_value = tuple(srgb('#ffe14a')) + (1,)
bs.inputs['Emission Color'].default_value = tuple(srgb('#ffe14a')) + (1,)
bs.inputs['Emission Strength'].default_value = 1.0
bs.inputs['Roughness'].default_value = 0.3
pupil = K.mat('Pupille', '#140814', rough=0.2)
EYES = []
for sx, n in ((1, 'OeilG'), (-1, 'OeilD')):
    c = EYE * V(sx, 1, 1)
    EYES.append(K.sphere(n, tuple(c), 0.065, lueur, scale=(1.15, 0.75, 0.85), seg=16))
    EYES.append(K.sphere(n + 'P', tuple(c + V(0, -0.044, 0.002)), 0.04, pupil, scale=(0.28, 0.32, 1.05), seg=10))


def muzzle_front(x, z):
    return -0.42 - 0.16 * math.sqrt(max(0.0, 1 - (x / 0.2) ** 2 - ((z - 1.5) / 0.11) ** 2))


crocs = K.mat('Crocs', '#f0e6c8', rough=0.3)
up, dn = [], []
for i, x in enumerate(np.linspace(-0.12, 0.12, 7)):
    big = abs(abs(x) - 0.08) < 0.02
    L = 0.09 if big else 0.05
    y = muzzle_front(x, 1.545) + 0.02
    up.append(K.cone_mesh(f'CrocH{i}', (x, y, 1.552), (x * 1.04, y + 0.006, 1.552 - L), 0.021 if big else 0.016, 0.002, crocs, seg=6))
for i, x in enumerate((-0.1, -0.06, -0.02, 0.02, 0.06, 0.1)):
    y = muzzle_front(x, 1.465) + 0.022
    dn.append(K.cone_mesh(f'CrocB{i}', (x, y, 1.455), (x * 1.05, y - 0.004, 1.455 + 0.045), 0.015, 0.002, crocs, seg=6))
FANGS_UP, FANGS_DN = join(up, 'CrocsHaut'), join(dn, 'CrocsBas')

griffe = K.mat('Griffes', '#d6c9a8', rough=0.35)


def claw(name, T, f, size=1.0):
    """griffe crochue : part dans le sens du doigt puis se recourbe vers le sol"""
    f = unit(f)
    dwn = V(0, 0, -1)
    P0 = T - f * 0.015
    P1 = T + f * 0.05 * size + dwn * 0.006 * size
    P2 = P1 + (f * 0.02 + dwn * 0.055) * size
    a = K.cone_mesh(name + 'a', tuple(P0), tuple(P1), 0.027 * size, 0.017 * size, griffe, seg=8)
    b = K.cone_mesh(name + 'b', tuple(P1), tuple(P2), 0.017 * size, 0.002, griffe, seg=8)
    return join([a, b], name)


CLAWS = {}
for s, sx in (('L', 1), ('R', -1)):
    for i, (b, t) in enumerate(fingers(sx)):
        CLAWS[f'f{i + 1}{s}'] = claw(f'Griffe{i + 1}{s}', t, t - b)
    toes = [claw(f'Orteil{j}{s}', V((0.25 + dx * 1.2) * sx, -0.32, 0.05), V(0, -1, -0.15), 0.75) for j, dx in enumerate((-0.06, 0.0, 0.06))]
    CLAWS['foot' + s] = join(toes, 'GriffesPied' + s)

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0.06, HIP_Z), (0, 0.06, 0.95))
K.bone('spine', (0, 0.06, 0.95), (0, 0.12, 1.35), 'root', True)
K.bone('chest', (0, 0.12, 1.35), (0, 0.04, 1.66), 'spine', True)
K.bone('head', (0, -0.12, 1.58), (0, -0.42, 1.72), 'chest')
K.bone('jaw', JAW_A, JAW_B, 'head')
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'chest')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    for i, (b, t) in enumerate(fingers(sx)):
        K.bone(f'f{i + 1}{s}', b, t, 'hand' + s)
    K.bone('thigh' + s, HIP * m, KNEE * m, 'root')
    K.bone('shin' + s, KNEE * m, ANKLE * m, 'thigh' + s, True)
    K.bone('foot' + s, ANKLE * m, TOE * m, 'shin' + s, True)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in HEADT:
        return ['head']
    if tg == 'scruff':
        return ['chest', 'head']
    if tg == 'tuft_chest':
        return ['spine', 'chest']
    if tg in ('hump', 'tuft_back'):
        return ['spine', 'chest'] + (['arm' + s] if abs(p[0]) > 0.3 and p[2] > 1.45 else [])
    if tg in ('shoulder', 'tuft_sh'):
        return ['chest', 'arm' + s]
    if tg == 'fur':
        return ['root', 'spine', 'chest']
    if tg in ('belly', 'tuft_hip'):
        return ['root', 'spine'] + (['thigh' + s] if p[2] < 0.78 and abs(p[0]) > 0.12 else [])
    if tg in ('arm', 'tuft_arm'):
        return ['chest', 'arm' + s, 'forearm' + s] if p[2] > 1.42 else ['arm' + s, 'forearm' + s]
    if tg in ('forearm', 'tuft_fore'):
        return ['arm' + s, 'forearm' + s, 'hand' + s]
    if tg == 'hand':
        return ['forearm' + s, 'hand' + s]
    if tg == 'finger':
        return ['hand' + s, 'f1' + s, 'f2' + s, 'f3' + s]
    if tg in ('leg', 'tuft_leg'):
        return ['root', 'thigh' + s, 'shin' + s] if p[2] > 0.62 else ['thigh' + s, 'shin' + s]
    if tg == 'shin':
        return ['thigh' + s, 'shin' + s, 'foot' + s]
    if tg in ('foot', 'toe'):
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


def jaw_weight(p):
    """part de la mâchoire : sous la ligne charnière → milieu de la gueule, et devant la charnière"""
    d = MOUTH_C - JAW_A
    L = math.hypot(d[1], d[2])
    s = (d[1] * (p[2] - JAW_A[2]) - d[2] * (p[1] - JAW_A[1])) / L
    return ss(-0.01, 0.015, s) * ss(JAW_A[1], JAW_A[1] - 0.1, p[1])


def jaw_hook(W):
    J, H = K.S['BNAMES'].index('jaw'), K.S['BNAMES'].index('head')
    for i in np.nonzero(np.isin(TAG, HEADT))[0]:
        w = jaw_weight(CO[i])
        W[i, J] += W[i, H] * w
        W[i, H] *= 1 - w


_assign = K._assign
K._assign = lambda ob, W: (jaw_hook(W), _assign(ob, W))
K.skin(BODY, CO, TAG, allowed)
K._assign = _assign
for o in EYES + [FANGS_UP]:
    K.attach(o, 'head')
K.attach(FANGS_DN, 'jaw')
for bn, o in CLAWS.items():
    K.attach(o, bn)


# --- animations ---------------------------------------------------------------------------------------------
def reach(fk, s, target, pole, e=1.0):
    """bras à deux os : le poignet va sur target (repère du buste au repos), le coude plie vers pole"""
    B = K.S['BSEG']
    sh, el, wr = Vector(B['arm' + s][0]), Vector(B['arm' + s][1]), Vector(B['forearm' + s][1])
    a, b = (el - sh).length, (wr - el).length
    T = Vector(target)
    dv = T - sh
    dd = min(dv.length, (a + b) * 0.999)
    u = dv.normalized()
    x = (a * a - b * b + dd * dd) / (2 * dd)
    hh = math.sqrt(max(a * a - x * x, 0.0))
    pv = Vector(pole) - sh
    pv = (pv - u * pv.dot(u)).normalized()
    E = sh + u * x + pv * hh
    Wp = sh + u * dd
    q1 = (el - sh).rotation_difference(E - sh)
    q2w = (q1 @ (wr - el)).rotation_difference(Wp - E)
    q2 = q1.inverted() @ q2w @ q1
    ax1, an1 = q1.to_axis_angle()
    ax2, an2 = q2.to_axis_angle()
    fk['arm' + s] = [(tuple(ax1), math.degrees(an1) * e)]
    fk['forearm' + s] = [(tuple(ax2), math.degrees(an2) * e)]


def legs(fk, ph, lift=28, knee=45):
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(TAU * (ph + o))
        up = max(0.0, math.cos(TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -15 * up)]


def claws(fk, curl=0.0, spread=0.0):
    """doigts : curl > 0 recroquevillés, < 0 relevés ; spread écarte"""
    for s, sx in (('L', 1), ('R', -1)):
        for i, dx in zip((1, 2, 3), (-1, 0, 1)):
            fk[f'f{i}{s}'] = [('x', curl), ('y', -spread * dx * sx)]


def idle(t):
    # il se balance d'un pied sur l'autre, respire lourdement (deux fois), et ses griffes pianotent par terre
    sw = K.wave(t)
    br = 0.5 - 0.5 * math.cos(TAU * 2 * t)
    fk = {'spine': [('x', 3 * br), ('y', 4 * sw)], 'chest': [('x', -5 * br), ('y', 3 * sw)],
          'head': [('z', 14 * K.wave(t, 1, 0.15)), ('x', -4 * br)], 'jaw': [('x', 3 + 8 * br)],
          'armL': [('x', 4 * K.wave(t, 1, 0.3)), ('y', -3 * sw)], 'armR': [('x', -4 * K.wave(t, 1, 0.3)), ('y', -3 * sw)],
          'forearmL': [('x', -5)], 'forearmR': [('x', -5)]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        for i in (1, 2, 3):
            lift = max(0.0, math.sin(TAU * (4 * t - (i - 1) * 0.2 - o))) ** 2
            fk[f'f{i}{s}'] = [('x', -40 * lift)]
    for s, sg in (('L', 1), ('R', -1)):
        fk['thigh' + s] = [('y', -3 * sw)]
    return pose(fk, root=(0.035 * sw, 0, -0.015 * br + 0.01 * abs(sw)), scale=(1 + 0.03 * br, 1 + 0.03 * br, 1))


def walk(t):
    # il rôde, voûté, tête basse qui scrute, les bras ballants traînent les griffes
    sw = K.wave(t)
    fk = {'spine': [('x', 8), ('y', 4 * sw), ('z', 6 * sw)], 'chest': [('x', 6), ('z', 4 * sw)],
          'head': [('x', -12), ('z', -8 * sw + 10 * K.wave(t, 1, 0.3))], 'jaw': [('x', 6)],
          'armL': [('x', 22 * sw)], 'armR': [('x', -22 * sw)],
          'forearmL': [('x', -10 - 8 * K.wave(t, 1, 0.1))], 'forearmR': [('x', -10 + 8 * K.wave(t, 1, 0.1))]}
    claws(fk, 15, 0)
    legs(fk, t, lift=26, knee=45)
    return pose(fk, root=(0.03 * sw, 0, -0.035 + 0.03 * K.hop(t, 2)))


def run(t):
    # il se jette en avant, bras tendus griffes écartées, gueule ouverte
    sw = K.wave(t)
    hh = K.hop(t, 2)
    fk = {'spine': [('x', 22 + 4 * K.wave(t, 2))], 'chest': [('x', 12)],
          'head': [('x', -30), ('z', -5 * sw)], 'jaw': [('x', 22 + 6 * K.wave(t, 4))],
          'armL': [('x', -78 + 22 * sw), ('y', -12)], 'forearmL': [('x', -20 - 15 * sw)],
          'armR': [('x', -78 - 22 * sw), ('y', 12)], 'forearmR': [('x', -20 + 15 * sw)]}
    claws(fk, -20, 22)
    legs(fk, t, lift=45, knee=70)
    return pose(fk, root=(0.03 * sw, -0.04, 0.07 * hh - 0.05))


def warn(t):
    # il se ramasse, puis se dresse de toute sa taille, bras écartés, gueule grande ouverte : « BOU ! »
    c = ss(0.0, 0.25, t) * (1 - ss(0.25, 0.55, t))
    e = ss(0.3, 0.75, t)
    fk = {'spine': [('x', 10 * c - 11 * e)], 'chest': [('x', 6 * c - 10 * e)],
          'head': [('x', 8 * c + 16 * e)], 'jaw': [('x', 38 * e)]}
    for s, sx in (('L', 1), ('R', -1)):
        reach(fk, s, (0.98 * sx, -0.62, 1.7), (1.5 * sx, 0.25, 1.0), e)
        fk['arm' + s].append(('x', 12 * c))
        fk['hand' + s] = [('x', -30 * e)]
    claws(fk, 30 * e, 25 * e)
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -15 * c)]
        fk['shin' + s] = [('x', 25 * c)]
        fk['foot' + s] = [('x', -10 * c + 12 * e)]
    return pose(fk, root=(0, 0.04 * e, -0.06 * c + 0.1 * e), scale=(1 + 0.06 * e, 1 + 0.06 * e, 1 + 0.1 * e))


BELLY_PT = (0.3, -0.42, 0.98)


def laugh(t):
    # rire grave : « HO HO HO », les épaules qui tressautent, une patte sur le ventre
    sh = K.wave(t, 5)
    hh = K.hop(t, 5)
    fk = {'spine': [('x', -8 + 3 * sh)], 'chest': [('x', -12 + 5 * sh), ('y', 4 * K.wave(t, 5, 0.25))],
          'head': [('x', -12 + 6 * sh), ('z', 8 * K.wave(t))], 'jaw': [('x', 10 + 20 * hh)],
          'armR': [('y', -10 + 5 * sh), ('x', -8)], 'forearmR': [('x', -15 + 10 * sh)]}
    reach(fk, 'L', BELLY_PT, (1.3, 0.4, 1.2))
    fk['handL'] = [('z', 20)]
    claws(fk, 10, 0)
    return pose(fk, root=(0, 0, 0.025 * hh - 0.01))


def dance(t):
    # il se dandine lourdement : le poids d'un pied sur l'autre, les bras qui ballottent comme des pendules
    sw = K.wave(t)
    b = K.hop(t, 2)
    fk = {'spine': [('y', 10 * sw), ('x', 6)], 'chest': [('y', 6 * K.wave(t, 1, -0.08))],
          'head': [('y', -10 * sw), ('x', -6 * b)], 'jaw': [('x', 8 + 8 * b)],
          'armL': [('y', 28 * K.wave(t, 1, -0.1)), ('x', -10)], 'armR': [('y', 28 * K.wave(t, 1, -0.1)), ('x', -10)],
          'forearmL': [('x', -20)], 'forearmR': [('x', -20)]}
    claws(fk, 10, 10)
    for s, sg in (('L', 1), ('R', -1)):
        lift = max(0.0, -sg * sw)
        fk['thigh' + s] = [('x', -30 * lift)]
        fk['shin' + s] = [('x', 45 * lift)]
    return pose(fk, root=(0.08 * sw, 0, -0.04 * (1 - b)))


K.bake([('Idle', 60, idle), ('Walk', 32, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, laugh), ('Dance', 32, dance)])


def probe(action, frame, names):
    arm = K.S['arm']
    for tr in arm.animation_data.nla_tracks:
        tr.mute = tr.name != action
    K.S['scene'].frame_set(frame)
    K.log(action, frame, {n: tuple(round(v, 3) for v in arm.pose.bones[n].tail) for n in names})
    for tr in arm.animation_data.nla_tracks:
        tr.mute = False


probe('Idle', 0, ['f2L', 'head'])
probe('Warn', 16, ['handL', 'head', 'chest'])
tris = {o.name: sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
K.log('triangles', sum(tris.values()), {k: v for k, v in tris.items() if v > 300})

K.preview([
    ('face', 'Idle', 0, (0.3, -4.8, 1.4), (0, 0, 1.0)),
    ('troisquarts', 'Idle', 0, (3.0, -3.4, 2.2), (0, 0, 1.0)),
    ('visage', 'Idle', 20, (0.4, -2.2, 1.75), (0, -0.3, 1.55)),
    ('dessus', 'Idle', 0, (3.4, -3.4, 4.6), (0, 0, 0.9)),
    ('dos', 'Walk', 0, (-1.4, 4.4, 2.0), (0, 0, 1.0)),
    ('griffes', 'Idle', 6, (1.6, -1.6, 0.6), (0.5, -0.3, 0.2)),
    ('marche', 'Walk', 8, (4.2, -1.4, 1.3), (0, 0, 1.0)),
    ('course', 'Run', 6, (4.0, -2.0, 1.4), (0, -0.2, 1.0)),
    ('alerte', 'Warn', 16, (1.4, -4.8, 1.6), (0, 0, 1.2)),
    ('rire', 'Hit', 3, (1.6, -3.8, 1.5), (0, 0, 1.0)),
    ('danse', 'Dance', 8, (0.8, -4.2, 1.5), (0, 0, 1.0)),
])
# comme dans le jeu de loin : la fourrure (et les crocs, les griffes) presque transparente, seuls les yeux luisent
saved = {}
for m in bpy.data.materials:
    if m.name.split('.')[0] in ('Fourrure', 'Crocs', 'Griffes') and m.use_nodes:
        a = m.node_tree.nodes['Principled BSDF'].inputs['Alpha']
        saved[m.name] = a.default_value
        a.default_value = 0.06
K.preview([('fantome', 'Idle', 0, (3.0, -3.4, 2.2), (0, 0, 1.0))])
for m in bpy.data.materials:
    if m.name in saved:
        m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = saved[m.name]
K.export()
