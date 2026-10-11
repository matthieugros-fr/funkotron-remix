# La danseuse hawaïenne : jupe de raphia (plusieurs os pour qu'elle ondule), collier de fleurs, fleur d'hibiscus dans
# les longs cheveux noirs, peau bronzée, grand sourire, bracelets de fleurs aux poignets.
#   Blender -b -P tools/blender/terriens/hula.py -- public/models/terriens/hula.glb [dossier_aperçus]
# Clips : Idle (hula lent), Walk (pas de danse), Run, Warn (mains aux joues), Hit (« aloha » de la main), Dance (hula endiablé).
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
OUT = argv[0] if argv else '/tmp/hula.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('hula', OUT, PREVIEW)
# volumes de travail dans un dossier à soi (d'autres terriens se fabriquent peut-être en même temps)
WORK = tempfile.mkdtemp(prefix='terrien_hula_')
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


def ground(fk, scale=None):
    """hauteur à donner à la racine pour que le pied le plus bas touche le sol (les rotations « monde » des os se
    composent à gauche le long de la chaîne racine → cuisse → tibia → pied)"""
    Wr = wq(fk.get('root', []))
    r0 = Vector(tuple(ROOT0))
    sc = Vector(scale) if scale else Vector((1, 1, 1))
    low = 1e9
    for s in ('L', 'R'):
        hip, knee, ankle = (Vector(tuple(p)) for p in LEGPTS[s])
        Wt = Wr @ wq(fk.get('thigh' + s, []))
        Ws = Wt @ wq(fk.get('shin' + s, []))
        Wf = Ws @ wq(fk.get('foot' + s, []))
        a = hip + Wt @ (knee - hip) + Ws @ (ankle - knee)
        for q in SOLE[s]:
            p = a + Wf @ (Vector(tuple(q)) - ankle) - r0
            p = Wr @ (sc * (Wr.inverted() @ p))
            low = min(low, (r0 + p).z)
    return -low


def liner(name, c, r, m, open_deg=-90, rx=1.04, ryz=1.22, frac=0.25):
    """trait de cils au bord de la paupière (demi-anneau sur le devant), même pivot et même forme que la paupière"""
    o = K.torus(name, (0, 0, 0), 1.0, 0.14, m, seg=20)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > frac], context='VERTS')
    bmesh.ops.scale(bm, verts=bm.verts[:], vec=(r * rx, r * ryz, r * 0.8))
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(open_deg), 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=Vector(tuple(c)))
    bm.to_mesh(o.data)
    bm.free()
    return o


def flower(tag, c, n, r, petals=5, ctag='flc', R=None, k=0.006):
    """une fleur : cœur + pétales dans le plan perpendiculaire à n (rayon r)"""
    n = np.array(n, float)
    n /= np.linalg.norm(n)
    a = np.cross(n, (0, 0, 1) if abs(n[2]) < 0.9 else (1, 0, 0))
    a /= np.linalg.norm(a)
    b = np.cross(n, a)
    c = np.array(c, float)
    out = [ell(ctag, tuple(c + n * r * 0.15), (r * 0.32, r * 0.32, r * 0.32), k=k)]
    for i in range(petals):
        ang = K.TAU * i / petals
        d = a * math.cos(ang) + b * math.sin(ang)
        out.append(ell(tag, tuple(c + d * r * 0.55), (r * 0.42, r * 0.17, r * 0.55), k=k, R=frame(d, np.cross(n, d))))
    return out


# =====================================================================================================
# proportions
# =====================================================================================================
HIP_Z = 0.74
HEAD_C = V(0, -0.01, 1.18)
SH = V(0.155, 0.0, 1.0)        # épaule gauche
EL = V(0.24, 0.005, 0.83)
WR = V(0.28, -0.025, 0.68)
HD = V(0.29, -0.045, 0.59)
LEG = {'L': V(0.075, 0.0, 0), 'R': V(-0.075, 0.0, 0)}
KNEE_Z, ANKLE_Z = 0.38, 0.07
MOUTH_C, MOUTH_R = V(0, -0.17, 1.096), V(0.066, 0.045, 0.04)

