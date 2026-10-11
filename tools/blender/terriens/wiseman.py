# Le sage en costume de carotte : un vieux sage à longue barbe blanche dont le visage sort d'un costume intégral de
# carotte (rayures plus foncées, fanes vertes), petits bras et petites jambes en sandales. Il médite en lévitant.
#   Blender -b -P tools/blender/terriens/wiseman.py -- public/models/terriens/wiseman.glb [dossier_aperçus]
# Clips : Idle (lévite en tailleur, yeux mi-clos), Walk (sautille), Run, Warn (surprise), Hit (bénédiction), Dance (toupie).
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import shutil
import tempfile
import numpy as np
import bpy
import bmesh
from mathutils import Vector, Quaternion, Matrix
import kit as K
from kit import V, ell, cone, rbox, srgb, wave, hop, pose

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/wiseman.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('wiseman', OUT, PREVIEW)
# volumes de travail dans un dossier à soi (d'autres terriens se fabriquent peut-être en même temps)
WORK = tempfile.mkdtemp(prefix='terrien_wiseman_')
K.S['work'] = WORK


# =====================================================================================================
# petits outils propres à ce script
# =====================================================================================================
def _bbox(p, m):
    if p['kind'] == 'ell':
        e = float(np.max(p['r'])) + m
        return p['c'] - e, p['c'] + e
    if p['kind'] == 'box':
        e = float(np.linalg.norm(p['h'])) + m
        return p['c'] - e, p['c'] + e
    e = max(p['r1'], p['r2']) + m
    return np.minimum(p['a'], p['b']) - e, np.maximum(p['a'], p['b']) + e


def sdf_mesh(name, prims, lo, hi, vox=0.0055, smooth=2):
    """comme K.sdf_mesh, mais chaque volume n'est évalué que dans sa boîte englobante (bien plus rapide)"""
    import openvdb as vdb
    lo, hi = V(*lo), V(*hi)
    n = np.ceil((hi - lo) / vox).astype(int) + 1
    ax = [lo[i] + np.arange(n[i]) * vox for i in range(3)]
    d = np.ones(tuple(n))
    for p in prims:
        a, b = _bbox(p, p['k'] + 4 * vox + 0.03)
        i0 = np.clip(np.floor((a - lo) / vox).astype(int), 0, n)
        i1 = np.clip(np.ceil((b - lo) / vox).astype(int) + 1, 0, n)
        if np.any(i1 <= i0):
            continue
        sl = tuple(slice(i0[i], i1[i]) for i in range(3))
        X, Y, Z = ax[0][sl[0]][:, None, None], ax[1][sl[1]][None, :, None], ax[2][sl[2]][None, None, :]
        dp = K.sd_prim(p, X, Y, Z)
        sub = d[sl]
        d[sl] = K.smin(sub, dp, p['k']) if p['op'] == 'add' else -K.smin(-sub, dp, p['k'])
    band = np.where(d > vox * 3, 0.0, -d).astype(np.float32)
    g = vdb.FloatGrid()
    g.copyFromArray(band, ijk=tuple(int(round(c / vox)) for c in lo))
    g.name = 'density'
    g.transform = vdb.createLinearTransform(voxelSize=vox)
    path = os.path.join(WORK, f'vol_{name}.vdb')
    vdb.write(path, grids=[g])
    bpy.ops.object.volume_import(filepath=path)
    vo = bpy.context.active_object
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
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


def solid(name, prims, lo, hi, colors, faces=2000, vox=0.004, rough=0.5, extra=None):
    ob = sdf_mesh(name, prims, lo, hi, vox=vox)
    K.decimate(ob, faces, symmetric=False)
    K.paint(ob, prims, colors, extra)
    ob.data.materials.append(K.vc_material(name + 'Mat', rough=rough))
    return ob


def surf_y(prims, x, z, y0=-0.8, y1=0.2, step=0.002):
    """profondeur y de la surface avant (premier point dans la matière en venant de -Y)"""
    ys = np.arange(y0, y1, step)
    d = K.field(prims, np.full_like(ys, x), ys, np.full_like(ys, z))
    i = int(np.argmax(d < 0))
    return float(ys[i])


