# ToeJam et Earl, modélisés dans Blender par script (sans interface).
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/perso.py -- toejam public/models/toejam.glb [<aperçus>]
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/perso.py -- earl public/models/earl.glb [<aperçus>]
#
# 1. Le corps (peau + short + jambes + bras) est un champ de distance signée : des volumes lisses fondus
#    les uns dans les autres, maillés par OpenVDB, puis allégés pour le jeu. Les couleurs sont peintes
#    sur les sommets (région de chaque sommet = la primitive la plus proche).
# 2. Les accessoires sont des pièces séparées, chacune dans sa matière : yeux (blanc brillant, pupilles),
#    casquette, baskets montantes, chaîne et médaillon (ToeJam), lunettes de soleil (Earl).
# 3. Squelette, poids de peau par régions, animations cuites en clés :
#    Idle, Walk, Sneak, Fall, Teeter, Splat, Getup, Fly, Jump, Dance.
#
# Le personnage regarde vers -Y (Blender), donc +Z dans le jeu. +X = sa gauche. Pieds à z = 0.

import bpy
import math
import os
import sys
import time
import numpy as np
import openvdb as vdb
from mathutils import Vector, Quaternion, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WHO = argv[0] if argv else 'toejam'
OUT = argv[1] if len(argv) > 1 else f'/tmp/{WHO}.glb'
PREVIEW = argv[2] if len(argv) > 2 else None
WORK = PREVIEW or f'/tmp/{WHO}_work'
os.makedirs(WORK, exist_ok=True)
VOX = float(os.environ.get('PERSO_VOX', 0.0045))
LOW_FACES = int(os.environ.get('PERSO_FACES', 16000))
T0 = time.time()