body = [
    # buste fin, poitrine sous un bandeau, taille marquée, hanches rondes (sous la jupe)
    ell('torso', (0, 0.0, 0.93), (0.135, 0.095, 0.1), k=0.04),
    ell('top', (0.058, -0.058, 0.935), (0.06, 0.055, 0.055), k=0.03),
    ell('top', (-0.058, -0.058, 0.935), (0.06, 0.055, 0.055), k=0.03),
    cone('torso', (0, 0, 0.9), (0, 0.005, 0.79), 0.105, 0.095, k=0.04),
    ell('hips', (0, 0.012, 0.75), (0.145, 0.115, 0.1), k=0.04),
    cone('neck', (0, 0, 0.99), (0, 0.0, 1.07), 0.045, 0.045, k=0.03),
    # la tête : visage rond, petit menton, petit nez, oreilles
    ell('head', tuple(HEAD_C), (0.18, 0.17, 0.19), k=0.04),
    ell('head', (0, -0.05, 1.075), (0.12, 0.11, 0.08), k=0.05),
    ell('nose', (0, -0.183, 1.155), (0.024, 0.026, 0.03), k=0.02),
    ell('ear', (0.176, 0.0, 1.17), (0.022, 0.035, 0.045), k=0.015),
    ell('ear', (-0.176, 0.0, 1.17), (0.022, 0.035, 0.045), k=0.015),
    ell('brow', (0.074, -0.156, 1.28), (0.044, 0.012, 0.009), k=0.008, R=K.rot(0, 18, 0)),
    ell('brow', (-0.074, -0.156, 1.28), (0.044, 0.012, 0.009), k=0.008, R=K.rot(0, -18, 0)),
    # le grand sourire : un creux, que la lèvre du haut referme par-dessus → un croissant aux coins relevés
    ell('mouth', tuple(MOUTH_C), tuple(MOUTH_R), k=0.01, op='sub'),
    ell('lip', (0, -0.142, 1.124), (0.078, 0.04, 0.036), k=0.008),
]
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('arm', tuple(SH * m), tuple(EL * m), 0.042, 0.034, k=0.03))
    body.append(cone('arm', tuple(EL * m), tuple(WR * m), 0.034, 0.027, k=0.02))
    body.append(ell('hand', tuple(((WR + HD) / 2) * m), (0.022, 0.04, 0.055), k=0.02))
    body.append(ell('hand', tuple((WR + V(-0.012, -0.03, -0.025)) * m), (0.012, 0.012, 0.026), k=0.012))
for s, b in LEG.items():
    body.append(cone('leg', tuple(b + V(0, 0, HIP_Z)), tuple(b + V(0.004, -0.01, KNEE_Z)), 0.07, 0.046, k=0.04))
    body.append(cone('leg', tuple(b + V(0.004, -0.01, KNEE_Z)), tuple(b + V(0.006, 0.0, ANKLE_Z + 0.02)), 0.046, 0.031, k=0.02))
    body.append(ell('foot', tuple(b + V(0.006, -0.045, 0.03)), (0.038, 0.082, 0.03), k=0.025))

SKIN = srgb('#d29468')
COL = {'default': SKIN, 'torso': SKIN, 'hips': SKIN, 'neck': SKIN, 'head': SKIN, 'arm': SKIN, 'hand': SKIN, 'leg': SKIN,
       'foot': SKIN, 'nose': srgb('#bf7c4e'), 'ear': srgb('#bf7c4e'), 'brow': srgb('#1a0e0a'), 'top': srgb('#e8334a'),
       'mouth': srgb('#5a1018'), 'lip': SKIN}


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    # bouche : dents en haut, intérieur sombre, langue en bas, lèvres fines, joues à peine rosées
    q = (co - MOUTH_C) / MOUTH_R
    rq = np.linalg.norm(q, axis=1)
    head = np.isin(tag, ('head', 'lip'))
    inside = head & (rq < 1.12) & (y > -0.2)
    col[inside] = srgb('#5a1018')
    col[inside & (q[:, 2] < -0.55)] = srgb('#d0505a')
    lip = (tag == 'lip') & (rq < 1.3)
    col[lip & (nor[:, 2] < -0.35) & (y > -0.172)] = srgb('#5a1018')
    col[lip & (z < 1.106) & (y < -0.166)] = srgb('#d8344a')
    col[head & ~inside & (rq < 1.3) & (q[:, 2] < -0.3) & (y < -0.15)] = srgb('#d8344a')
    cheek = head & (np.abs(np.abs(x) - 0.11) < 0.028) & (np.abs(z - 1.13) < 0.02) & (y < -0.1)
    col[cheek] = col[cheek] * 0.6 + srgb('#ff8a7a') * 0.4
    # bandeau rouge à petites fleurs jaunes, tout autour du buste
    band = (tag == 'torso') & (np.abs(z - 0.935) < 0.045)
    col[band] = srgb('#e8334a')
    tp = (tag == 'top') | band
    dots = (np.sin(x * 140) * np.sin(z * 140 + y * 60) > 0.75)
    col[tp & dots] = srgb('#ffd23f')
    # nombril
    col[(tag == 'torso') & (np.abs(x) < 0.008) & (np.abs(z - 0.83) < 0.008) & (y < -0.05)] = srgb('#8a5232')
    # ongles des pieds
    col[(tag == 'foot') & (y < -0.115) & (z > 0.025)] = srgb('#ff6f8a')