def frame(along, side=(1, 0, 0)):
    """matrice dont les colonnes sont (largeur, épaisseur, long) : un volume allongé suivant 'along'"""
    w = np.array(along, float)
    w /= np.linalg.norm(w)
    s = np.array(side, float)
    s -= w * (s @ w)
    s /= np.linalg.norm(s)
    t = np.cross(w, s)
    return np.stack([s, t, w], axis=1)


def lid(name, c, r, m, open_deg=-90, rx=1.04, ryz=1.22):
    """paupière de l'œil de rayon r : demi-ellipsoïde pleine (dôme vers le haut quand elle couvre la moitié haute de
    l'œil), à peine plus large que l'œil sur les côtés, assez profonde pour couvrir la pupille ; tournée de open_deg
    autour de X (ouverte) ; l'os 'lid' la referme en tournant de +x degrés"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-5], context='VERTS')
    bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
    bmesh.ops.scale(bm, verts=bm.verts[:], vec=(r * rx, r * ryz, r * ryz))
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(open_deg), 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=Vector(tuple(c)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    K.S['scene'].collection.objects.link(o)
    o.data.materials.append(m)
    for f in me.polygons:
        f.use_smooth = len(f.vertices) <= 4
    return o


def tris():
    return sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')


# =====================================================================================================
# proportions
# =====================================================================================================
HIP_Z = 0.3
CZ = 0.84                      # centre du dôme de la carotte (la tête du sage est dedans)
FACE_C = V(0, -0.15, 0.86)
SH = V(0.235, 0.0, 0.68)       # épaule gauche (dans le costume)
EL = V(0.35, -0.03, 0.55)
WR = V(0.385, -0.07, 0.44)
HD = V(0.39, -0.09, 0.37)
LEG = {'L': V(0.085, 0.0, 0), 'R': V(-0.085, 0.0, 0)}
KNEE_Z, ANKLE_Z = 0.17, 0.055
TIP = V(0, 0.03, 0.17)

carrot = [
    ell('carrot', (0, 0.0, CZ + 0.02), (0.32, 0.3, 0.25), k=0.06),
    cone('carrot', (0, 0.0, CZ), tuple(TIP), 0.31, 0.03, k=0.06),
]
body = list(carrot)
# moignons de manches du costume, d'où sortent les bras
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('cuff', tuple(V(0.22, 0.0, 0.69) * m), tuple(V(0.295, -0.012, 0.635) * m), 0.058, 0.05, k=0.03))
body += [
    # l'ouverture du costume, puis le visage un peu en retrait
    ell('hole', (0, -0.3, 0.86), (0.165, 0.1, 0.185), k=0.025, op='sub'),
    ell('face', tuple(FACE_C), (0.15, 0.12, 0.165), k=0.02),
    ell('nose', (0, -0.285, 0.872), (0.048, 0.05, 0.052), k=0.025),
    ell('brow', (0.066, -0.262, 0.955), (0.058, 0.026, 0.02), k=0.015, R=K.rot(0, 16, 0)),
    ell('brow', (-0.066, -0.262, 0.955), (0.058, 0.026, 0.02), k=0.015, R=K.rot(0, -16, 0)),
    ell('beard', (0, -0.235, 0.755), (0.13, 0.075, 0.075), k=0.03),
]
# la barbe descend en suivant le devant de la carotte, de plus en plus fine
BEARD = []
for z, w, th in ((0.68, 0.125, 0.06), (0.59, 0.11, 0.055), (0.5, 0.09, 0.05), (0.41, 0.068, 0.042), (0.33, 0.045, 0.034)):
    y = surf_y(carrot, 0, z) - th * 0.45
    BEARD.append(V(0, y, z))
    body.append(ell('beard', (0, y, z), (w, th, 0.08), k=0.05))
body.append(cone('beard', tuple(BEARD[-1]), tuple(BEARD[-1] + V(0, 0.03, -0.085)), 0.03, 0.008, k=0.02))
# moustache tombante
body.append(ell('stache', (0.052, -0.305, 0.83), (0.06, 0.03, 0.024), k=0.015, R=K.rot(0, 28, 0)))
body.append(ell('stache', (-0.052, -0.305, 0.83), (0.06, 0.03, 0.024), k=0.015, R=K.rot(0, -28, 0)))

# les fanes : une tige et trois folioles alternées chacune
FANE_BASE = V(0, 0.02, 1.1)
FANES = []
for i, (az, tilt, ln) in enumerate(((0, 4, 0.27), (40, 38, 0.24), (140, 36, 0.22), (220, 36, 0.22), (320, 38, 0.24))):
    a = math.radians(az + 90)  # az = 0 : vers l'arrière (+Y)
    u = V(math.cos(a), math.sin(a), 0)
    d = V(0, 0, 1) * math.cos(math.radians(tilt)) + u * math.sin(math.radians(tilt))
    base = FANE_BASE + u * 0.03
    mid = base + d * ln * 0.45
    tip = base + d * ln
    FANES.append((base, mid, tip, u))
    tg = f'fane{i}'
    body.append(cone(tg, tuple(base - d * 0.03), tuple(tip), 0.03, 0.012, k=0.025))
    side = np.cross(d, u) if tilt > 10 else V(1, 0, 0)
    for j, (f, sgn) in enumerate(((0.45, 1), (0.68, -1), (0.92, 1))):
        p = base + d * ln * f
        leaf_dir = d * 0.75 + side * sgn * 0.65
        R = frame(leaf_dir, d)
        body.append(ell(tg, tuple(p + leaf_dir / np.linalg.norm(leaf_dir) * 0.035), (0.032, 0.012, 0.06 - 0.008 * j), k=0.012, R=R))
    body.append(ell(tg, tuple(tip + d * 0.03), (0.03, 0.012, 0.055), k=0.012, R=frame(d, u)))

# bras maigres, mains de vieillard
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('arm', tuple(V(0.27, -0.005, 0.665) * m), tuple(EL * m), 0.032, 0.028, k=0.02))
    body.append(cone('arm', tuple(EL * m), tuple(WR * m), 0.028, 0.025, k=0.015))
    body.append(ell('hand', tuple(((WR + HD) / 2) * m), (0.032, 0.026, 0.045), k=0.02))
    body.append(ell('hand', tuple((WR + V(-0.02, -0.025, -0.02)) * m), (0.013, 0.013, 0.025), k=0.012))
# petites jambes, genoux noueux, pieds en sandales
for s, b in LEG.items():
    body.append(cone('leg', tuple(b + V(0, 0, HIP_Z + 0.02)), tuple(b + V(0.004, -0.015, KNEE_Z)), 0.03, 0.028, k=0.02))
    body.append(ell('leg', tuple(b + V(0.004, -0.02, KNEE_Z)), (0.034, 0.032, 0.03), k=0.02))
    body.append(cone('leg', tuple(b + V(0.004, -0.015, KNEE_Z)), tuple(b + V(0.008, 0, ANKLE_Z)), 0.028, 0.024, k=0.015))
    body.append(ell('foot', tuple(b + V(0.008, -0.045, 0.032)), (0.036, 0.068, 0.024), k=0.02))
    body.append(rbox('sole', tuple(b + V(0.008, -0.048, 0.007)), (0.044, 0.084, 0.007), r=0.005, k=0.006))

ORANGE, STRIPE = srgb('#ff8a2a'), srgb('#d4601a')
SKIN, LEGSKIN = srgb('#f0c39a'), srgb('#e9b48c')
COL = {'default': ORANGE, 'carrot': ORANGE, 'cuff': srgb('#f07a22'), 'face': SKIN, 'nose': srgb('#f2a08a'),
       'brow': srgb('#f6f6f6'), 'beard': srgb('#f6f6f6'), 'stache': srgb('#ffffff'),
       'arm': LEGSKIN, 'hand': LEGSKIN, 'leg': LEGSKIN, 'foot': LEGSKIN, 'sole': srgb('#7a4a22')}
for i in range(5):
    COL[f'fane{i}'] = srgb('#3fae4a')


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # rayures de la carotte : de courts sillons horizontaux un peu ondulés, éparpillés tout autour
    ang = np.degrees(np.arctan2(y, x))
    car = tag == 'carrot'
    for i in range(16):
        z0 = 0.24 + i * 0.056
        ac = (i * 137.5) % 360 - 180
        half = 45 + (i * 53) % 50
        da = (ang - ac + 540) % 360 - 180
        on = car & (np.abs(da) < half) & (np.abs(z - z0 - 0.008 * np.sin(np.radians(da) * 3)) < 0.0075)
        col[on] = STRIPE
    # la pointe un peu plus foncée
    col[car & (z < 0.26)] = col[car & (z < 0.26)] * 0.82
    # bordure plus sombre autour de l'ouverture du visage
    r = np.sqrt((x / 0.18) ** 2 + ((z - 0.86) / 0.2) ** 2)
    col[car & (y < -0.18) & (r < 1.15)] = srgb('#e0661c')
    # barbe : mèches grisées
    b = np.isin(tag, ('beard', 'stache'))
    streak = np.sin(x * 160 + z * 20) > 0.55
    col[b & streak] = srgb('#d6dae4')
    # rides du front, joues roses
    f = tag == 'face'
    for z0 in (0.995, 1.012):
        col[f & (np.abs(z - z0 + 0.25 * x * x) < 0.0035) & (np.abs(x) < 0.07)] = srgb('#d9a07c')
    col[f & (np.abs(np.abs(x) - 0.095) < 0.035) & (np.abs(z - 0.86) < 0.03)] = srgb('#f2a88a')
    # fanes : nervure claire, base plus foncée
    fn = np.array([str(t).startswith('fane') for t in tag])
    col[fn & (z < 1.16)] = srgb('#2a8a3a')
    # sandales : lanières sur le pied
    ft = tag == 'foot'
    col[ft & ((np.abs(y + 0.07) < 0.012) | (np.abs(y + 0.02) < 0.01))] = srgb('#9a6232')
    col[ft & (z < 0.014)] = srgb('#7a4a22')


K.log('maillage du corps')
BODY = sdf_mesh('Body', body, (-0.48, -0.42, 0.0), (0.48, 0.42, 1.42), vox=0.005)
K.decimate(BODY, 9500)
BODY.data.validate()
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Sage', rough=0.55))

# --- yeux et paupières -----------------------------------------------------------------------------------
EYE_L = V(0.06, -0.255, 0.912)
EYE_R = 0.04
EYES = K.eyes(tuple(EYE_L), EYE_R, pupil_dir=(0, -1, 0.02), pupil_r=0.45)
LIDM = K.mat('Paupiere', '#e8b088', rough=0.6)
LIDS = [lid('PaupiereG', EYE_L, EYE_R, LIDM), lid('PaupiereD', EYE_L * V(-1, 1, 1), EYE_R, LIDM)]

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 0.5))
K.bone('spine', (0, 0, 0.5), (0, 0, 0.76), 'root', True)
K.bone('head', (0, 0, 0.76), (0, 0, 1.1), 'spine', True)
B0 = V(0, -0.255, 0.75)
K.bone('beard1', B0, BEARD[1], 'head')
K.bone('beard2', BEARD[1], BEARD[3], 'beard1', True)
K.bone('beard3', BEARD[3], BEARD[-1] + V(0, 0.03, -0.085), 'beard2', True)
for i, (base, mid, tip, u) in enumerate(FANES):
    K.bone(f'fane{i}', base, mid, 'head')
    K.bone(f'fane{i}b', mid, tip, f'fane{i}', True)
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('lid' + s, EYE_L * m, EYE_L * m + V(0, -0.05, 0), 'head')
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0, HIP_Z), b + V(0.004, -0.015, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0.004, -0.015, KNEE_Z), b + V(0.008, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0.008, 0, ANKLE_Z), b + V(0.008, -0.11, 0.02), 'shin' + s, True)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    z = p[2]
    if tg in ('face', 'nose', 'brow', 'stache'):
        return ['head']
    if tg == 'carrot':
        if z > 0.8:
            return ['head']
        if z > 0.62:
            return ['spine', 'head']
        if z > 0.4:
            return ['root', 'spine']
        return ['root']
    if tg == 'cuff':
        return ['spine', 'arm' + s]
    if tg == 'beard':
        return ['head', 'beard1'] if z > 0.72 else ['beard1', 'beard2', 'beard3']
    if tg.startswith('fane'):
        i = tg[4:]
        return (['head'] if z < 1.13 else []) + [f'fane{i}', f'fane{i}b']
    if tg == 'arm':
        return (['spine'] if abs(p[0]) < 0.27 else []) + ['arm' + s, 'forearm' + s]
    if tg == 'hand':
        return ['forearm' + s, 'hand' + s]
    if tg == 'leg':
        return ['root', 'thigh' + s] if z > HIP_Z - 0.04 else ['thigh' + s, 'shin' + s]
    if tg in ('foot', 'sole'):
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES:
    K.attach(o, 'head')
K.attach(LIDS[0], 'lidL')
K.attach(LIDS[1], 'lidR')


# --- animations ---------------------------------------------------------------------------------------------
def fanes(fk, spread, sway=0.0, ph=0.0, flick=0.0):
    """spread : écartement (degrés, + vers l'extérieur) ; sway : balancement latéral ; flick : fouet de la pointe"""
    for i, (base, mid, tip, u) in enumerate(FANES):
        tau = tuple(np.cross(V(0, 0, 1), u)) if i else (1, 0, 0)
        w = math.sin(K.TAU * (ph + i * 0.13))
        fk[f'fane{i}'] = [(tau, spread * (0.4 if i == 0 else 1) + sway * w)]
        fk[f'fane{i}b'] = [(tau, spread * 0.5 + flick * w)]


def beard(fk, t, amp=6.0, n=1, fwd=0.0):
    for j, b in enumerate(('beard1', 'beard2', 'beard3')):
        fk[b] = [('y', amp * (0.6 + 0.4 * j) * K.wave(t, n, -0.12 * j)), ('x', -fwd * (0.5 + 0.5 * j) + amp * 0.3 * K.wave(t, n, 0.25 - 0.12 * j))]


def lids(fk, close, close_r=None):
    fk['lidL'] = [('x', close)]
    fk['lidR'] = [('x', close if close_r is None else close_r)]


def stand_legs(fk, ph, lift=30, knee=45):
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (ph + o))
        up = max(0.0, math.cos(K.TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -10 * up)]


