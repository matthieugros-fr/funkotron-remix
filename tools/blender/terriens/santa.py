# Le Père Noël : gros ventre, barbe blanche fournie, bonnet à pompon, manteau rouge bordé de fourrure, ceinture noire à
# boucle dorée, bottes, gros sac de cadeaux sur l'épaule. On l'approche sur la pointe des pieds, sinon il s'envole.
#   Blender -b -P tools/blender/terriens/santa.py -- public/models/terriens/santa.glb [dossier_aperçus]
# Clips : Idle (ho ho ho, la main sur le ventre), Walk (marche joviale), Run, Warn (sursaut), Hit (salut de la main),
#         Dance (disco, le sac sur l'épaule), Fly (il s'envole, bras en l'air, en agitant le sac ; boucle).
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
OUT = argv[0] if argv else '/tmp/santa.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('santa', OUT, PREVIEW)
# volumes de travail dans un dossier à soi (d'autres terriens se fabriquent peut-être en même temps)
WORK = tempfile.mkdtemp(prefix='terrien_santa_')
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



def wq(rots):
    """rotation (axes du monde) décrite comme dans K.pose : [(axe, degrés), ...] appliquées dans l'ordre"""
    q = Quaternion()
    for a, deg in rots:
        ax = K.AX[a] if isinstance(a, str) else Vector(a).normalized()
        q = Quaternion(ax, math.radians(deg)) @ q
    return q


def hold(fk, chain, desired):
    """rotation à donner au dernier os pour que sa pièce ait l'orientation 'desired' (quaternion, repère monde) quelle
    que soit la pose de la chaîne qui le porte (racine → … → parent) : les rotations « monde » se composent à gauche"""
    q = Quaternion()
    for b in chain:
        q = q @ wq(fk.get(b, []))
    ax, ang = (q.inverted() @ desired).to_axis_angle()
    return [(tuple(ax), math.degrees(ang))]


def ring(tag, c, axis, rx, ry, n, r, k=0.025, jitter=0.0):
    """couronne de boules (fourrure, bordures) autour de l'axe 'axis', rayons rx/ry dans son plan"""
    axis = np.array(axis, float)
    axis /= np.linalg.norm(axis)
    u = np.cross(axis, (0, 1, 0) if abs(axis[1]) < 0.9 else (1, 0, 0))
    u /= np.linalg.norm(u)
    w = np.cross(axis, u)
    out = []
    for i in range(n):
        a = K.TAU * i / n
        p = np.array(c, float) + u * rx * math.cos(a) + w * ry * math.sin(a)
        rr = r * (1 + jitter * math.sin(i * 2.3))
        out.append(ell(tag, tuple(p), (rr, rr, rr * 0.9), k=k))
    return out


# =====================================================================================================
# proportions
# =====================================================================================================
HIP_Z = 0.44
HEAD_C = V(0, -0.04, 1.2)
SH = V(0.27, 0.02, 1.0)        # épaule gauche
EL = V(0.44, 0.0, 0.8)
WR = V(0.5, -0.04, 0.63)
HD = V(0.51, -0.06, 0.54)
LEG = {'L': V(0.12, 0.0, 0), 'R': V(-0.12, 0.0, 0)}
KNEE_Z, ANKLE_Z = 0.25, 0.08
BELT_Z = 0.62

torso = [
    ell('coat', (0, -0.05, 0.7), (0.34, 0.32, 0.3), k=0.06),          # le gros ventre
    ell('coat', (0, 0.01, 0.93), (0.27, 0.22, 0.18), k=0.06),          # la poitrine, les épaules
    cone('coat_low', (0, 0.0, 0.6), (0, 0.01, 0.39), 0.3, 0.325, k=0.05),
]
body = list(torso)
body += ring('hem', (0, 0.005, 0.375), (0, 0, 1), 0.325, 0.315, 18, 0.05, k=0.03, jitter=0.15)
# bande de fourrure sur le devant du manteau, sous la barbe jusqu'à l'ourlet
for z in (0.78, 0.72, 0.66, 0.56, 0.5, 0.44):
    y = surf_y(torso, 0, z)
    body.append(ell('fur', (0, y + 0.01, z), (0.05, 0.03, 0.04), k=0.03))