K.log('maillage du corps')
BODY = sdf_mesh('Body', body, (-0.36, -0.3, 0.0), (0.36, 0.26, 1.4), vox=0.0045)
K.decimate(BODY, 6000)
BODY.data.validate()
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Danseuse', rough=0.5))

# --- les cheveux : longs, noirs, une frange, à part du corps pour pouvoir onduler sans le déchirer -------------
hair = [
    ell('hair', (0, 0.04, 1.222), (0.203, 0.198, 0.203), k=0.04),
    ell('hair', (0.163, 0.0, 1.17), (0.05, 0.12, 0.15), k=0.05),
    ell('hair', (-0.163, 0.0, 1.17), (0.05, 0.12, 0.15), k=0.05),
    ell('hair', (0.03, -0.132, 1.318), (0.13, 0.04, 0.034), k=0.04, R=K.rot(0, 12, 0)),
    cone('hairlong', (0, 0.1, 1.2), (0, 0.15, 0.9), 0.17, 0.13, k=0.05),
    ell('hairlong', (0, 0.155, 0.86), (0.13, 0.07, 0.07), k=0.05),
    cone('hairlong', (0.15, 0.06, 1.16), (0.165, 0.11, 0.94), 0.06, 0.04, k=0.05),
    cone('hairlong', (-0.15, 0.06, 1.16), (-0.165, 0.11, 0.94), 0.06, 0.04, k=0.05),
]
HAIR = sdf_mesh('Cheveux', hair, (-0.3, -0.25, 0.75), (0.3, 0.32, 1.45), vox=0.006)
K.decimate(HAIR, 1100, symmetric=False)
HAIR.data.validate()
HCO, HTAG = K.paint(HAIR, hair, {'default': srgb('#1a1010')},
                    lambda co, nor, col, tag: col.__setitem__(np.sin(co[:, 0] * 90 + co[:, 2] * 8) > 0.7, srgb('#3a2626')))
HAIR.data.materials.append(K.vc_material('Cheveux', rough=0.35))

# --- la jupe de raphia : des brins fondus à la ceinture, libres en bas ----------------------------------------
NS = 30
skirt = [ell('band', (0, 0.012, 0.795), (0.168, 0.138, 0.036), k=0.015)]
for i in range(NS):
    a = K.TAU * i / NS
    ca, sa = math.cos(a), math.sin(a)
    top = (0.15 * ca, 0.012 + 0.122 * sa, 0.8)
    zb = 0.4 + 0.03 * math.sin(i * 2.7) + 0.015 * math.sin(i * 5.1)
    bot = (0.275 * ca, 0.012 + 0.25 * sa, zb)
    skirt.append(cone(f'st{i % 3}', top, bot, 0.03, 0.019, k=0.008))
SKIRT = sdf_mesh('Jupe', skirt, (-0.34, -0.3, 0.33), (0.34, 0.32, 0.86), vox=0.0045)
K.decimate(SKIRT, 2300, symmetric=False)
SKIRT.data.validate()


def skirt_col(co, nor, col, tag):
    # le haut des brins plus sombre, de fines stries claires
    col[(co[:, 2] > 0.74) & (tag != 'band')] *= 0.75
    col[(np.sin(np.arctan2(co[:, 1], co[:, 0]) * 90) > 0.6) & (tag != 'band')] *= 1.25