def crossed(fk):
    # en tailleur : cuisses vers l'avant et l'extérieur, tibias croisés devant
    fk['thighL'] = [('x', -78), ('z', 42)]
    fk['thighR'] = [('x', -78), ('z', -42)]
    fk['shinL'] = [('y', 112), ('x', -6)]
    fk['shinR'] = [('y', -112), ('x', 6)]
    fk['footL'] = [('y', -60), ('z', 75)]
    fk['footR'] = [('y', 60), ('z', -75)]


def idle(t):
    # lévitation méditative : il flotte en tailleur, paumes ouvertes, yeux mi-clos, la barbe ondule
    fk = {'root': [('y', 2.5 * K.wave(t)), ('x', 2 * K.wave(t, 1, 0.25))],
          'spine': [('x', -2 * K.wave(t, 1, 0.1))], 'head': [('x', 4 + 3 * K.wave(t, 1, 0.3)), ('y', -2 * K.wave(t))],
          'armL': [('y', 20), ('x', -2)], 'forearmL': [('z', 90), ('x', -80 + 4 * K.wave(t, 1, 0.2))], 'handL': [('x', -15)],
          'armR': [('y', -20), ('x', -2)], 'forearmR': [('z', -90), ('x', -80 + 4 * K.wave(t, 1, 0.2))], 'handR': [('x', -15)]}
    crossed(fk)
    beard(fk, t, amp=7, n=1)
    fanes(fk, 6 + 4 * K.wave(t, 1, 0.5), sway=5, ph=t)
    lids(fk, 98 + 4 * K.wave(t, 1))
    return pose(fk, root=(0, 0, 0.22 + 0.035 * K.wave(t)))