# la tête, le nez en patate, les joues rondes
body += [
    ell('head', tuple(HEAD_C), (0.19, 0.18, 0.19), k=0.04),
    ell('nose', (0, -0.228, 1.2), (0.048, 0.045, 0.045), k=0.025),
    ell('cheek', (0.1, -0.17, 1.165), (0.06, 0.045, 0.05), k=0.03),
    ell('cheek', (-0.1, -0.17, 1.165), (0.06, 0.045, 0.05), k=0.03),
    ell('brow', (0.08, -0.205, 1.31), (0.06, 0.03, 0.026), k=0.02, R=K.rot(0, 14, 0)),
    ell('brow', (-0.08, -0.205, 1.31), (0.06, 0.03, 0.026), k=0.02, R=K.rot(0, -14, 0)),
    # la barbe fournie, jusque sur le ventre
    ell('beard', (0, -0.11, 1.07), (0.215, 0.165, 0.15), k=0.05),
    ell('beard', (0.165, -0.06, 1.16), (0.06, 0.085, 0.1), k=0.04),
    ell('beard', (-0.165, -0.06, 1.16), (0.06, 0.085, 0.1), k=0.04),
]
BEARD = []
for z, w, th in ((0.97, 0.19, 0.09), (0.88, 0.15, 0.07), (0.8, 0.09, 0.05)):
    y = surf_y(torso, 0, z) - th * 0.5
    BEARD.append(V(0, y, z))
    body.append(ell('beard', (0, y, z), (w, th, 0.085), k=0.05))
body.append(cone('beard', tuple(BEARD[-1]), tuple(BEARD[-1] + V(0, -0.02, -0.08)), 0.05, 0.015, k=0.03))
# la bouche qui rit, creusée dans la barbe, puis la moustache par-dessus
MOUTH_C, MOUTH_R = V(0, -0.262, 1.088), V(0.062, 0.06, 0.036)
body.append(ell('mouth', tuple(MOUTH_C), tuple(MOUTH_R), k=0.012, op='sub'))
body.append(ell('stache', (0.072, -0.258, 1.138), (0.08, 0.045, 0.038), k=0.02, R=K.rot(0, -16, 0)))
body.append(ell('stache', (-0.072, -0.258, 1.138), (0.08, 0.045, 0.038), k=0.02, R=K.rot(0, 16, 0)))
# le bonnet : bordure de fourrure, cône rouge qui retombe en arrière, pompon
HAT1, HAT2, POM = V(0, 0.07, 1.47), V(0.05, 0.245, 1.42), V(0.06, 0.285, 1.4)
body += ring('hatfur', (0, -0.035, 1.33), (0, 0.05, 1), 0.198, 0.19, 14, 0.052, k=0.03, jitter=0.12)
body += [
    cone('hat', (0, -0.025, 1.36), tuple(HAT1), 0.18, 0.085, k=0.04),
    cone('hat', tuple(HAT1), tuple(HAT2), 0.085, 0.04, k=0.03),
    ell('pompom', tuple(POM), (0.065, 0.065, 0.065), k=0.02),
]
# bras : manches, poignets de fourrure, moufles
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('sleeve', tuple(SH * m), tuple(EL * m), 0.095, 0.085, k=0.04))
    body.append(cone('sleeve', tuple(EL * m), tuple(WR * m), 0.085, 0.08, k=0.03))
    body += ring('cuff', tuple((WR + (EL - WR) * 0.1) * m), tuple((EL - WR) * m), 0.075, 0.075, 9, 0.035, k=0.02)
    body.append(ell('mitt', tuple(((WR + HD) / 2 + V(0, 0, -0.01)) * m), (0.062, 0.058, 0.075), k=0.03))
    body.append(ell('mitt', tuple((WR + V(-0.045, -0.04, -0.03)) * m), (0.024, 0.024, 0.04), k=0.015))
# jambes : pantalon rouge, bottes noires à revers de fourrure
for s, b in LEG.items():
    body.append(cone('trouser', tuple(b + V(0, 0, HIP_Z + 0.02)), tuple(b + V(0.004, -0.01, KNEE_Z)), 0.095, 0.08, k=0.04))
    body.append(cone('boot', tuple(b + V(0.004, -0.01, KNEE_Z + 0.01)), tuple(b + V(0.006, 0, ANKLE_Z)), 0.08, 0.075, k=0.02))
    body.append(ell('boot', tuple(b + V(0.006, -0.06, 0.055)), (0.085, 0.14, 0.058), k=0.03))
    body.append(rbox('sole', tuple(b + V(0.006, -0.06, 0.012)), (0.088, 0.145, 0.012), r=0.008, k=0.01))
    body += ring('bootfur', tuple(b + V(0.004, -0.01, 0.27)), (0, 0, 1), 0.085, 0.085, 9, 0.034, k=0.02)