SCO, STAG = K.paint(SKIRT, skirt, {'default': srgb('#5fcf5a'), 'st0': srgb('#5fcf5a'), 'st1': srgb('#8ad85a'),
                                   'st2': srgb('#c8d860'), 'band': srgb('#8a5a2a')}, skirt_col)
SKIRT.data.materials.append(K.vc_material('Raphia', rough=0.7))

# --- fleurs : collier, hibiscus dans les cheveux, bracelets ---------------------------------------------------
FLC = {'default': srgb('#ff5fd2'), 'flc': srgb('#ffb000'), 'f0': srgb('#ff5fd2'), 'f1': srgb('#ffd23f'),
       'f2': srgb('#fff4ec'), 'f3': srgb('#ff7a3a'), 'hib': srgb('#ff3f8a'), 'stam': srgb('#ffe14a')}
lei = []
for i in range(16):
    a = K.TAU * i / 16
    p = V(0.142 * math.cos(a), -0.008 + 0.118 * math.sin(a), 0.99 + 0.042 * math.sin(a))
    nrm = V(math.cos(a) * 0.6, math.sin(a) * 0.6, 1.0) * V(1, 1, 1)
    nrm = nrm + V(0, -0.9 if math.sin(a) < -0.2 else 0, 0)
    lei += flower(f'f{i % 4}', p, nrm, 0.036)
LEI = solid('Collier', lei, (-0.22, -0.2, 0.9), (0.22, 0.16, 1.08), FLC, faces=950, vox=0.0028, rough=0.6)
hib = flower('hib', (0.195, -0.04, 1.29), (0.85, -0.45, 0.35), 0.075, ctag='stam', k=0.01)
hib.append(cone('stam', (0.207, -0.045, 1.295), (0.242, -0.07, 1.31), 0.007, 0.005, k=0.004))
HIB = solid('Hibiscus', hib, (0.07, -0.16, 1.18), (0.33, 0.07, 1.4), FLC, faces=350, vox=0.0028, rough=0.6)
BRACE = []
for sx, s in ((1, 'L'), (-1, 'R')):
    m = V(sx, 1, 1)
    c = (WR + (EL - WR) * 0.12) * m
    ax_ = (EL - WR) * m
    ax_ = ax_ / np.linalg.norm(ax_)
    u = np.cross(ax_, (0, 1, 0))
    u /= np.linalg.norm(u)
    w = np.cross(ax_, u)
    fl = []
    for i in range(7):
        a = K.TAU * i / 7
        d = u * math.cos(a) + w * math.sin(a)
        fl += flower(f'f{(i + (1 if sx > 0 else 3)) % 4}', c + d * 0.034, d, 0.022)
    BRACE.append(solid('Bracelet' + s, fl, tuple(c - 0.08), tuple(c + 0.08), FLC, faces=300, vox=0.0026, rough=0.6))

# --- yeux, paupières, cils -------------------------------------------------------------------------------------
EYE_L = V(0.068, -0.15, 1.2)
EYE_R = 0.048
EYES = K.eyes(tuple(EYE_L), EYE_R, pupil_dir=(0, -1, 0.0), pupil='#2a1408', pupil_r=0.55)
LIDM, LINER = K.mat('Paupiere', '#b87a4c', rough=0.6), K.mat('Cils', '#120808', rough=0.4)
LIDS = [lid('PaupiereG', EYE_L, EYE_R, LIDM), lid('PaupiereD', EYE_L * V(-1, 1, 1), EYE_R, LIDM)]
LINERS = [liner('CilsG', EYE_L, EYE_R, LINER), liner('CilsD', EYE_L * V(-1, 1, 1), EYE_R, LINER)]
# les dents : le bas d'un ellipsoïde caché sous la lèvre du haut, qui suit la courbe du sourire
TEETH = K.sphere('Dents', (0, -0.15, 1.113), 1.0, K.mat('Dents', '#ffffff', rough=0.2), scale=(0.066, 0.025, 0.036), seg=20)

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 0.86))
K.bone('spine', (0, 0, 0.86), (0, 0, 1.0), 'root', True)
K.bone('head', (0, 0, 1.0), (0, 0, 1.38), 'spine', True)
K.bone('hair1', (0, 0.15, 1.12), (0, 0.17, 0.98), 'head')
K.bone('hair2', (0, 0.17, 0.98), (0, 0.17, 0.84), 'hair1', True)
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('lid' + s, EYE_L * m, EYE_L * m + V(0, -0.05, 0), 'head')
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0, HIP_Z), b + V(0.004, -0.01, KNEE_Z), 'root')
    K.bone('shin' + s, b + V(0.004, -0.01, KNEE_Z), b + V(0.006, 0, ANKLE_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0.006, 0, ANKLE_Z), b + V(0.006, -0.12, 0.02), 'shin' + s, True)