def walk(t):
    # il sautille dans son costume : deux petits bonds par boucle, une jambe en avant à chaque fois
    h = K.hop(t, 2)
    land = max(0.0, 1 - h / 0.25)
    fk = {'root': [('x', 6), ('y', 5 * K.wave(t))], 'head': [('x', -4 + 6 * land), ('y', -3 * K.wave(t))],
          'armL': [('y', -40 - 25 * h), ('x', -10)], 'forearmL': [('y', -25 * h), ('x', -20)],
          'armR': [('y', 40 + 25 * h), ('x', -10)], 'forearmR': [('y', 25 * h), ('x', -20)]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (t + o))
        fk['thigh' + s] = [('x', -35 * w - 10 * h)]
        fk['shin' + s] = [('x', 30 * h + 15 * max(0, w))]
        fk['foot' + s] = [('x', -15 * h)]
    beard(fk, t, amp=6, n=2, fwd=-14 * K.wave(t, 2, 0.1))
    fanes(fk, 10 + 16 * K.wave(t, 2, 0.15), sway=6, ph=t, flick=10)
    lids(fk, 70)
    sq = 0.1 * land
    return pose(fk, root=(0, 0, 0.13 * h - 0.02 * land), scale=(1 + sq * 0.6, 1 + sq * 0.6, 1 - sq))