RED, FUR, BLACK = srgb('#d2202c'), srgb('#f8f5ef'), srgb('#1c161c')
COL = {'default': RED, 'coat': RED, 'coat_low': RED, 'sleeve': RED, 'trouser': srgb('#c01c28'), 'hat': RED,
       'hem': FUR, 'fur': FUR, 'cuff': FUR, 'bootfur': FUR, 'hatfur': FUR, 'pompom': FUR,
       'head': srgb('#f6c9a8'), 'nose': srgb('#f08070'), 'cheek': srgb('#f4a08c'),
       'brow': FUR, 'beard': FUR, 'stache': srgb('#ffffff'), 'mouth': srgb('#5a1018'),
       'mitt': BLACK, 'boot': BLACK, 'sole': srgb('#3a2a2a')}


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # bouche : intérieur rouge sombre, langue, dents du haut
    q = (co - MOUTH_C) / MOUTH_R
    rq = np.linalg.norm(q, axis=1)
    b = np.isin(tag, ('beard', 'head'))
    inside = b & (rq < 1.25)
    col[inside] = srgb('#5a1018')
    col[inside & (q[:, 2] < -0.3)] = srgb('#d0505a')
    col[inside & (q[:, 2] > 0.45) & (np.abs(x) < 0.04)] = srgb('#ffffff')
    # barbe : boucles légèrement grisées
    curl = np.sin(x * 70 + np.sin(z * 50) * 2) * np.sin(z * 60) > 0.5
    col[np.isin(tag, ('beard', 'brow', 'hem', 'fur', 'cuff', 'bootfur', 'hatfur', 'pompom')) & curl] = srgb('#dfe2ea')
    # ceinture noire
    belt = np.isin(tag, ('coat', 'fur')) & (np.abs(z - BELT_Z) < 0.038)
    col[belt] = BLACK
    # bonnet : un pli plus sombre
    col[(tag == 'hat') & (np.sin(co[:, 0] * 40 + co[:, 2] * 25) > 0.8)] = srgb('#b01824')
    # bottes : un reflet
    col[(tag == 'boot') & (nor[:, 2] > 0.6) & (z > 0.08)] = srgb('#3a3240')


K.log('maillage du corps')
BODY = sdf_mesh('Body', body, (-0.66, -0.48, 0.0), (0.66, 0.42, 1.56), vox=0.0055)
K.decimate(BODY, 9500)
BODY.data.validate()
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('PereNoel', rough=0.6))

# --- boucle de ceinture ---------------------------------------------------------------------------------------
by = surf_y(torso, 0, BELT_Z)
GOLD = K.mat('Or', '#ffcf3a', rough=0.25, metal=0.7)
BUCKLE = [K.box('Boucle', (0, by - 0.005, BELT_Z), (0.13, 0.03, 0.1), GOLD, rot_deg=(-12, 0, 0), bevel=0.008),
          K.box('BoucleTrou', (0, by - 0.017, BELT_Z), (0.075, 0.012, 0.05), K.mat('Cuir', '#1c161c', rough=0.5), rot_deg=(-12, 0, 0))]