NCH = 8
SK_ANG = [K.TAU * j / NCH for j in range(NCH)]
for j, a in enumerate(SK_ANG):
    ca, sa = math.cos(a), math.sin(a)
    K.bone(f'skirt{j}', (0.15 * ca, 0.012 + 0.122 * sa, 0.8), (0.212 * ca, 0.012 + 0.186 * sa, 0.6), 'root')
    K.bone(f'skirt{j}b', (0.212 * ca, 0.012 + 0.186 * sa, 0.6), (0.275 * ca, 0.012 + 0.25 * sa, 0.4), f'skirt{j}', True)
K.rig_end()
ROOT0 = V(0, 0, HIP_Z)
LEGPTS = {s: (b + V(0, 0, HIP_Z), b + V(0.004, -0.01, KNEE_Z), b + V(0.006, 0, ANKLE_Z)) for s, b in LEG.items()}
# le dessous du pied : un ellipsoïde (centre y -0.045, z 0.03 ; demi-axes 0.038, 0.082, 0.03) échantillonné
SOLE = {s: [b + V(0.006 + 0.038 * math.sin(u) * math.cos(v), -0.045 + 0.082 * math.sin(v), 0.03 - 0.03 * math.cos(u) * math.cos(v))
            for u in np.radians((-60, 0, 60)) for v in np.radians((-75, -40, 0, 40, 75))] for s, b in LEG.items()}


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    z = p[2]
    if tg in ('head', 'nose', 'ear', 'brow', 'mouth', 'lip'):
        return ['head']
    if tg == 'neck':
        return ['spine', 'head']
    if tg in ('torso', 'top'):
        if z > 0.86:
            return ['spine'] + (['arm' + s] if abs(p[0]) > 0.12 and z > 0.95 else [])
        return ['root', 'spine']
    if tg == 'hips':
        return ['root'] + (['thigh' + s] if z < 0.72 and abs(p[0]) > 0.04 else [])
    if tg == 'arm':
        return (['spine'] if abs(p[0]) < 0.17 and p[2] > 0.95 else []) + ['arm' + s, 'forearm' + s]
    if tg == 'hand':
        return ['forearm' + s, 'hand' + s]
    if tg == 'leg':
        return ['root', 'thigh' + s] if z > HIP_Z - 0.05 else ['thigh' + s, 'shin' + s]
    if tg == 'foot':
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


def allowed_hair(tg, p):
    if p[2] > 1.16 or tg == 'hair':
        return ['head']
    return ['head', 'hair1', 'hair2'] if p[2] > 1.05 else ['hair1', 'hair2']


def allowed_skirt(tg, p):
    if tg == 'band':
        return ['root']
    a = math.atan2((p[1] - 0.012) / 0.95, p[0]) % K.TAU
    j0 = int(a / (K.TAU / NCH)) % NCH
    j1 = (j0 + 1) % NCH
    out = [f'skirt{j0}', f'skirt{j0}b', f'skirt{j1}', f'skirt{j1}b']
    return (['root'] if p[2] > 0.76 else []) + out


W = K.skin(BODY, CO, TAG, allowed)
K.skin(HAIR, HCO, HTAG, allowed_hair)
K.skin(SKIRT, SCO, STAG, allowed_skirt, smooth=3)
for o in EYES + [HIB, TEETH]:
    K.attach(o, 'head')
for s in ('L', 'R'):
    i = 0 if s == 'L' else 1
    K.attach(LIDS[i], 'lid' + s)
    K.attach(LINERS[i], 'lid' + s)