def run(t):
    # bonds plus hauts, penché en avant, bras qui moulinent
    h = K.hop(t, 2)
    land = max(0.0, 1 - h / 0.2)
    fk = {'root': [('x', 16), ('y', 6 * K.wave(t))], 'head': [('x', -12 + 10 * land)],
          'armL': [('y', -70 - 30 * h), ('x', 30 * K.wave(t, 2))], 'forearmL': [('y', -40 * h)],
          'armR': [('y', 70 + 30 * h), ('x', -30 * K.wave(t, 2))], 'forearmR': [('y', 40 * h)]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (t + o))
        fk['thigh' + s] = [('x', -50 * w - 25 * h)]
        fk['shin' + s] = [('x', 55 * h + 20 * max(0, w))]
        fk['foot' + s] = [('x', -20 * h)]
    beard(fk, t, amp=8, n=2, fwd=-30 + 18 * K.wave(t, 2, 0.1))
    fanes(fk, 18 + 22 * K.wave(t, 2, 0.15), sway=8, ph=2 * t, flick=14)
    lids(fk, 55)
    sq = 0.13 * land
    return pose(fk, root=(0, 0, 0.26 * h - 0.03 * land), scale=(1 + sq * 0.6, 1 + sq * 0.6, 1 - sq))


def warn(t):
    # surprise : petit sursaut, yeux grands ouverts, bras écartés, fanes dressées
    e = min(1.0, t / 0.45)
    jump = math.sin(math.pi * min(1.0, t / 0.7))
    fk = {'root': [('x', -6 * e)], 'head': [('x', -10 * e)],
          'armL': [('y', -95 * e), ('x', -20 * e)], 'forearmL': [('y', -40 * e)], 'handL': [('y', -20 * e)],
          'armR': [('y', 95 * e), ('x', -20 * e)], 'forearmR': [('y', 40 * e)], 'handR': [('y', 20 * e)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -20 * jump)]
        fk['shin' + s] = [('x', 35 * jump)]
    beard(fk, t, amp=4 * (1 - e), n=1, fwd=10 * jump)
    fanes(fk, -8 * e + 20 * jump, flick=-10 * e)
    lids(fk, 70 * (1 - e) - 18 * e)
    return pose(fk, root=(0, 0, 0.12 * jump))