# --- le sac de cadeaux (repère du sac : la poigne à l'origine, le sac pend vers -Z) -----------------------------
GRIP = ((WR + HD) / 2) * V(-1, 1, 1)
bag = [
    ell('sack', (0, 0.0, -0.42), (0.25, 0.235, 0.27), k=0.05),
    ell('sack', (0.0, 0.02, -0.25), (0.17, 0.16, 0.12), k=0.06),
    cone('sack', (0, 0, -0.15), (0, 0, -0.02), 0.09, 0.045, k=0.04),
    cone('sack', (0, 0, -0.01), (0, 0, 0.07), 0.045, 0.085, k=0.02),
    ell('rope', (0, 0, -0.035), (0.058, 0.058, 0.02), k=0.01),
    rbox('gift0', (0.03, 0.0, 0.11), (0.05, 0.05, 0.05), r=0.01, k=0.005, R=K.rot(15, 10, 30)),
    rbox('gift1', (-0.045, 0.015, 0.1), (0.04, 0.045, 0.055), r=0.01, k=0.005, R=K.rot(-10, -20, -15)),
    rbox('gift2', (0.0, -0.045, 0.085), (0.035, 0.035, 0.035), r=0.008, k=0.005, R=K.rot(25, 0, 10)),
]
bag = [dict(p, c=p['c'] + GRIP) if 'c' in p else dict(p, a=p['a'] + GRIP, b=p['b'] + GRIP) for p in bag]
BAGC = {'default': srgb('#b07a3e'), 'sack': srgb('#b07a3e'), 'rope': srgb('#5a3a1a'),
        'gift0': srgb('#3aa0ff'), 'gift1': srgb('#5fcf5a'), 'gift2': srgb('#ff5fd2')}


def bag_col(co, nor, col, tag):
    q = co - GRIP
    # rubans dorés sur les cadeaux, une pièce rapiécée sur le sac
    for g in ('gift0', 'gift1', 'gift2'):
        m = tag == g
        col[m & ((np.abs(q[:, 0] - np.median(q[m, 0]) if m.any() else 0) < 0.009) |
                 (np.abs(q[:, 1] - np.median(q[m, 1]) if m.any() else 0) < 0.009))] = srgb('#ffd23f')
    patch = (tag == 'sack') & (np.abs(q[:, 0] + 0.08) < 0.06) & (np.abs(q[:, 2] + 0.45) < 0.06) & (q[:, 1] < -0.1)
    col[patch] = srgb('#8a5a2a')
    col[(tag == 'sack') & (np.sin(q[:, 2] * 120) > 0.85)] *= 0.88


BAG = solid('Sac', bag, tuple(GRIP + V(-0.3, -0.3, -0.72)), tuple(GRIP + V(0.3, 0.3, 0.2)), BAGC, faces=1600, vox=0.0055,
            rough=0.8, extra=bag_col)

# --- yeux et paupières (pour plisser les yeux quand il rit) ---------------------------------------------------
EYE_L = V(0.074, -0.19, 1.25)
EYE_R = 0.04
EYES = K.eyes(tuple(EYE_L), EYE_R, pupil_dir=(0, -1, 0.05), pupil_r=0.5)
LIDM = K.mat('Paupiere', '#eeb898', rough=0.6)
LIDS = [lid('PaupiereG', EYE_L, EYE_R, LIDM), lid('PaupiereD', EYE_L * V(-1, 1, 1), EYE_R, LIDM)]

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 0.62))
K.bone('spine', (0, 0, 0.62), (0, 0, 1.02), 'root', True)
K.bone('head', (0, 0, 1.02), (0, 0, 1.4), 'spine', True)
K.bone('belly', (0, -0.12, 0.66), (0, -0.36, 0.66), 'root')
K.bone('coat', (0, 0.0, 0.56), (0, 0.02, 0.36), 'root')
K.bone('beard', BEARD[0] + V(0, 0.05, 0.08), BEARD[-1] + V(0, -0.02, -0.08), 'head')
K.bone('hat1', (0, -0.01, 1.37), HAT1, 'head')
K.bone('hat2', HAT1, HAT2, 'hat1', True)
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('lid' + s, EYE_L * m, EYE_L * m + V(0, -0.05, 0), 'head')
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0, HIP_Z), b + V(0.004, -0.01, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0.004, -0.01, KNEE_Z), b + V(0.006, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0.006, 0, ANKLE_Z), b + V(0.006, -0.17, 0.03), 'shin' + s, True)
K.bone('bag', GRIP, GRIP + V(0, 0, -0.25), 'handR')
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    z = p[2]
    if tg in ('head', 'nose', 'cheek', 'brow', 'stache', 'mouth', 'hatfur'):
        return ['head']
    if tg == 'beard':
        return ['head'] if z > 1.02 else ['head', 'beard']
    if tg == 'hat':
        return ['head', 'hat1'] if z < 1.42 else ['hat1', 'hat2']
    if tg == 'pompom':
        return ['hat2']
    if tg in ('coat', 'fur'):
        if z > 0.88:
            return ['spine'] + (['arm' + s] if abs(p[0]) > 0.2 and z > 0.94 else [])
        if z > 0.48:
            return ['root', 'spine'] + (['belly'] if p[1] < -0.12 and z < 0.86 else [])
        return ['root', 'coat']
    if tg in ('coat_low', 'hem'):
        return ['root', 'coat']
    if tg == 'sleeve':
        return (['spine'] if abs(p[0]) < 0.3 else []) + ['arm' + s, 'forearm' + s]
    if tg == 'cuff':
        return ['forearm' + s]
    if tg == 'mitt':
        return ['forearm' + s, 'hand' + s]
    if tg == 'trouser':
        return ['root', 'thigh' + s] if z > HIP_Z - 0.04 else ['thigh' + s, 'shin' + s]
    if tg in ('boot', 'sole', 'bootfur'):
        return ['shin' + s] if z > 0.12 else ['shin' + s, 'foot' + s]
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES:
    K.attach(o, 'head')