K.attach(LEI, 'spine')
K.attach(BRACE[0], 'forearmL')
K.attach(BRACE[1], 'forearmR')


# --- animations ---------------------------------------------------------------------------------------------
OPEN = 52     # paupières : juste un liseré de cils au-dessus de la pupille


def lids(fk, l, r=None):
    fk['lidL'] = [('x', l)]
    fk['lidR'] = [('x', l if r is None else r)]


def blink(t, at=0.55, dur=0.08):
    d = abs(t - at)
    return OPEN + (175 - OPEN) * max(0.0, 1 - d / dur)


def hips(fk, shift, tilt, twist, bend=1.0, knee=1.0):
    """balancé des hanches : la racine glisse et bascule, le buste compense, les pieds restent posés"""
    fk['root'] = [('y', tilt), ('z', twist)]
    fk['spine'] = [('y', -tilt * 1.3), ('z', -twist * 0.6)]
    lean = math.degrees(math.atan2(shift, 0.66))
    for s, sg in (('L', 1), ('R', -1)):
        # la jambe du côté où partent les hanches se tend, l'autre plie
        k = bend * (1 - 0.5 * sg * shift / 0.05) * knee
        fk['thigh' + s] = [('x', -10 * k), ('y', -tilt + lean), ('z', -twist)]
        fk['shin' + s] = [('x', 22 * k)]
        fk['foot' + s] = [('x', -12 * k)]


def arms_sweep(fk, w, t, n=4, amp=1.0, up=0.0):
    """bras du hula : w = +1 les deux bras vers sa gauche, -1 vers sa droite ; mains qui ondulent"""
    a, b = (1 + w) / 2, (1 - w) / 2
    fk['armL'] = [('y', -82 * a - 15 * b - up), ('x', -10 * a - 78 * b), ('z', -30 * b)]
    fk['forearmL'] = [('y', 75 * b - 8 * a), ('x', -8 * a)]
    fk['armR'] = [('y', 82 * b + 15 * a + up), ('x', -10 * b - 78 * a), ('z', 30 * a)]
    fk['forearmR'] = [('y', -75 * a + 8 * b), ('x', -8 * b)]
    for s, sg, ph in (('L', -1, 0.0), ('R', 1, 0.5)):
        fk['forearm' + s] += [('y', sg * 8 * amp * K.wave(t, n, ph))]
        fk['hand' + s] = [('y', sg * 28 * amp * K.wave(t, n, ph - 0.15)), ('x', 6 * amp * K.wave(t, n, ph + 0.1))]


def skirt(fk, t, flare=4.0, ripple=4.0, n=2, sway=0.0, swing=0.0, ph=0.0):
    """la jupe : évasement, ondulation qui court tout autour, balancement en retard sur les hanches"""
    for j, a in enumerate(SK_ANG):
        tau = (-math.sin(a), math.cos(a), 0)
        r = ripple * math.sin(K.TAU * (n * t + ph) - 2 * a)
        fk[f'skirt{j}'] = [(tau, -(flare + r)), ('y', -sway), ('x', swing)]
        fk[f'skirt{j}b'] = [(tau, -(flare * 0.5 + r * 0.8)), ('y', -sway * 0.6), ('x', swing * 0.6)]


def hair(fk, side, back=0.0):
    fk['hair1'] = [('y', side), ('x', back)]
    fk['hair2'] = [('y', side * 0.8), ('x', back * 0.6)]


def idle(t):
    # hula lent et gracieux : deux balancés de hanches, les bras passent d'un côté à l'autre, mains qui ondulent
    s = K.wave(t, 2)
    fk = {}
    hips(fk, 0.04 * s, 7 * s, 6 * K.wave(t, 2, 0.25))
    arms_sweep(fk, K.wave(t, 1, 0.25), t, n=4)
    fk['head'] = [('y', 4 * K.wave(t, 2, 0.5)), ('z', -10 * K.wave(t, 1, 0.25)), ('x', -3)]
    skirt(fk, t, flare=4, ripple=4, n=2, sway=6 * K.wave(t, 2, -0.12), swing=2 * K.wave(t, 2, 0.13))
    hair(fk, -5 * K.wave(t, 2, -0.15))
    lids(fk, blink(t))
    return pose(fk, root=(0.04 * s, 0, ground(fk)))