def bless(t):
    # geste amical : il lève la main droite et bénit, hoche doucement la tête, yeux qui se plissent
    n = K.hop(t, 2)
    fk = {'root': [('y', 3 * K.wave(t))], 'spine': [('x', 5)], 'head': [('x', 4 + 10 * n), ('y', 4 * K.wave(t))],
          'armR': [('x', -95), ('y', 20)], 'forearmR': [('x', -60 + 12 * K.wave(t, 2))], 'handR': [('x', 30)],
          'armL': [('y', -20), ('x', -30)], 'forearmL': [('x', -70), ('z', -30)]}
    stand_legs(fk, 0, lift=0, knee=0)
    beard(fk, t, amp=5, n=1)
    fanes(fk, 6 + 6 * n, sway=4, ph=t)
    lids(fk, 85 + 40 * n)
    return pose(fk, root=(0, 0, 0.06 + 0.02 * K.wave(t)))


def dance(t):
    # la toupie : un tour complet sur lui-même par boucle, deux petits bonds, fanes et barbe qui s'envolent
    h = K.hop(t, 2)
    fk = {'root': [('x', 4), ('z', 360 * t)], 'head': [('x', -10), ('y', 6 * K.wave(t, 2))],
          'armL': [('y', -85 + 10 * K.wave(t, 2)), ('x', 10)], 'forearmL': [('y', -20 * h)],
          'armR': [('y', 85 - 10 * K.wave(t, 2)), ('x', -10)], 'forearmR': [('y', 20 * h)]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        fk['thigh' + s] = [('x', -25 * h), ('y', (-1 if s == 'L' else 1) * -12)]
        fk['shin' + s] = [('x', 40 * h)]
    beard(fk, t, amp=6, n=2, fwd=45)
    fanes(fk, 48 + 10 * K.wave(t, 2), sway=8, ph=2 * t, flick=15)
    lids(fk, 150)
    return pose(fk, root=(0, 0, 0.1 * h + 0.03))


K.bake([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 16, run), ('Warn', 16, warn), ('Hit', 30, bless), ('Dance', 32, dance)])
K.log('triangles', tris(), 'dont corps', sum(len(f.vertices) - 2 for f in BODY.data.polygons))