def log(*a):
    print(f'[{WHO} {time.time() - T0:6.1f}s]', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def activate(o):
    bpy.context.view_layer.update()
    for x in bpy.context.view_layer.objects:
        if x:
            x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def apply_mod(o, name):
    activate(o)
    bpy.ops.object.modifier_apply(modifier=name)


def remove(o):
    bpy.data.objects.remove(o)


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return np.array([(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c])


def V(*a):
    return np.array(a, dtype=np.float64)


def rot(rx=0, ry=0, rz=0):
    return np.array(Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix(), dtype=np.float64)


# =====================================================================================================
# Primitives de distance signée
# =====================================================================================================
def ell(tag, c, r, k=0.02, R=None, op='add'):
    return dict(tag=tag, kind='ell', c=V(*c), r=V(*r), R=R if R is not None else np.eye(3), k=k, op=op)


def cone(tag, a, b, r1, r2, k=0.02, op='add'):
    return dict(tag=tag, kind='cone', a=V(*a), b=V(*b), r1=r1, r2=r2, k=k, op=op)


def sd_prim(p, X, Y, Z):
    if p['kind'] == 'ell':
        dx, dy, dz = X - p['c'][0], Y - p['c'][1], Z - p['c'][2]
        R = p['R']
        qx = R[0, 0] * dx + R[1, 0] * dy + R[2, 0] * dz
        qy = R[0, 1] * dx + R[1, 1] * dy + R[2, 1] * dz
        qz = R[0, 2] * dx + R[1, 2] * dy + R[2, 2] * dz
        rx, ry, rz = p['r']
        k0 = np.sqrt((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2)
        k1 = np.sqrt((qx / rx ** 2) ** 2 + (qy / ry ** 2) ** 2 + (qz / rz ** 2) ** 2)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
    a, b, r1, r2 = p['a'], p['b'], p['r1'], p['r2']
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pax, pay, paz = X - a[0], Y - a[1], Z - a[2]
    y = pax * ba[0] + pay * ba[1] + paz * ba[2]
    z = y - l2
    x2 = (pax * l2 - ba[0] * y) ** 2 + (pay * l2 - ba[1] * y) ** 2 + (paz * l2 - ba[2] * y) ** 2
    y2 = y * y * l2
    z2 = z * z * l2
    kk = math.copysign(1, rr) * rr * rr * x2
    d_mid = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
    d_b = np.sqrt(x2 + z2) * il2 - r2
    d_a = np.sqrt(x2 + y2) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > kk, d_b, np.where(np.sign(y) * a2 * y2 < kk, d_a, d_mid))


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def field(prims, X, Y, Z, clip=None):
    d = np.full(np.broadcast(X, Y, Z).shape, 1.0)
    for p in prims:
        dp = sd_prim(p, X, Y, Z)
        d = smin(d, dp, p['k']) if p['op'] == 'add' else -smin(-d, dp, p['k'])
    if clip is not None:
        d = np.maximum(d, clip(X, Y, Z))
    return d


def sdf_mesh(name, prims, lo, hi, vox=VOX, clip=None, smooth=2):
    """maille un ensemble de primitives par OpenVDB"""
    lo, hi = V(*lo), V(*hi)
    n = np.ceil((hi - lo) / vox).astype(int) + 1
    X = lo[0] + np.arange(n[0])[:, None, None] * vox
    Y = lo[1] + np.arange(n[1])[None, :, None] * vox
    Z = lo[2] + np.arange(n[2])[None, None, :] * vox
    d = field(prims, X, Y, Z, clip)
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
    scene.collection.objects.link(ob)
    md = ob.modifiers.new('V', 'VOLUME_TO_MESH')
    md.object = vo
    md.grid_name = 'density'
    md.threshold = 0.00001
    md.resolution_mode = 'GRID'
    apply_mod(ob, 'V')
    remove(vo)
    if smooth:
        sm = ob.modifiers.new('S', 'SMOOTH')
        sm.factor = 0.5
        sm.iterations = smooth
        apply_mod(ob, 'S')
    activate(ob)
    bpy.ops.object.shade_smooth()
    return ob


def decimate(ob, faces):
    tris = sum(len(f.vertices) - 2 for f in ob.data.polygons)
    if tris > faces:
        dec = ob.modifiers.new('Dec', 'DECIMATE')
        dec.ratio = faces / tris
        dec.use_symmetry = True
        dec.symmetry_axis = 'X'
        apply_mod(ob, 'Dec')
    activate(ob)
    bpy.ops.object.shade_smooth()


def paint(ob, prims, colors, extra=None):
    """couleur par sommet : celle de la primitive (ajoutée) la plus proche ; extra(co, nor, col) affine"""
    me = ob.data
    nv = len(me.vertices)
    co = np.empty(nv * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    nor = np.empty(nv * 3)
    me.vertex_normals.foreach_get('vector', nor)
    nor = nor.reshape(-1, 3)
    adds = [p for p in prims if p['op'] == 'add']
    best = np.full(nv, 1e9)
    tag = np.empty(nv, dtype=object)
    for p in adds:
        d = sd_prim(p, co[:, 0], co[:, 1], co[:, 2])
        m = d < best
        best[m] = d[m]
        tag[m] = p['tag']
    col = np.array([colors.get(t, colors['default']) for t in tag])
    if extra:
        extra(co, nor, col, tag)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([np.clip(col, 0, 1), np.ones((nv, 1))], axis=1)
    ca.data.foreach_set('color', rgba.ravel())
    me.color_attributes.active_color = ca
    return co, tag


def vc_material(name, rough=0.55, spec=0.35):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    bs = N['Principled BSDF']
    at = N.new('ShaderNodeVertexColor')
    at.layer_name = 'Col'
    L.new(at.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Specular IOR Level'].default_value = spec
    return m


def flat_material(name, color, rough=0.5, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = tuple(srgb(color)) + (1,)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emit:
        bs.inputs['Emission Color'].default_value = tuple(srgb(emit)) + (1,)
        bs.inputs['Emission Strength'].default_value = 0.4
    return m


def sphere(name, c, r, mat, scale=(1, 1, 1), seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2, location=c)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


SIDES = (1, -1)

# =====================================================================================================
# Les deux personnages
# =====================================================================================================
if WHO == 'toejam':
    SKIN, SKIN_D, LIP = srgb('#e8334a'), srgb('#c42640'), srgb('#7a1020')
    HIP_Z, LEG_TOP = 0.44, 0.40
    LEGS = {'leg1': V(0.15, -0.05, 0), 'leg2': V(-0.15, -0.05, 0), 'leg3': V(0, 0.12, 0)}
    SHOULDER, ELBOW, HAND = V(0.25, 0.0, 0.86), V(0.33, -0.02, 0.68), V(0.345, -0.05, 0.52)
    HEAD_C = V(0, 0, 1.12)
    body = [
        ell('torso', (0, 0, 0.70), (0.215, 0.19, 0.24), k=0.06),
        ell('torso', (0, -0.04, 0.62), (0.19, 0.16, 0.14), k=0.06),
        ell('shorts', (0, 0, 0.48), (0.255, 0.225, 0.15), k=0.05),
        cone('neck', (0, 0, 0.86), (0, -0.01, 0.95), 0.12, 0.13, k=0.05),
        ell('head', (0, 0, 1.12), (0.35, 0.31, 0.30), k=0.07),
        ell('head', (0, -0.06, 1.04), (0.30, 0.26, 0.20), k=0.07),   # mâchoire, le gros sourire
        ell('cheek', (0.18, -0.20, 1.03), (0.11, 0.08, 0.09), k=0.05),
        ell('cheek', (-0.18, -0.20, 1.03), (0.11, 0.08, 0.09), k=0.05),
    ]
    EYES = [(0.125, -0.235, 1.21, 0.115), (-0.125, -0.235, 1.21, 0.115)]
    COLORS = {'default': SKIN, 'torso': SKIN, 'head': SKIN, 'neck': SKIN, 'cheek': SKIN * 1.04, 'brow': SKIN_D,
              'shorts': srgb('#2f6fe4'), 'leg': SKIN, 'arm': SKIN, 'hand': SKIN_D, 'mouth': LIP}
    # bouche : centre, puis (largeur, lèvre haute, lèvre basse, courbure) pour chaque expression
    MOUTH = dict(z=1.01, base=(0.2, 0.018, 0.04, 0.04), joie=(0.24, 0.035, 0.11, 0.065), ouvert=(0.1, 0.075, 0.1, 0.0),
                 aie=(0.19, 0.025, 0.028, -0.06), lip='#8a1428')
    BROW = dict(xi=0.035, xo=0.21, z=1.30, arch=0.03, rad=0.022, color='#9a1830')
    HAND_K = 1.0
    CAP = dict(c=V(0, 0.02, 1.27), r=V(0.31, 0.30, 0.20), cut=1.27, brim=(0, 0.36, 1.30), color='#2f6fe4', band='#1f4fb0', fwd=False)
    SHOE = dict(color='#f4f4f4', stripe='#ff4a5c', sole='#3a3550', size=(0.10, 0.155, 0.08))
else:  # Earl
    SKIN, SKIN_D, LIP = srgb('#ff9a2e'), srgb('#e07a18'), srgb('#8a2a10')
    HIP_Z, LEG_TOP = 0.36, 0.34
    LEGS = {'leg1': V(0.19, 0, 0), 'leg2': V(-0.19, 0, 0)}
    SHOULDER, ELBOW, HAND = V(0.48, -0.02, 1.02), V(0.62, -0.05, 0.84), V(0.66, -0.08, 0.68)
    HEAD_C = V(0, 0, 1.36)
    body = [
        ell('torso', (0, 0, 0.92), (0.52, 0.46, 0.50), k=0.1),
        ell('belly', (0, -0.12, 0.84), (0.42, 0.36, 0.36), k=0.1),
        ell('shorts', (0, 0, 0.50), (0.47, 0.42, 0.19), k=0.08),
        ell('head', (0, -0.02, 1.36), (0.31, 0.28, 0.25), k=0.12),
        ell('cheek', (0.17, -0.24, 1.26), (0.12, 0.08, 0.09), k=0.06),
        ell('cheek', (-0.17, -0.24, 1.26), (0.12, 0.08, 0.09), k=0.06),
        ell('nose', (0, -0.30, 1.30), (0.05, 0.04, 0.045), k=0.04),
        ell('navel', (0, -0.48, 0.82), (0.025, 0.02, 0.03), k=0.012, op='sub'),
    ]
    EYES = []
    COLORS = {'default': SKIN, 'torso': SKIN, 'head': SKIN, 'cheek': SKIN * 1.03, 'nose': SKIN_D, 'belly': srgb('#ffb25a'),
              'shorts': srgb('#26c3b5'), 'leg': SKIN, 'arm': SKIN, 'hand': SKIN_D, 'mouth': LIP}
    MOUTH = dict(z=1.17, base=(0.14, 0.014, 0.03, 0.03), joie=(0.17, 0.028, 0.08, 0.05), ouvert=(0.08, 0.055, 0.075, 0.0),
                 aie=(0.13, 0.018, 0.02, -0.045), lip='#9a3410')
    BROW = dict(xi=0.04, xo=0.2, z=1.53, arch=0.02, rad=0.016, color='#8a4010')
    HAND_K = 1.3
    CAP = dict(c=V(0, 0.04, 1.55), r=V(0.22, 0.22, 0.13), cut=1.55, brim=(0, 0.26, 1.56), color='#e8334a', band='#a81c33', fwd=False)
    SHOE = dict(color='#e8334a', stripe='#ffffff', sole='#ffffff', size=(0.12, 0.17, 0.085))

# jambes (de la hanche à la cheville) et bras (épaule, coude, main)
ANKLE_Z = 0.10
for name, base in LEGS.items():
    top = base + V(0, 0, LEG_TOP)
    body.append(cone('leg', tuple(top), tuple(base + V(0, 0, ANKLE_Z)), 0.075 if WHO == 'toejam' else 0.11, 0.06 if WHO == 'toejam' else 0.09, k=0.03))
for sx in SIDES:
    s = V(sx, 1, 1)
    body.append(cone('arm', tuple(SHOULDER * s), tuple(ELBOW * s), 0.065 if WHO == 'toejam' else 0.085, 0.055 if WHO == 'toejam' else 0.075, k=0.03))
    body.append(cone('arm', tuple(ELBOW * s), tuple(HAND * s), 0.055 if WHO == 'toejam' else 0.075, 0.05 if WHO == 'toejam' else 0.07, k=0.02))

top_z = (HEAD_C[2] + 0.42) if WHO == 'toejam' else 1.72
half_w = 0.48 if WHO == 'toejam' else 0.82
log('maillage du corps')
BODY = sdf_mesh('Body', body, (-half_w, -0.6, ANKLE_Z - 0.04), (half_w, 0.6, top_z))


def body_extra(co, nor, col, tag):
    # short : ourlet plus foncé ; Earl : rayures du short ; légère occlusion sous le menton et les aisselles
    sh = tag == 'shorts'
    if WHO == 'earl':
        ang = np.arctan2(co[:, 0], -co[:, 1])
        band = (np.floor(ang / 0.22) % 2 == 0) & sh
        col[band] = srgb('#f2f2e8')
        col[sh & (co[:, 2] < 0.36)] = srgb('#159488')
    else:
        hem = sh & (co[:, 2] < 0.38)
        col[hem] = srgb('#1f4fb0')
        col[sh & (co[:, 2] < 0.345)] = SKIN
    ao = np.clip((co[:, 2] - HIP_Z) / 0.3, 0, 1)
    col *= (0.82 + 0.18 * ao)[:, None] * (0.92 + 0.08 * np.clip(nor[:, 2] + 0.5, 0, 1))[:, None]


decimate(BODY, LOW_FACES)
BODY_CO, BODY_TAG = paint(BODY, body, COLORS, body_extra)
BODY.data.materials.append(vc_material('Peau'))
log('corps', len(BODY.data.polygons), 'faces')

# --- visage : bouche et sourcils, posés sur la peau, avec leurs expressions en clés de forme ------------
FACE = [p for p in body if p['op'] == 'add'] + [ell('eye', (ex, ey, ez), (er, er * 0.8, er * 1.18), k=0.01) for ex, ey, ez, er in EYES]


def on_face(x, z, off):
    """projette des points (x, z) sur le visage (rayon droit vers l'arrière, premier contact), décollés de `off` selon la normale"""
    x, z = np.asarray(x, float), np.asarray(z, float)
    A = np.stack([x, np.full(x.shape, -0.9), z], 1)
    D = np.stack([np.zeros(x.shape), np.full(x.shape, 0.9), np.zeros(x.shape)], 1)
    # premier point à l'intérieur en avançant pas à pas (l'œil passe avant la peau qui est derrière), puis dichotomie
    STEPS = 300
    hi = np.ones(len(x))
    for k_ in range(STEPS, 0, -1):
        P = A + D * (k_ / STEPS)
        hi = np.where(field(FACE, P[:, 0], P[:, 1], P[:, 2]) < 0, k_ / STEPS, hi)
    lo = hi - 1 / STEPS
    for _ in range(20):
        mid = (lo + hi) / 2
        P = A + D * mid[:, None]
        inside = field(FACE, P[:, 0], P[:, 1], P[:, 2]) < 0
        hi = np.where(inside, mid, hi)
        lo = np.where(inside, lo, mid)
    P = A + D * hi[:, None]
    e = 0.002
    f = lambda q: field(FACE, q[:, 0], q[:, 1], q[:, 2])
    g = np.stack([f(P + [e, 0, 0]) - f(P - [e, 0, 0]), f(P + [0, e, 0]) - f(P - [0, e, 0]), f(P + [0, 0, e]) - f(P - [0, 0, e])], 1)
    n = g / np.linalg.norm(g, axis=1, keepdims=True)
    return P + n * np.asarray(off, float).reshape(-1, 1), n


def mesh_from(name, verts, faces, cols, mat, outward=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if outward is not None:  # les faces doivent regarder dehors
        fn = np.empty(len(me.polygons) * 3)
        me.polygons.foreach_get('normal', fn)
        if (fn.reshape(-1, 3) @ outward).mean() < 0:
            me.flip_normals()
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set('color', np.concatenate([np.clip(cols, 0, 1), np.ones((len(cols), 1))], 1).ravel())
    me.color_attributes.active_color = ca
    me.materials.append(mat)
    activate(ob)
    bpy.ops.object.shade_smooth()
    return ob


def add_keys(ob, shapes):
    ob.shape_key_add(name='Basis')
    for k, co in shapes.items():
        sk = ob.shape_key_add(name=k)
        sk.data.foreach_set('co', np.asarray(co, float).ravel())


# la bouche : une rosace (anneaux × rayons) ; les couleurs suivent les coordonnées réduites, donc la forme
RINGS, SEGS = 8, 40
rr = np.concatenate([[0.0], np.repeat(np.arange(1, RINGS + 1) / RINGS, SEGS)])
th = np.concatenate([[0.0], np.tile(np.arange(SEGS) / SEGS * math.tau, RINGS)])


def mouth_pts(w, hu, hl, bend):
    c, sn = np.cos(th), np.sin(th)
    x = rr * w * c
    z = MOUTH['z'] + rr * np.where(sn > 0, hu, hl) * sn + bend * (rr * c) ** 2 - bend * 0.3
    off = 0.003 + 0.011 * np.exp(-((rr - 0.9) / 0.12) ** 2)
    return on_face(x, z, off)[0]


mf = [(0, 1 + (j + 1) % SEGS, 1 + j) for j in range(SEGS)]
for i in range(RINGS - 1):
    a, b = 1 + i * SEGS, 1 + (i + 1) * SEGS
    mf += [(a + j, a + (j + 1) % SEGS, b + (j + 1) % SEGS, b + j) for j in range(SEGS)]
sn = np.sin(th)
mcol = np.tile(srgb('#2a0810'), (len(rr), 1))
mcol[(sn > 0.2) & (rr > 0.38)] = srgb('#f4efe4')                 # dents du haut
mcol[(sn < -0.3) & (rr < 0.62)] = srgb('#e0506a')                # langue
mcol[rr > 0.76] = srgb(MOUTH['lip'])                             # lèvres
MOUTHO = mesh_from('Bouche', mouth_pts(*MOUTH['base']), mf, mcol, vc_material('Bouche', rough=0.35), outward=np.array([0, -1, 0]))
add_keys(MOUTHO, {k: mouth_pts(*MOUTH[k]) for k in ('joie', 'ouvert', 'aie')})

# les sourcils : un boudin le long d'une courbe ; chaque expression déplace la courbe
BN, BM = 14, 8
bt = np.linspace(0, 1, BN)
BROW_KEYS = {'haut': lambda t: 0.028 + 0.012 * 4 * t * (1 - t), 'colere': lambda t: -0.035 * (1 - t) + 0.012 * t,
             'triste': lambda t: 0.03 * (1 - t) - 0.014 * t}


def brow_pts(sx, dz):
    B = BROW
    x = sx * (B['xi'] + bt * (B['xo'] - B['xi']))
    z = B['z'] + B['arch'] * 4 * bt * (1 - bt) + dz(bt)
    r = B['rad'] * (0.3 + 0.7 * np.sin(np.pi * bt) ** 0.5)
    P, n = on_face(x, z, r * 0.8)
    tg = np.gradient(P, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True)
    b = np.cross(tg, n)
    b /= np.linalg.norm(b, axis=1, keepdims=True)
    a = np.arange(BM) / BM * math.tau
    ring = P[:, None, :] + r[:, None, None] * (np.cos(a)[None, :, None] * n[:, None, :] * 0.7 + np.sin(a)[None, :, None] * b[:, None, :])
    return np.concatenate([ring.reshape(-1, 3), [P[0] - tg[0] * r[0] * 0.6, P[-1] + tg[-1] * r[-1] * 0.6]])


bf = []
for i in range(BN - 1):
    bf += [(i * BM + j, i * BM + (j + 1) % BM, (i + 1) * BM + (j + 1) % BM, (i + 1) * BM + j) for j in range(BM)]
bf += [(BN * BM, (j + 1) % BM, j) for j in range(BM)]
bf += [(BN * BM + 1, (BN - 1) * BM + j, (BN - 1) * BM + (j + 1) % BM) for j in range(BM)]
BROWS = []
for sx in SIDES:
    pts = brow_pts(sx, lambda t: 0 * t)
    o = mesh_from('Sourcil' + ('G' if sx > 0 else 'D'), pts, bf, np.tile(srgb(BROW['color']), (len(pts), 1)), vc_material('Sourcil', rough=0.8))
    activate(o)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    add_keys(o, {k: brow_pts(sx, f) for k, f in BROW_KEYS.items()})
    BROWS.append(o)
log('visage : bouche', len(MOUTHO.data.vertices), 'sommets, sourcils', len(BROWS[0].data.vertices))

# --- mains à quatre doigts (trois doigts et un pouce), chacun sur son os ---------------------------------
HANDS = {}
for sx, s in ((1, 'L'), (-1, 'R')):
    k = HAND_K
    m = V(sx, 1, 1)
    Wp = HAND * m
    d = Wp - ELBOW * m
    d /= np.linalg.norm(d)
    fw = V(0, -1, 0) - V(0, -1, 0) @ d * d
    fw /= np.linalg.norm(fw)
    inw = np.cross(d, fw)
    if inw[0] * sx > 0:
        inw = -inw
    Rm = np.column_stack([inw, fw, d])
    prims = [ell('palm', tuple(Wp + 0.05 * k * d), (0.03 * k, 0.05 * k, 0.052 * k), k=0.02 * k, R=Rm),
             cone('palm', tuple(Wp - 0.03 * d), tuple(Wp + 0.03 * k * d), 0.047 * k, 0.04 * k, k=0.02 * k)]
    bones_ = {}
    for i, (off, ln) in enumerate(((0.033, 0.062), (0.0, 0.07), (-0.033, 0.06))):
        base = Wp + 0.088 * k * d + off * k * fw
        tip = base + ln * k * d + off * 0.3 * k * fw
        prims.append(cone(f'f{i + 1}', tuple(base), tuple(tip), 0.019 * k, 0.016 * k, k=0.012 * k))
        bones_[f'f{i + 1}'] = (base - 0.02 * k * d, tip)
    tb = Wp + 0.045 * k * d + 0.042 * k * fw + 0.012 * k * inw
    tdir = 0.75 * fw + 0.45 * d + 0.25 * inw
    tdir /= np.linalg.norm(tdir)
    prims.append(cone('thumb', tuple(tb), tuple(tb + 0.052 * k * tdir), 0.02 * k, 0.017 * k, k=0.012 * k))
    bones_['thumb'] = (tb - 0.015 * k * tdir, tb + 0.052 * k * tdir)
    lo_, hi_ = Wp - 0.22 * k, Wp + 0.22 * k
    o = sdf_mesh('Main' + s, prims, tuple(lo_), tuple(hi_), vox=VOX * 0.45, smooth=1)
    decimate(o, 2600)
    hco, htag = paint(o, prims, {'default': SKIN, 'palm': SKIN, 'f1': SKIN, 'f2': SKIN, 'f3': SKIN, 'thumb': SKIN})
    o.data.materials.append(vc_material('Main'))
    HANDS[s] = dict(ob=o, co=hco, tag=htag, wrist=Wp, end=Wp + 0.085 * k * d, bones=bones_,
                    curl=Vector(tuple(np.cross(d, inw))), spread=Vector(tuple(np.cross(d, fw))), tcurl=Vector(tuple(np.cross(tdir, inw))))
log('mains', len(HANDS['L']['ob'].data.polygons), 'faces chacune')

# --- casquette retournée ---------------------------------------------------------------------------------
cap_prims = [
    ell('cap', tuple(CAP['c']), tuple(CAP['r']), k=0.02),
    ell('brim', CAP['brim'], (0.2 if WHO == 'toejam' else 0.15, 0.2 if WHO == 'toejam' else 0.14, 0.022), k=0.015, R=rot(-10)),
    ell('button', (CAP['c'][0], CAP['c'][1], CAP['c'][2] + CAP['r'][2] - 0.01), (0.03, 0.03, 0.022), k=0.01),
]
cut = CAP['cut']
CAPO = sdf_mesh('Casquette', cap_prims, (-0.4, -0.4, cut - 0.06), (0.4, 0.52, cut + 0.3), vox=VOX * 0.7,
                clip=lambda X, Y, Z: np.where(Y > 0.16, -1.0, cut - 0.015 - Z) + 0 * X)
decimate(CAPO, 2500)


def cap_extra(co, nor, col, tag):
    col[co[:, 2] < cut + 0.03] = srgb(CAP['band'])


paint(CAPO, cap_prims, {'default': srgb(CAP['color']), 'cap': srgb(CAP['color']), 'brim': srgb(CAP['band']), 'button': srgb(CAP['band'])}, cap_extra)
CAPO.data.materials.append(vc_material('Casquette', rough=0.7))

# --- baskets montantes -------------------------------------------------------------------------------------
SHOES = {}
sx_, sy_, sz_ = SHOE['size']
for name, base in LEGS.items():
    p = [
        ell('shoe', (base[0], base[1] - sy_ * 0.25, sz_ * 0.8), (sx_, sy_, sz_), k=0.03),
        ell('shoe', (base[0], base[1] - sy_ * 0.85, sz_ * 0.55), (sx_ * 0.85, sy_ * 0.45, sz_ * 0.6), k=0.03),   # bout arrondi
        cone('collar', (base[0], base[1] + 0.005, sz_ * 1.2), (base[0], base[1] + 0.005, sz_ * 2.1), sx_ * 0.82, sx_ * 0.75, k=0.02),
        ell('sole', (base[0], base[1] - sy_ * 0.35, 0.016), (sx_ * 1.06, sy_ * 1.22, 0.02), k=0.012),
    ]
    o = sdf_mesh('Basket_' + name, p, (base[0] - 0.2, base[1] - 0.35, -0.01), (base[0] + 0.2, base[1] + 0.2, 0.26), vox=VOX * 0.6,
                 clip=lambda X, Y, Z: -Z + 0 * X * Y)
    decimate(o, 1800)

    def shoe_extra(co, nor, col, tag, base=base):
        stripe = (np.abs(co[:, 2] - sz_ * 1.05) < 0.018) & (tag != 'sole')
        col[stripe] = srgb(SHOE['stripe'])
        laces = (np.abs(co[:, 0] - base[0]) < 0.022) & (nor[:, 2] > 0.5) & (co[:, 1] < base[1] - 0.02) & (tag == 'shoe')
        col[laces & (np.floor(co[:, 1] / 0.045) % 2 == 0)] = srgb('#d9d9e6')

    paint(o, p, {'default': srgb(SHOE['color']), 'shoe': srgb(SHOE['color']), 'collar': srgb(SHOE['color']), 'sole': srgb(SHOE['sole'])}, shoe_extra)
    o.data.materials.append(vc_material('Basket', rough=0.5))
    SHOES[name] = o

# --- yeux, chaîne, lunettes ---------------------------------------------------------------------------------
EXTRAS = []  # (objet, os)
white = flat_material('Blanc', '#ffffff', rough=0.12)
black = flat_material('Pupille', '#16101f', rough=0.08)
for i, (ex, ey, ez, er) in enumerate(EYES):
    s = 'G' if ex > 0 else 'D'
    e = sphere('Oeil' + s, (ex, ey, ez), er, white, scale=(1, 0.8, 1.18))
    pu = sphere('Pupille' + s, (ex - math.copysign(0.012, ex), ey - er * 0.78, ez - 0.005), er * 0.42, black, scale=(1, 0.45, 1.25))
    sphere('Reflet' + s, (ex - math.copysign(0.03, ex), ey - er * 0.86, ez + 0.035), er * 0.12, flat_material('Reflet', '#ffffff', rough=0.0, emit='#ffffff'))
    EXTRAS += [(e, 'head'), (pu, 'head'), (bpy.data.objects['Reflet' + s], 'head')]
if WHO == 'toejam':
    gold = flat_material('Or', '#ffcf3a', rough=0.25, metal=0.4, emit='#6a4a00')
    bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.02, major_segments=48, minor_segments=10, location=(0, -0.05, 0.86))
    ch = bpy.context.active_object
    ch.name = 'Chaine'
    ch.rotation_euler = (math.radians(-35), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    ch.data.materials.append(gold)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.025, vertices=32, location=(0, -0.215, 0.73))
    md = bpy.context.active_object
    md.name = 'Medaillon'
    md.rotation_euler = (math.radians(80), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    md.data.materials.append(gold)
    EXTRAS += [(ch, 'spine'), (md, 'spine')]
else:
    glass = flat_material('Lunettes', '#0e0a16', rough=0.05, metal=0.2)
    for sx in SIDES:
        lens = sphere('Verre' + ('G' if sx > 0 else 'D'), (sx * 0.12, -0.255, 1.43), 0.1, glass, scale=(1.15, 0.35, 0.72))
        EXTRAS.append((lens, 'head'))
        gl = sphere('Eclat' + ('G' if sx > 0 else 'D'), (sx * 0.09, -0.29, 1.47), 0.022, flat_material('Eclat', '#ffffff', rough=0.0, emit='#ffffff'), scale=(1.6, 0.4, 0.6))
        EXTRAS.append((gl, 'head'))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.06, location=(0, -0.285, 1.45))
    br = bpy.context.active_object
    br.name = 'Pont'
    br.rotation_euler = (0, math.radians(90), 0)
    br.data.materials.append(glass)
    EXTRAS.append((br, 'head'))

# =====================================================================================================
# Squelette
# =====================================================================================================
arm_data = bpy.data.armatures.new('Rig')
arm = bpy.data.objects.new('Rig', arm_data)
scene.collection.objects.link(arm)
activate(arm)
bpy.ops.object.mode_set(mode='EDIT')
EB = arm_data.edit_bones


def bone(name, a, b, parent=None, connect=False):
    bn = EB.new(name)
    bn.head = Vector(tuple(a))
    bn.tail = Vector(tuple(b))
    bn.roll = 0
    if parent:
        bn.parent = EB[parent]
        bn.use_connect = connect
    return bn


NECK_Z = 0.90 if WHO == 'toejam' else 1.18
bone('hips', (0, 0, HIP_Z), (0, 0, HIP_Z + 0.16))
bone('spine', (0, 0, HIP_Z + 0.16), (0, 0, NECK_Z), 'hips', True)
bone('head', (0, 0, NECK_Z), tuple(HEAD_C + V(0, 0, 0.3)), 'spine', True)
for sx, s in ((1, 'L'), (-1, 'R')):
    m = V(sx, 1, 1)
    bone('arm' + s, SHOULDER * m, ELBOW * m, 'spine')
    bone('forearm' + s, ELBOW * m, HAND * m, 'arm' + s, True)
    H = HANDS[s]
    bone('hand' + s, H['wrist'], H['end'], 'forearm' + s, True)
    for f, (a, b) in H['bones'].items():
        bone(f + s, a, b, 'hand' + s)
for name, base in LEGS.items():
    bone(name, base + V(0, 0, LEG_TOP), base + V(0, 0, ANKLE_Z), 'hips')
    bone('foot' + name[-1], base + V(0, 0, ANKLE_Z), base + V(0, -0.15, 0.02), name, True)
bpy.ops.object.mode_set(mode='OBJECT')

# poids de peau : chaque région n'écoute que ses os, au prorata inverse de la distance, puis lissage
BSEG = {b.name: (np.array(b.head_local), np.array(b.tail_local)) for b in arm_data.bones}
BNAMES = list(BSEG)


def seg_dist(pts, a, b):
    ab = b - a
    t = np.clip(((pts - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(pts - (a + t[:, None] * ab), axis=1)


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'cheek', 'brow', 'mouth', 'nose'):
        return ['head'] if WHO == 'toejam' else ['head', 'spine']
    if tg == 'neck':
        return ['spine', 'head']
    if tg in ('torso', 'belly', 'navel'):
        return ['hips', 'spine'] + (['head'] if WHO == 'earl' else [])
    if tg in ('arm', 'hand'):
        return ['spine', 'arm' + s, 'forearm' + s]
    if tg == 'shorts':
        return ['hips'] + list(LEGS)
    if tg == 'leg':
        near = min(LEGS, key=lambda n: np.hypot(p[0] - LEGS[n][0], p[1] - LEGS[n][1]))
        return ['hips', near, 'foot' + near[-1]]
    return ['hips', 'spine']


def assign(ob, W):
    groups = {n: ob.vertex_groups.new(name=n) for n in BNAMES}
    for j, n in enumerate(BNAMES):
        for i in np.nonzero(W[:, j])[0]:
            groups[n].add([int(i)], float(W[i, j]), 'REPLACE')
    ob.parent = arm
    ob.modifiers.new('Armature', 'ARMATURE').object = arm


def skin(ob, co, tags, allowed_fn, smooth=5):
    nl = len(co)
    DIST = np.stack([seg_dist(co, *BSEG[n]) for n in BNAMES], axis=1)
    W = np.zeros((nl, len(BNAMES)))
    for i in range(nl):
        tg = tags[i]
        for n in allowed_fn(tg, co[i]):
            j = BNAMES.index(n)
            f = 0.15 if tg == 'shorts' and n in LEGS else 1.0
            W[i, j] = f / (DIST[i, j] ** 4 + 1e-10)
    W /= W.sum(1, keepdims=True)
    ed = np.empty(len(ob.data.edges) * 2, dtype=np.int64)
    ob.data.edges.foreach_get('vertices', ed)
    ed = ed.reshape(-1, 2)
    deg = np.bincount(ed.ravel(), minlength=nl).astype(np.float64)[:, None]
    for _ in range(smooth):
        acc = np.zeros_like(W)
        np.add.at(acc, ed[:, 0], W[ed[:, 1]])
        np.add.at(acc, ed[:, 1], W[ed[:, 0]])
        W = 0.5 * W + 0.5 * acc / np.maximum(deg, 1)
    order = np.argsort(-W, axis=1)
    keep = np.zeros_like(W, dtype=bool)
    np.put_along_axis(keep, order[:, :4], True, axis=1)
    W = np.where(keep & (W > 0.02), W, 0)
    W /= W.sum(1, keepdims=True)
    assign(ob, W)
    return W


def hand_allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    return ['hand' + s, tg + s] if tg in ('f1', 'f2', 'f3', 'thumb') else ['forearm' + s, 'hand' + s]


W = skin(BODY, BODY_CO, BODY_TAG, allowed)
for H in HANDS.values():
    skin(H['ob'], H['co'], H['tag'], hand_allowed, smooth=2)
# la bouche et les sourcils suivent la peau qu'ils recouvrent : poids du sommet du corps le plus proche
from mathutils.kdtree import KDTree
kd = KDTree(len(BODY_CO))
for i, c in enumerate(BODY_CO):
    kd.insert(c, i)
kd.balance()
for o in [MOUTHO] + BROWS:
    vc = np.empty(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get('co', vc)
    near = [kd.find(c)[1] for c in vc.reshape(-1, 3)]
    assign(o, W[near])

# accessoires rigides, accrochés à leur os
for o, bname in EXTRAS + [(CAPO, 'head')] + [(SHOES[n], 'foot' + n[-1]) for n in SHOES]:
    mw = o.matrix_world.copy()
    o.parent = arm
    o.parent_type = 'BONE'
    o.parent_bone = bname
    o.matrix_world = mw
log('squelette', BNAMES)

# =====================================================================================================
# Animations (rotations autour des axes du monde, cuites en clés)
# =====================================================================================================
pb = arm.pose.bones
for b in pb:
    b.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.copy() for b in arm_data.bones}
AX = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}


def q_world(bname, rots):
    """rots : [(axe monde, degrés)] ; x+ : bascule vers l'avant (le bas de l'os part vers l'arrière)"""
    r = REST[bname].to_3x3()
    q = Quaternion()
    for a, deg in rots:
        ax = AX[a] if isinstance(a, str) else a
        q = Quaternion((r.inverted() @ ax).normalized(), math.radians(deg)) @ q
    return q


LEGN = list(LEGS)
PH = {n: i / len(LEGN) for i, n in enumerate(LEGN)}
TAU = math.tau


def pose(fk=None, hips=(0, 0, 0), scale=None, curl=0.35, spread=0.0, point=(0, 0)):
    return dict(fk=fk or {}, hips=hips, scale=scale, curl=curl, spread=spread, point=point)


def hands_fk(curl, spread, point=(0, 0)):
    """curl : 0 main ouverte, 1 poing fermé ; spread : doigts écartés ; point : l'index (doigt de devant) tendu"""
    fk = {}
    for s, H in HANDS.items():
        pt = point[0] if s == 'L' else point[1]
        for i, f in enumerate(('f1', 'f2', 'f3')):
            c = curl * (1 - pt) if i == 0 else curl + (1 - curl) * pt
            rots = [(H['curl'], (80 + 10 * i) * c)]
            if spread:
                rots.append((H['spread'], (1 - i) * 16 * spread))
            fk[f + s] = rots
        fk['thumb' + s] = [(H['tcurl'], 50 * (curl + (1 - curl) * pt * 0.8))]
    return fk


def idle(t):
    a = math.sin(t * TAU)
    return pose({'spine': [('x', 2 * a)], 'head': [('z', 4 * math.sin(t * TAU * 0.5))],
                 'armL': [('y', -12 - 3 * a)], 'armR': [('y', 12 + 3 * a)]}, hips=(0, 0, -0.008 * (1 - a)), curl=0.35 + 0.08 * a)


def walk(t):
    fk = {}
    for n in LEGN:
        ph = (t + PH[n]) * TAU
        fk[n] = [('x', 32 * math.sin(ph))]
        fk['foot' + n[-1]] = [('x', -18 * max(0, math.cos(ph)))]
    sw = math.sin(t * TAU)
    fk['armL'] = [('y', -14), ('x', -30 * sw)]
    fk['armR'] = [('y', 14), ('x', 30 * sw)]
    fk['forearmL'] = [('x', -20)]
    fk['forearmR'] = [('x', -20)]
    fk['spine'] = [('z', 6 * sw), ('x', 4)]
    fk['head'] = [('z', -4 * sw)]
    bob = abs(math.sin(t * TAU * len(LEGN) / 2 if len(LEGN) == 2 else t * TAU * 1.5)) * 0.035
    return pose(fk, hips=(0, 0, bob), curl=0.6)


def sneak(t):
    # sur la pointe des pieds, façon dessin animé : penché en avant, grands pas lents, pointes tendues,
    # les mains levées devant la poitrine, poignets cassés, et la tête qui guette à gauche puis à droite
    fk = {}
    for n in LEGN:
        ph = (t + PH[n]) * TAU
        fk[n] = [('x', 30 * math.sin(ph))]
        fk['foot' + n[-1]] = [('x', 38 + 14 * max(0, math.cos(ph)))]
    sw = math.sin(t * TAU)
    fk['spine'] = [('x', 20), ('z', 4 * sw)]
    fk['head'] = [('x', -16), ('z', 26 * sw)]
    fk['armL'] = [('y', -30), ('x', -55 + 6 * sw)]
    fk['armR'] = [('y', 30), ('x', -55 - 6 * sw)]
    fk['forearmL'] = [('x', -75)]
    fk['forearmR'] = [('x', -75)]
    fk['handL'] = [('x', 70)]
    fk['handR'] = [('x', 70)]
    bob = abs(math.sin(t * TAU * len(LEGN) / 2 if len(LEGN) == 2 else t * TAU * 1.5)) * 0.03
    return pose(fk, hips=(0, 0, 0.035 + bob), curl=0.45)


def fall(t):
    a = math.sin(t * TAU)
    fk = {'armL': [('y', -150 - 15 * a)], 'armR': [('y', 150 + 15 * a)], 'head': [('x', -10)]}
    for n in LEGN:
        fk[n] = [('x', 45 * math.sin((t * 2 + PH[n]) * TAU))]
    return pose(fk, curl=0.1 + 0.1 * a, spread=1)


def teeter(t):
    a = t * TAU
    return pose({'armL': [('y', -80), ('x', math.degrees(a) % 360)], 'armR': [('y', 80), ('x', (math.degrees(a) + 180) % 360)],
                 'spine': [('x', 14 * math.sin(a))], 'head': [('x', -10 * math.sin(a))]}, curl=0.05, spread=0.8)


def splat(t):
    return pose({'armL': [('y', -80)], 'armR': [('y', 80)]}, hips=(0, 0, -HIP_Z * 0.55), scale=(1.5, 1.5, 0.35), curl=0, spread=1)


def getup(t):
    k = t
    return pose({'spine': [('x', 30 * (1 - k))], 'head': [('x', 20 * (1 - k))]}, hips=(0, 0, -HIP_Z * 0.3 * (1 - k)),
                scale=(1 + 0.3 * (1 - k), 1 + 0.3 * (1 - k), 1 - 0.4 * (1 - k)), curl=0.2 + 0.2 * k)


def fly(t):
    a = math.sin(t * TAU)
    fk = {'armL': [('y', -75 - 10 * a)], 'armR': [('y', 75 + 10 * a)], 'spine': [('x', 18)]}
    for n in LEGN:
        fk[n] = [('x', -25 + 8 * math.sin((t + PH[n]) * TAU))]
    return pose(fk, curl=0.1, spread=0.6)


def jump(t):
    fk = {'armL': [('y', -120)], 'armR': [('y', 120)]}
    for n in LEGN:
        fk[n] = [('x', -20 + 25 * PH[n])]
        fk['foot' + n[-1]] = [('x', 25)]
    return pose(fk, curl=0, spread=0.9)


def dance(t):
    a, b = math.sin(t * TAU * 2), math.sin(t * TAU)
    fk = {'armL': [('y', -130 - 30 * a)], 'armR': [('y', 130 - 30 * a)], 'spine': [('z', 18 * b), ('y', 8 * a)], 'head': [('y', -10 * a)]}
    for n in LEGN:
        fk[n] = [('x', 15 * math.sin((t * 2 + PH[n]) * TAU))]
    return pose(fk, hips=(0.03 * b, 0, abs(a) * 0.05), curl=0.55 + 0.45 * a)


def highfive(t):
    # élan, bras droit levé en avant, claque main grande ouverte au sommet, puis on redescend
    up = min(1, t / 0.4) if t < 0.65 else max(0, 1 - (t - 0.65) / 0.35)
    up = up * up * (3 - 2 * up)
    fk = {'armR': [('y', 12 + 145 * up), ('x', -35 * up)], 'armL': [('y', -25 * up)], 'spine': [('y', 8 * up), ('x', -6 * up)],
          'head': [('x', -10 * up)]}
    hop = 0.07 * math.sin(math.pi * min(1, t / 0.7))
    return pose(fk, hips=(0, 0, hop), curl=0.4 * (1 - up), spread=up)


# --- les danses du désœuvrement : trois chorégraphies de 8 temps, jouées en rythme avec le groove ---------
# Une chorégraphie = des poses clés posées sur les temps ; on passe de l'une à l'autre en douceur,
# et par-dessus : le pas, le rebond, le hochement de tête, le shimmy.
DEF = {'armL.y': -12, 'armR.y': 12, 'curl': 0.35, 'step': 10}


def mirror(k):
    out = {}
    for ch, v in k.items():
        if '.' in ch:
            b, ax = ch.split('.')
            if b[-1] in 'LR':
                b = b[:-1] + ('R' if b[-1] == 'L' else 'L')
            out[f'{b}.{ax}'] = -v if ax in 'yz' else v
        elif ch in ('pointL', 'pointR'):
            out['pointR' if ch == 'pointL' else 'pointL'] = v
        else:
            out[ch] = -v if ch in ('hx', 'spin') else v
    return out


def keyed(keys, b):
    for (b0, k0), (b1, k1) in zip(keys, keys[1:]):
        if b0 <= b <= b1:
            e = (b - b0) / (b1 - b0)
            e = e * e * (3 - 2 * e)
            return {ch: k0.get(ch, DEF.get(ch, 0)) * (1 - e) + k1.get(ch, DEF.get(ch, 0)) * e for ch in set(k0) | set(k1) | set(DEF)}
    return dict(keys[-1][1])


def routine(keys):
    def fn(t):
        b = t * 8
        c = keyed(keys, b)
        fk = {}
        for ch, v in c.items():
            if '.' in ch:
                bn, ax = ch.split('.')
                fk.setdefault(bn, []).append((ax, v))
        fk.setdefault('head', []).append(('x', 7 * (0.5 + 0.5 * math.cos(TAU * b))))  # la tête marque le temps
        for n in LEGN:
            fk[n] = [('x', c['step'] * math.sin(math.pi * b + TAU * PH[n]))]
        sh = c.get('shim', 0)
        if sh:
            fk.setdefault('spine', []).append(('z', 14 * sh * math.sin(2 * TAU * b)))
            fk.setdefault('handL', []).append(('x', 30 * sh * math.sin(2 * TAU * b)))
            fk.setdefault('handR', []).append(('x', -30 * sh * math.sin(2 * TAU * b)))
        if c.get('spin'):
            fk['hips'] = [('z', c['spin'])]
        hop = 0.04 * (0.5 - 0.5 * math.cos(TAU * b))  # petit rebond entre les temps, pieds au sol sur le temps
        return pose(fk, hips=(c.get('hx', 0), 0, c.get('hz', 0) + hop), curl=c['curl'], spread=c.get('spread', 0),
                    point=(c.get('pointL', 0), c.get('pointR', 0)))
    return fn


# A : disco, le doigt vers le ciel puis vers le sol, l'autre main sur la hanche ; puis de l'autre côté
dA0 = {'armR.y': 150, 'armL.y': -40, 'forearmL.y': 95, 'pointR': 1, 'spine.y': -8, 'hx': -0.03, 'curl': 0.6}
dA1 = {'armR.y': -30, 'armR.x': -30, 'armL.y': -40, 'forearmL.y': 95, 'pointR': 1, 'spine.y': 8, 'hx': 0.03, 'curl': 0.6}
A_KEYS = [(0, dA0), (1, dA1), (2, dA0), (3, dA1), (4, mirror(dA0)), (5, mirror(dA1)), (6, mirror(dA0)), (7, mirror(dA1)), (8, dA0)]
# B : running man, poings serrés, puis shimmy des épaules, mains en éventail
bB0 = {'armL.y': -20, 'armL.x': -40, 'armR.y': 20, 'armR.x': 30, 'forearmL.x': -80, 'forearmR.x': -80, 'curl': 1, 'spine.x': 8, 'step': 30}
bB1 = {'armL.y': -20, 'armL.x': 30, 'armR.y': 20, 'armR.x': -40, 'forearmL.x': -80, 'forearmR.x': -80, 'curl': 1, 'spine.x': 8, 'step': 30}
bS = {'armL.y': -70, 'armR.y': 70, 'forearmL.x': -50, 'forearmR.x': -50, 'curl': 0, 'spread': 1, 'spine.x': -10, 'shim': 1, 'step': 6}
B_KEYS = [(0, bB0), (1, bB1), (2, bB0), (3, bB1), (4, bS), (7.5, bS), (8, bB0)]
# C : pirouette bras tendus, clap au-dessus de la tête, « raise the roof », et ta-da
cO = {'armL.y': -85, 'armR.y': 85, 'spine.x': -5, 'curl': 0.2, 'spread': 0.5}
cClap = {'armL.y': -165, 'armR.y': 165, 'forearmL.y': 30, 'forearmR.y': -30, 'curl': 0, 'spin': 360}
cOpen = {'armL.y': -140, 'armR.y': 140, 'curl': 0, 'spread': 0.6, 'spin': 360}
cRoof = {'armL.y': -78, 'armR.y': 78, 'forearmL.y': -85, 'forearmR.y': 85, 'curl': 0, 'spread': 0.4, 'spin': 360}
cPush = {'armL.y': -98, 'armR.y': 98, 'forearmL.y': -80, 'forearmR.y': 80, 'curl': 0, 'spread': 0.4, 'spin': 360}
cTada = {'armL.y': -125, 'armR.y': 125, 'armL.x': -20, 'armR.x': -20, 'spread': 1, 'curl': 0, 'spine.x': -12, 'hz': 0.06, 'spin': 360}
C_KEYS = [(0, cO), (2, {**cO, 'spin': 360}), (3, cClap), (3.5, cOpen), (4, cClap), (4.5, cOpen), (5, cRoof), (5.5, cPush), (6, cRoof),
          (6.5, cPush), (7, cTada), (8, {**cO, 'spin': 360})]

CLIPS = [('Idle', 60, idle), ('Walk', 24, walk), ('Sneak', 32, sneak), ('Fall', 12, fall), ('Teeter', 16, teeter), ('Splat', 10, splat),
         ('Getup', 10, getup), ('Fly', 20, fly), ('Jump', 10, jump), ('Dance', 32, dance),
         ('HighFive', 20, highfive),
         ('GrooveA', 96, routine(A_KEYS)), ('GrooveB', 96, routine(B_KEYS)), ('GrooveC', 96, routine(C_KEYS))]

arm.animation_data_create()
for name, frames, fn in CLIPS:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for f in range(frames + 1):
        st = fn(f / frames)
        for b in pb:
            b.rotation_quaternion = Quaternion()
            b.location = (0, 0, 0)
            b.scale = (1, 1, 1)
        for bname, rots in {**hands_fk(st['curl'], st['spread'], st['point']), **st['fk']}.items():
            pb[bname].rotation_quaternion = q_world(bname, rots)
        # le bassin : déplacement exprimé dans le repère de l'os
        loc = REST['hips'].to_3x3().inverted() @ Vector(st['hips'])
        pb['hips'].location = loc
        if st['scale']:
            sx, sy, sz = st['scale']
            pb['hips'].scale = REST['hips'].to_3x3().inverted() @ Vector((sx, sy, sz))
            pb['hips'].scale = (abs(pb['hips'].scale[0]), abs(pb['hips'].scale[1]), abs(pb['hips'].scale[2]))
        for b in pb:
            b.keyframe_insert('rotation_quaternion', frame=f)
        pb['hips'].keyframe_insert('location', frame=f)
        pb['hips'].keyframe_insert('scale', frame=f)
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 0, act)
arm.animation_data.action = None
for b in pb:
    b.rotation_quaternion = Quaternion()
    b.location = (0, 0, 0)
    b.scale = (1, 1, 1)
log('animations', [c[0] for c in CLIPS])

# =====================================================================================================
# Aperçus
# =====================================================================================================
if PREVIEW:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 700, 700
    world = bpy.data.worlds.new('W')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.08, 0.06, 0.2, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(45), 0, math.radians(-30))
    scene.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=6)
    ground = bpy.context.active_object
    ground.data.materials.append(flat_material('Sol', '#4fae45', 0.9))
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.view_settings.view_transform = 'Standard'
    H = 1.0 if WHO == 'toejam' else 1.1
    shots = [('face', 'Idle', 0, (0.4, -3.4, 1.4), (0, 0, 0.8)), ('troisquarts', 'Idle', 0, (2.4, -2.4, 2.0), (0, 0, 0.8)),
             ('profil', 'Walk', 6, (3.4, 0, 1.2), (0, 0, 0.8)), ('dos', 'Idle', 0, (-1.2, 3.2, 1.6), (0, 0, 0.8)),
             ('chute', 'Fall', 3, (1.5, -3.0, 1.6), (0, 0, 0.9)), ('danse', 'Dance', 8, (1.4, -3.0, 1.4), (0, 0, 0.9)),
             ('ecrase', 'Splat', 0, (1.4, -2.6, 1.6), (0, 0, 0.3)),
             ('disco', 'GrooveA', 0, (1.0, -3.2, 1.4), (0, 0, 0.9)), ('disco2', 'GrooveA', 12, (1.0, -3.2, 1.4), (0, 0, 0.9)),
             ('runningman', 'GrooveB', 6, (2.2, -2.6, 1.4), (0, 0, 0.9)), ('shimmy', 'GrooveB', 66, (1.0, -3.2, 1.4), (0, 0, 0.9)),
             ('pirouette', 'GrooveC', 12, (1.0, -3.2, 1.4), (0, 0, 0.9)), ('roof', 'GrooveC', 66, (1.0, -3.2, 1.4), (0, 0, 0.9)),
             ('tada', 'GrooveC', 84, (1.0, -3.2, 1.4), (0, 0, 0.9))]
    hz = MOUTH['z'] + 0.12
    for lab, keys in (('neutre', {}), ('joie', {'joie': 1, 'haut': 0.4}), ('peur', {'ouvert': 1, 'haut': 1}),
                      ('aie', {'aie': 1, 'colere': 1}), ('triste', {'aie': 0.5, 'triste': 1})):
        shots.append(('visage_' + lab, 'Idle', 0, (0.35, -1.9, hz + 0.25), (0, 0, hz), keys))
    shots.append(('main_ouverte', 'Teeter', 0, 'main', None))
    shots.append(('main_poing', 'Dance', 4, 'main', None))
    shots.append(('pointe', 'Sneak', 0, (2.6, -2.6, 1.4), (0, 0, 0.8)))
    shots.append(('pointe_profil', 'Sneak', 8, (3.4, 0, 1.2), (0, 0, 0.8)))
    only = os.environ.get('PERSO_SHOTS')
    if only:
        shots = [s for s in shots if s[0] in only.split(',')]
    for shot in shots:
        label, action, frame, pos, target = shot[:5]
        keys = shot[5] if len(shot) > 5 else {}
        for o in [MOUTHO] + BROWS:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = keys.get(kb.name, 0)
        for tr in arm.animation_data.nla_tracks:
            tr.mute = tr.name != action
        scene.frame_set(frame)
        if pos == 'main':  # gros plan sur la main gauche, où qu'elle soit
            hp = arm.matrix_world @ pb['f2L'].head
            target, pos = tuple(hp), tuple(hp + Vector((0.5, -0.7, 0.15)))
        cam.data.lens = 50 if not label.startswith(('visage', 'main')) else 85
        cam.location = pos
        cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(PREVIEW, f'{WHO}_{label}.png')
        bpy.ops.render.render(write_still=True)
        log('aperçu', label)
    for tr in arm.animation_data.nla_tracks:
        tr.mute = False
    for o in (cam, sun, ground):
        remove(o)

# =====================================================================================================
# Export
# =====================================================================================================
scene.frame_set(0)
for m in bpy.data.materials:
    m.use_backface_culling = True
for o in bpy.context.view_layer.objects:
    o.select_set(o.type in ('MESH', 'ARMATURE'))
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
          export_skins=True, export_yup=True, export_apply=False)
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
log('EXPORT OK', OUT)