K.attach(LIDS[0], 'lidL')
K.attach(LIDS[1], 'lidR')
for o in BUCKLE:
    K.attach(o, 'belly')
K.attach(BAG, 'bag')

# --- animations ---------------------------------------------------------------------------------------------
ARM_R = ('root', 'spine', 'armR', 'forearmR', 'handR')
SHOULDER_BAG = wq([('x', 62)])            # le sac pend dans le dos, tenu par le col au-dessus de l'épaule


def carry(fk, bounce=0.0, sway=0.0):
    # bras droit replié, la main tient le col du sac au-dessus de l'épaule
    fk['armR'] = [('x', -62 - bounce * 0.3), ('y', 22)]
    fk['forearmR'] = [('x', -128 + bounce), ('y', -10)]
    fk['handR'] = [('x', -20)]
    fk['bag'] = hold(fk, ARM_R, wq([('x', 62 + bounce), ('y', sway)]))


def lids(fk, l, r=None):
    fk['lidL'] = [('x', l)]
    fk['lidR'] = [('x', l if r is None else r)]


def legs(fk, ph, lift=25, knee=40):
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (ph + o))
        up = max(0.0, math.cos(K.TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w), ('y', (1 if s == 'L' else -1) * -4)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -12 * up)]


def hohoho(t):
    """trois éclats de rire (ho, ho, ho) puis une pause : 0 → 1 à chaque éclat"""
    v = 0.0
    for c in (0.12, 0.27, 0.42):
        v = max(v, max(0.0, 1 - abs(t - c) / 0.07))
    return v


def idle(t):
    # ho ho ho : il rit en se tenant le ventre, la tête en arrière, le ventre et la barbe sautent
    h = hohoho(t)
    laugh = max(0.0, 1 - max(0.0, t - 0.45) / 0.3) * min(1.0, t / 0.08) if t < 0.75 else 0.0
    fk = {'root': [('x', -3 * laugh)], 'spine': [('x', -6 * laugh - 3 * h)],
          'head': [('x', -14 * laugh - 6 * h), ('y', 3 * K.wave(t))],
          'belly': [('x', -10 * h)], 'beard': [('x', 6 * h)], 'coat': [('x', -3 * h)],
          'hat1': [('x', -8 * h)], 'hat2': [('x', -10 * h + 4 * K.wave(t))],
          'armL': [('x', -40), ('y', 10)], 'forearmL': [('y', 40), ('x', -8 * h)], 'handL': [('y', 25)]}
    legs(fk, 0, 0, 0)
    carry(fk, bounce=6 * h)
    lids(fk, 60 + 55 * laugh)
    return pose(fk, root=(0, 0, 0.025 * h))


def walk(t):
    # marche joviale : il se dandine, le ventre rebondit, le bras libre se balance, le pompon suit
    b = K.hop(t, 2)
    fk = {'root': [('y', 6 * K.wave(t)), ('z', 5 * K.wave(t))], 'spine': [('y', -4 * K.wave(t)), ('x', -3)],
          'head': [('x', -4 + 4 * b), ('y', -3 * K.wave(t))],
          'belly': [('x', 8 * K.wave(t, 2, 0.1))], 'beard': [('x', -5 * K.wave(t, 2, 0.15))], 'coat': [('x', 4 * K.wave(t, 2))],
          'hat1': [('y', -6 * K.wave(t, 1, -0.1))], 'hat2': [('y', -10 * K.wave(t, 1, -0.2)), ('x', 6 * K.wave(t, 2, -0.2))],
          'armL': [('x', 30 * K.wave(t, 1, 0.5)), ('y', -12)], 'forearmL': [('x', -25 - 10 * K.wave(t, 1, 0.5))]}
    legs(fk, t, 28, 42)
    carry(fk, bounce=5 * K.wave(t, 2, 0.1), sway=6 * K.wave(t))
    lids(fk, 62)
    return pose(fk, root=(0.02 * K.wave(t), 0, 0.03 * b))