def walk(t):
    # pas de danse : petits pas genoux pliés, les hanches roulent à chaque pas, les bras ondulent
    s = K.wave(t, 1)
    fk = {}
    hips(fk, 0.03 * s, 8 * s, 6 * K.wave(t, 1, 0.25), bend=0.6)
    for sd, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (t + o))
        up = max(0.0, math.cos(K.TAU * (t + o)))
        fk['thigh' + sd] = [('x', -22 * w - 10 - 10 * up)] + fk['thigh' + sd][1:]
        fk['shin' + sd] = [('x', 25 + 35 * up)]
        fk['foot' + sd] = [('x', -10 - 15 * up)]
    arms_sweep(fk, 0.8 * s, t, n=2)
    fk['head'] = [('y', 5 * K.wave(t, 1, 0.5)), ('z', -8 * s)]
    skirt(fk, t, flare=6, ripple=5, n=2, sway=8 * K.wave(t, 1, -0.12), swing=4 + 3 * K.wave(t, 2))
    hair(fk, -6 * K.wave(t, 1, -0.15), -4 * K.hop(t, 2))
    lids(fk, OPEN)
    return pose(fk, root=(0.03 * s, 0, ground(fk) + 0.025 * K.hop(t, 2)))


def run(t):
    # pas chassés rapides, bras tendus de côté qui ondulent, jupe qui vole
    s = K.wave(t, 1)
    fk = {}
    hips(fk, 0.03 * s, 10 * s, 8 * K.wave(t, 1, 0.25), bend=0.8)
    for sd, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (t + o))
        up = max(0.0, math.cos(K.TAU * (t + o)))
        fk['thigh' + sd] = [('x', -38 * w - 15 - 15 * up)] + fk['thigh' + sd][1:]
        fk['shin' + sd] = [('x', 25 + 60 * up)]
        fk['foot' + sd] = [('x', -10 - 20 * up)]
    fk['root'] += [('x', 10)]
    fk['armL'] = [('y', -75), ('x', 20 * s)]
    fk['armR'] = [('y', 75), ('x', -20 * s)]
    for sd, sg, ph in (('L', -1, 0.0), ('R', 1, 0.5)):
        fk['forearm' + sd] = [('y', sg * 15 * K.wave(t, 2, ph))]
        fk['hand' + sd] = [('y', sg * 30 * K.wave(t, 2, ph - 0.15))]
    fk['head'] = [('x', -8), ('z', -6 * s)]
    skirt(fk, t, flare=12, ripple=6, n=2, sway=10 * K.wave(t, 1, -0.12), swing=14 + 4 * K.wave(t, 2))
    hair(fk, -8 * K.wave(t, 1, -0.15), -20)
    lids(fk, OPEN)
    return pose(fk, root=(0.03 * s, 0, ground(fk) + 0.07 * K.hop(t, 2)))


def warn(t):
    # surprise : petit sursaut en arrière, mains aux joues, grands yeux
    e = min(1.0, t / 0.45)
    jump = math.sin(math.pi * min(1.0, t / 0.7))
    fk = {'root': [('x', -8 * e)], 'spine': [('x', -4 * e)], 'head': [('x', -6 * e)],
          'armL': [('x', -55 * e), ('y', -20 * e)], 'forearmL': [('y', 30 * e), ('x', -110 * e)], 'handL': [('x', -15 * e)],
          'armR': [('x', -55 * e), ('y', 20 * e)], 'forearmR': [('y', -30 * e), ('x', -110 * e)], 'handR': [('x', -15 * e)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -15 * jump + 8 * e)]
        fk['shin' + s] = [('x', 30 * jump)]
        fk['foot' + s] = [('x', -10 * jump)]
    skirt(fk, t, flare=4 + 10 * jump, ripple=2, n=1, swing=6 * jump)
    hair(fk, 0, -10 * jump)
    lids(fk, OPEN * (1 - e) - 15 * e)
    return pose(fk, root=(0, 0.02 * e, ground(fk) + 0.07 * jump))