if os.environ.get("DBG"):
    exec(open(os.environ["DBG_SCRIPT"]).read())
    sys.exit(0)
K.preview([
    ('face', 'Idle', 0, (0.3, -3.4, 1.0), (0, 0, 0.7)),
    ('troisquarts', 'Idle', 0, (2.3, -2.4, 1.6), (0, 0, 0.7)),
    ('visage', 'Idle', 0, (0.2, -1.5, 1.0), (0, 0, 0.85)),
    ('jambes', 'Idle', 30, (0.5, -1.3, 0.3), (0, 0, 0.42)),
    ('profil', 'Idle', 30, (3.2, -0.3, 0.9), (0, 0, 0.75)),
    ('dessus', 'Walk', 0, (1.6, -1.8, 3.2), (0, 0, 0.6)),
    ('marche', 'Walk', 6, (3.0, -1.2, 1.1), (0, 0, 0.7)),
    ('course', 'Run', 4, (3.0, -1.2, 1.1), (0, 0, 0.7)),
    ('alerte', 'Warn', 16, (1.2, -3.0, 1.1), (0, 0, 0.7)),
    ('benit', 'Hit', 8, (1.2, -3.0, 1.1), (0, 0, 0.7)),
    ('danse', 'Dance', 4, (0.8, -3.2, 1.2), (0, 0, 0.8)),
    ('danse2', 'Dance', 12, (0.8, -3.2, 1.2), (0, 0, 0.8)),
])
K.export()
shutil.rmtree(WORK, ignore_errors=True)