def run(t):
    # pas pressés, penché en avant, le ventre qui ballotte
    b = K.hop(t, 2)
    fk = {'root': [('x', 10), ('y', 7 * K.wave(t)), ('z', 6 * K.wave(t))], 'head': [('x', -10)],
          'belly': [('x', 12 * K.wave(t, 2, 0.1))], 'beard': [('x', -10 + 6 * K.wave(t, 2, 0.15))], 'coat': [('x', 10 + 6 * K.wave(t, 2))],
          'hat1': [('x', 12), ('y', -8 * K.wave(t, 1, -0.1))], 'hat2': [('x', 16), ('y', -12 * K.wave(t, 1, -0.2))],
          'armL': [('x', 50 * K.wave(t, 1, 0.5)), ('y', -15)], 'forearmL': [('x', -60)]}
    legs(fk, t, 40, 70)
    carry(fk, bounce=10 * K.wave(t, 2, 0.1), sway=8 * K.wave(t))
    lids(fk, 55)
    return pose(fk, root=(0.02 * K.wave(t), 0, 0.07 * b))


def warn(t):
    # sursaut : il se redresse d'un coup, main levée, yeux ronds, le bonnet se dresse
    e = min(1.0, t / 0.4)
    jump = math.sin(math.pi * min(1.0, t / 0.7))
    fk = {'root': [('x', -6 * e)], 'spine': [('x', -4 * e)], 'head': [('x', -8 * e)],
          'belly': [('x', -8 * jump)], 'beard': [('x', 8 * jump)],
          'hat1': [('x', -25 * jump)], 'hat2': [('x', -20 * jump)],
          'armL': [('y', -60 * e), ('x', -40 * e)], 'forearmL': [('x', -70 * e)], 'handL': [('x', -20 * e)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -12 * jump)]
        fk['shin' + s] = [('x', 25 * jump)]
    carry(fk, bounce=-15 * jump)
    lids(fk, 60 * (1 - e) - 15 * e)
    return pose(fk, root=(0, 0.02 * e, 0.08 * jump))


def wave_hello(t):
    # geste amical : la main gauche salue bien haut, il hoche la tête (ho ho)
    n = K.hop(t, 2)
    fk = {'spine': [('y', -4), ('x', -3)], 'head': [('x', 6 * n - 4), ('z', 8), ('y', -5)],
          'belly': [('x', -6 * n)], 'beard': [('x', 4 * n)],
          'hat2': [('y', 8 * K.wave(t, 2, -0.2))],
          'armL': [('y', -150), ('x', -10)], 'forearmL': [('y', -25 - 25 * K.wave(t, 2))], 'handL': [('y', -20 * K.wave(t, 2, -0.1))]}
    legs(fk, 0, 0, 0)
    carry(fk, bounce=4 * n)
    lids(fk, 70 + 40 * n)
    return pose(fk, root=(0, 0, 0.015 * n))


def dance(t):
    # disco : le doigt gauche pointe en l'air puis vers le sol, hanches qui roulent, le ventre bat la mesure
    b = K.hop(t, 2)
    side = K.wave(t, 1)
    up = side > 0
    fk = {'root': [('y', 8 * side), ('z', 10 * side)], 'spine': [('y', -6 * side)],
          'head': [('y', 10 * side), ('x', -8 * b)],
          'belly': [('x', 12 * K.wave(t, 2, 0.1))], 'beard': [('x', -6 * K.wave(t, 2, 0.15))], 'coat': [('x', 6 * K.wave(t, 2))],
          'hat1': [('y', -10 * side)], 'hat2': [('y', -16 * K.wave(t, 1, -0.15)), ('x', 8 * K.wave(t, 2, -0.2))],
          'armL': [('y', -150 if up else -30), ('x', -20 if up else -40), ('z', 0 if up else 30)], 'forearmL': [('y', -10)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -18 * (1 - b)), ('y', 8 * side)]
        fk['shin' + s] = [('x', 32 * (1 - b))]
    carry(fk, bounce=10 * K.wave(t, 2, 0.1), sway=15 * side)
    lids(fk, 90 + 30 * b)
    return pose(fk, root=(0.04 * side, 0, -0.05 * (1 - b)))