def aloha(t):
    # geste amical : la main droite salue au-dessus de l'épaule, les hanches ondulent, un clin d'œil
    s = K.wave(t, 1)
    fk = {}
    hips(fk, 0.03 * s, 6 * s, 4 * K.wave(t, 1, 0.25))
    fk['armR'] = [('y', 140), ('x', -15)]
    fk['forearmR'] = [('y', 30 + 22 * K.wave(t, 2)), ('x', -10)]
    fk['handR'] = [('y', 20 * K.wave(t, 2, -0.1))]
    fk['armL'] = [('y', -20), ('x', -10)]
    fk['forearmL'] = [('x', -85), ('y', 50)]
    fk['handL'] = [('y', -20)]
    fk['head'] = [('y', -8), ('z', 6), ('x', 4 * K.hop(t, 2))]
    skirt(fk, t, flare=4, ripple=4, n=1, sway=6 * K.wave(t, 1, -0.12))
    hair(fk, -5 * K.wave(t, 1, -0.15))
    wink = max(0.0, 1 - abs(t - 0.5) / 0.2)
    lids(fk, OPEN + (170 - OPEN) * min(1.0, wink * 1.6), OPEN)
    return pose(fk, root=(0.03 * s, 0, ground(fk)))


def dance(t):
    # hula endiablé : hanches qui vibrent (quatre balancés), bras au-dessus de la tête, jupe et cheveux qui volent
    s = K.wave(t, 4)
    b = K.hop(t, 2)
    fk = {}
    hips(fk, 0.05 * s, 11 * s, 9 * K.wave(t, 4, 0.25), bend=1.3)
    fk['armL'] = [('y', -135 + 12 * K.wave(t, 2)), ('x', -10)]
    fk['armR'] = [('y', 135 + 12 * K.wave(t, 2)), ('x', -10)]
    for sd, sg, ph in (('L', -1, 0.0), ('R', 1, 0.5)):
        fk['forearm' + sd] = [('y', sg * (12 + 14 * K.wave(t, 2, ph)))]
        fk['hand' + sd] = [('y', sg * 35 * K.wave(t, 2, ph - 0.15))]
    fk['head'] = [('y', 10 * K.wave(t, 1)), ('z', -12 * K.wave(t, 2)), ('x', -6)]
    skirt(fk, t, flare=16 + 6 * b, ripple=10, n=4, sway=14 * K.wave(t, 4, -0.12), swing=5 * K.wave(t, 2))
    hair(fk, -18 * K.wave(t, 1, -0.1), -10 * b)
    lids(fk, OPEN + 20 * b)
    return pose(fk, root=(0.05 * s, 0, ground(fk) + 0.04 * b))


K.bake([('Idle', 60, idle), ('Walk', 30, walk), ('Run', 20, run), ('Warn', 16, warn), ('Hit', 30, aloha), ('Dance', 32, dance)])
K.log('triangles', tris(), 'dont corps', sum(len(f.vertices) - 2 for f in BODY.data.polygons))

if os.environ.get("DBG"):
    exec(open(os.environ["DBG_SCRIPT"]).read())
    sys.exit(0)
K.preview([
    ('face', 'Idle', 0, (0.3, -3.6, 1.1), (0, 0, 0.75)),
    ('troisquarts', 'Idle', 15, (2.4, -2.6, 1.7), (0, 0, 0.75)),
    ('visage', 'Idle', 0, (0.2, -1.4, 1.25), (0, 0, 1.1)),
    ('portrait', 'Hit', 0, (-0.25, -1.0, 1.25), (0, 0, 1.15)),
    ('dos', 'Idle', 30, (-1.2, 3.2, 1.5), (0, 0, 0.75)),
    ('dessus', 'Walk', 0, (1.7, -1.9, 3.4), (0, 0, 0.6)),
    ('marche', 'Walk', 8, (2.8, -2.0, 1.2), (0, 0, 0.75)),
    ('course', 'Run', 5, (3.0, -1.2, 1.1), (0, 0, 0.75)),
    ('alerte', 'Warn', 16, (1.2, -3.2, 1.2), (0, 0, 0.8)),
    ('aloha', 'Hit', 15, (1.2, -3.2, 1.2), (0, 0, 0.8)),
    ('danse', 'Dance', 4, (0.8, -3.4, 1.2), (0, 0, 0.8)),
    ('danse2', 'Dance', 12, (0.8, -3.4, 1.2), (0, 0, 0.8)),
])
K.export()
shutil.rmtree(WORK, ignore_errors=True)