def fly(t):
    # il s'envole : bras en l'air, le sac agité au-dessus de la tête, les jambes pédalent, le manteau flotte
    sw = K.wave(t, 1)
    fk = {'root': [('x', -6), ('y', 5 * K.wave(t, 1, 0.25))], 'spine': [('x', -6)], 'head': [('x', -18), ('y', -6 * sw)],
          'belly': [('x', 8 * K.wave(t, 2))], 'beard': [('x', 14 + 6 * K.wave(t, 2, 0.2))], 'coat': [('x', 25 + 10 * K.wave(t, 2))],
          'hat1': [('x', 30 + 8 * K.wave(t, 2))], 'hat2': [('x', 25 + 10 * K.wave(t, 2, -0.2))],
          'armL': [('y', -160 + 10 * K.wave(t, 2)), ('x', -5)], 'forearmL': [('y', -10 + 15 * K.wave(t, 2, 0.3))],
          'handL': [('y', -25 * K.wave(t, 2, 0.1))],
          'armR': [('y', 150 + 18 * sw), ('x', -10)], 'forearmR': [('y', 20 + 15 * sw)], 'handR': [('y', 10 * sw)]}
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (t + o))
        fk['thigh' + s] = [('x', -25 - 25 * w)]
        fk['shin' + s] = [('x', 45 + 30 * max(0.0, -w))]
        fk['foot' + s] = [('x', 30)]
    fk['bag'] = hold(fk, ARM_R, wq([('y', 150 + 40 * sw), ('x', 15 * K.wave(t, 2))]))
    lids(fk, 45)
    return pose(fk, root=(0, 0, 0.1 + 0.05 * K.wave(t, 1, 0.25)))


K.bake([('Idle', 60, idle), ('Walk', 30, walk), ('Run', 20, run), ('Warn', 16, warn), ('Hit', 30, wave_hello),
        ('Dance', 32, dance), ('Fly', 30, fly)])
K.log('triangles', tris(), 'dont corps', sum(len(f.vertices) - 2 for f in BODY.data.polygons),
      'hauteur', round(max((o.matrix_world @ v.co).z for o in bpy.data.objects if o.type == 'MESH' for v in o.data.vertices), 3))

if os.environ.get("DBG"):
    exec(open(os.environ["DBG_SCRIPT"]).read())
    sys.exit(0)
K.preview([
    ('face', 'Idle', 0, (0.3, -3.8, 1.1), (0, 0, 0.8)),
    ('troisquarts', 'Idle', 0, (2.6, -2.8, 1.8), (0, 0, 0.8)),
    ('visage', 'Idle', 0, (0.2, -1.5, 1.25), (0, 0, 1.1)),
    ('rire', 'Idle', 8, (1.0, -3.4, 1.3), (0, 0, 0.85)),
    ('dos', 'Walk', 0, (-1.6, 3.2, 1.8), (0, 0, 0.8)),
    ('dessus', 'Walk', 0, (1.8, -2.1, 3.6), (0, 0, 0.7)),
    ('marche', 'Walk', 8, (3.0, -1.8, 1.2), (0, 0, 0.8)),
    ('alerte', 'Warn', 16, (1.2, -3.4, 1.2), (0, 0, 0.8)),
    ('salut', 'Hit', 8, (1.2, -3.4, 1.2), (0, 0, 0.85)),
    ('danse', 'Dance', 8, (0.8, -3.6, 1.3), (0, 0, 0.9)),
    ('course', 'Run', 5, (3.0, -1.8, 1.2), (0, 0, 0.8)),
    ('vol', 'Fly', 7, (1.6, -3.4, 1.4), (0, 0, 1.0)),
    ('vol2', 'Fly', 22, (1.6, -3.4, 1.4), (0, 0, 1.0)),
    ('vol_dessus', 'Fly', 12, (1.8, -2.1, 3.8), (0, 0, 0.9)),
])
K.export()
shutil.rmtree(WORK, ignore_errors=True)
