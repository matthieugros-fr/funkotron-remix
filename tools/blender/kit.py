# Boîte à outils commune pour modeler les personnages par script dans Blender (sans interface).
# Reprise de perso.py (ToeJam et Earl) sous forme de fonctions réutilisables, pour les terriens.
#
#   import kit as K
#   K.init('dentist', '/chemin/sortie.glb', '/chemin/apercus')   # aperçus facultatifs (None)
#   prims = [K.ell('tete', (0, 0, 1.5), (0.2, 0.2, 0.22)), K.cone('jambe', a, b, r1, r2), K.rbox('veste', c, (sx, sy, sz), r)]
#   body = K.sdf_mesh('Body', prims, lo, hi)            → un maillage lisse (volumes fondus les uns dans les autres)
#   K.decimate(body, 9000); co, tags = K.paint(body, prims, {'default': K.srgb('#fff'), 'tete': ...})
#   body.data.materials.append(K.vc_material('Peau'))
#   K.rig_begin(); K.bone('root', (0,0,0.5), (0,0,0.7)); ...; K.rig_end()
#   K.skin(body, co, tags, lambda tag, p: ['root', 'spine'])   # os autorisés pour chaque région
#   K.attach(objet, 'nom_os')                            # accessoire rigide (lunettes, outil…)
#   K.bake([('Idle', 60, fn), ...])                      # fn(t ∈ [0,1]) → K.pose(fk={os: [('x', degrés)]}, root=(x, y, z))
#   K.preview([('face', 'Idle', 0, (0, -3, 1.4), (0, 0, 0.8)), ...]); K.export()
#
# Repère : le personnage regarde vers -Y (Blender), c'est-à-dire +Z dans le jeu ; +X = sa gauche ; pieds à z = 0.
# Rotations des os : axes du MONDE ; x+ = bascule vers l'avant (pour un os vertical), y = latéral, z = autour de la verticale.

import bpy
import math
import os
import time
import numpy as np
import openvdb as vdb
from mathutils import Vector, Quaternion, Euler
from mathutils.kdtree import KDTree

S = {}  # état : nom, sortie, dossier de travail, scène, squelette


def init(name, out, preview=None, fps=30):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = fps
    # dossier de travail propre à chaque personnage (plusieurs Blender peuvent tourner en même temps)
    work = f'/tmp/terrien_{name}_{os.getpid()}'
    os.makedirs(work, exist_ok=True)
    S.update(name=name, out=out, preview=preview, work=work, scene=scene, t0=time.time(), arm=None, extras=[])
    return scene


def log(*a):
    print(f"[{S.get('name')} {time.time() - S.get('t0', time.time()):6.1f}s]", *a, flush=True)


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
    """couleur hexadécimale → couleur linéaire (pour les couleurs de sommets)"""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return np.array([(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c])


def V(*a):
    return np.array(a, dtype=np.float64)


def rot(rx=0, ry=0, rz=0):
    return np.array(Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix(), dtype=np.float64)


# =====================================================================================================
# Volumes de distance signée
# =====================================================================================================
def ell(tag, c, r, k=0.02, R=None, op='add'):
    """ellipsoïde de centre c et de demi-axes r (R : rotation 3×3 facultative)"""
    return dict(tag=tag, kind='ell', c=V(*c), r=V(*r), R=R if R is not None else np.eye(3), k=k, op=op)


def cone(tag, a, b, r1, r2, k=0.02, op='add'):
    """capsule conique de a (rayon r1) à b (rayon r2)"""
    return dict(tag=tag, kind='cone', a=V(*a), b=V(*b), r1=r1, r2=r2, k=k, op=op)


def rbox(tag, c, h, r=0.02, k=0.02, R=None, op='add'):
    """boîte de centre c, demi-tailles h, coins arrondis de rayon r"""
    return dict(tag=tag, kind='box', c=V(*c), h=V(*h), r=r, R=R if R is not None else np.eye(3), k=k, op=op)


def _local(p, X, Y, Z):
    dx, dy, dz = X - p['c'][0], Y - p['c'][1], Z - p['c'][2]
    R = p['R']
    return (R[0, 0] * dx + R[1, 0] * dy + R[2, 0] * dz, R[0, 1] * dx + R[1, 1] * dy + R[2, 1] * dz,
            R[0, 2] * dx + R[1, 2] * dy + R[2, 2] * dz)


def sd_prim(p, X, Y, Z):
    if p['kind'] == 'ell':
        qx, qy, qz = _local(p, X, Y, Z)
        rx, ry, rz = p['r']
        k0 = np.sqrt((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2)
        k1 = np.sqrt((qx / rx ** 2) ** 2 + (qy / ry ** 2) ** 2 + (qz / rz ** 2) ** 2)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
    if p['kind'] == 'box':
        qx, qy, qz = _local(p, X, Y, Z)
        h, r = p['h'] - p['r'], p['r']
        ax, ay, az = np.abs(qx) - h[0], np.abs(qy) - h[1], np.abs(qz) - h[2]
        out = np.sqrt(np.maximum(ax, 0) ** 2 + np.maximum(ay, 0) ** 2 + np.maximum(az, 0) ** 2)
        return out + np.minimum(np.maximum(ax, np.maximum(ay, az)), 0) - r
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


def sdf_mesh(name, prims, lo, hi, vox=0.006, clip=None, smooth=2):
    """maille un ensemble de volumes (fondus avec leur douceur k ; op='sub' creuse) par OpenVDB"""
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
    path = os.path.join(S['work'], f'vol_{name}.vdb')
    vdb.write(path, grids=[g])
    bpy.ops.object.volume_import(filepath=path)
    vo = bpy.context.active_object
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    S['scene'].collection.objects.link(ob)
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


def decimate(ob, faces, symmetric=True):
    tris = sum(len(f.vertices) - 2 for f in ob.data.polygons)
    if tris > faces:
        dec = ob.modifiers.new('Dec', 'DECIMATE')
        dec.ratio = faces / tris
        dec.use_symmetry = symmetric
        dec.symmetry_axis = 'X'
        apply_mod(ob, 'Dec')
    activate(ob)
    bpy.ops.object.shade_smooth()


def paint(ob, prims, colors, extra=None):
    """couleur par sommet : celle du volume (ajouté) le plus proche ; extra(co, nor, col, tag) peut retoucher"""
    me = ob.data
    nv = len(me.vertices)
    co = np.empty(nv * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    nor = np.empty(nv * 3)
    me.vertex_normals.foreach_get('vector', nor)
    nor = nor.reshape(-1, 3)
    best = np.full(nv, 1e9)
    tag = np.empty(nv, dtype=object)
    for p in prims:
        if p['op'] != 'add':
            continue
        d = sd_prim(p, co[:, 0], co[:, 1], co[:, 2])
        m = d < best
        best[m] = d[m]
        tag[m] = p['tag']
    col = np.array([colors.get(t, colors['default']) for t in tag], dtype=np.float64)
    if extra:
        extra(co, nor, col, tag)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([np.clip(col, 0, 1), np.ones((nv, 1))], axis=1)
    ca.data.foreach_set('color', rgba.ravel())
    me.color_attributes.active_color = ca
    return co, tag


# =====================================================================================================
# Matières et pièces simples
# =====================================================================================================
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


_MATS = {}


def mat(name, color, rough=0.5, metal=0.0, emit=None, alpha=None):
    """matière unie (réutilisée si elle existe déjà) ; alpha < 1 la rend transparente"""
    key = (name, color, rough, metal, emit, alpha)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = tuple(srgb(color)) + (1,)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emit:
        bs.inputs['Emission Color'].default_value = tuple(srgb(emit)) + (1,)
        bs.inputs['Emission Strength'].default_value = 0.6
    if alpha is not None:
        bs.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else m.blend_method
    _MATS[key] = m
    return m


def _finish(o, name, m, smooth=True):
    o.name = name
    if m is not None:
        o.data.materials.append(m)
    activate(o)
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def sphere(name, c, r, m, scale=(1, 1, 1), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=max(8, seg // 2), location=c)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, name, m)


def _orient(o, a, b):
    """aligne l'axe Z local de o sur le segment a → b et le place au milieu"""
    a, b = Vector(a), Vector(b)
    d = b - a
    o.location = (a + b) / 2
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


def cylinder(name, a, b, r, m, seg=16, smooth=True):
    d = (Vector(b) - Vector(a)).length
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=seg)
    o = bpy.context.active_object
    _orient(o, a, b)
    return _finish(o, name, m, smooth)


def cone_mesh(name, a, b, r1, r2, m, seg=16, smooth=True):
    d = (Vector(b) - Vector(a)).length
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=d, vertices=seg)
    o = bpy.context.active_object
    _orient(o, a, b)
    return _finish(o, name, m, smooth)


def box(name, c, size, m, rot_deg=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.active_object
    o.scale = size
    o.rotation_euler = tuple(math.radians(x) for x in rot_deg)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        bv = o.modifiers.new('B', 'BEVEL')
        bv.width = bevel
        bv.segments = 2
        apply_mod(o, 'B')
    return _finish(o, name, m, smooth=False)


def torus(name, c, R, r, m, rot_deg=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=8, location=c)
    o = bpy.context.active_object
    o.rotation_euler = tuple(math.radians(x) for x in rot_deg)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return _finish(o, name, m)


def solid(name, prims, lo, hi, colors, faces=3000, vox=0.006, rough=0.5):
    """pièce rigide en volumes fondus, peinte par sommets (outil, chapeau, engin…)"""
    ob = sdf_mesh(name, prims, lo, hi, vox=vox)
    decimate(ob, faces, symmetric=False)
    paint(ob, prims, colors)
    ob.data.materials.append(vc_material(name + 'Mat', rough=rough))
    return ob


def eyes(c_left, r, pupil_dir=(0, -1, 0), white='#ffffff', pupil='#1a1033', pupil_r=0.45, names=('OeilG', 'OeilD')):
    """deux yeux (blanc brillant + pupille) symétriques ; c_left = centre de l'œil gauche (x > 0)"""
    out = []
    w, p = mat('Blanc', white, rough=0.15), mat('Pupille', pupil, rough=0.2)
    d = Vector(pupil_dir).normalized()
    for sx, n in zip((1, -1), names):
        c = Vector((c_left[0] * sx, c_left[1], c_left[2]))
        out.append(sphere(n, tuple(c), r, w))
        # la pupille dépasse un peu du blanc, sinon elle disparaît dedans
        out.append(sphere(n + 'P', tuple(c + d * r * 0.93), r * pupil_r, p, scale=(1, 0.5, 1)))
    return out


# =====================================================================================================
# Squelette, peau, accessoires
# =====================================================================================================
def rig_begin():
    arm_data = bpy.data.armatures.new('Rig')
    arm = bpy.data.objects.new('Rig', arm_data)
    S['scene'].collection.objects.link(arm)
    activate(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    S.update(arm=arm, arm_data=arm_data, EB=arm_data.edit_bones)
    return arm


def bone(name, a, b, parent=None, connect=False):
    bn = S['EB'].new(name)
    bn.head = Vector(tuple(a))
    bn.tail = Vector(tuple(b))
    bn.roll = 0
    if parent:
        bn.parent = S['EB'][parent]
        bn.use_connect = connect
    return bn


def rig_end():
    bpy.ops.object.mode_set(mode='OBJECT')
    ad = S['arm_data']
    S['BSEG'] = {b.name: (np.array(b.head_local), np.array(b.tail_local)) for b in ad.bones}
    S['BNAMES'] = list(S['BSEG'])
    S['REST'] = {b.name: b.matrix_local.copy() for b in ad.bones}
    for b in S['arm'].pose.bones:
        b.rotation_mode = 'QUATERNION'


def seg_dist(pts, a, b):
    ab = b - a
    t = np.clip(((pts - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(pts - (a + t[:, None] * ab), axis=1)


def _assign(ob, W):
    BN = S['BNAMES']
    groups = {n: ob.vertex_groups.new(name=n) for n in BN}
    for j, n in enumerate(BN):
        for i in np.nonzero(W[:, j])[0]:
            groups[n].add([int(i)], float(W[i, j]), 'REPLACE')
    ob.parent = S['arm']
    ob.modifiers.new('Armature', 'ARMATURE').object = S['arm']


def skin(ob, co, tags, allowed_fn, smooth=5, power=4):
    """poids de peau : chaque sommet n'écoute que les os autorisés pour sa région, au prorata inverse de la distance"""
    BN, BSEG = S['BNAMES'], S['BSEG']
    nl = len(co)
    DIST = np.stack([seg_dist(co, *BSEG[n]) for n in BN], axis=1)
    W = np.zeros((nl, len(BN)))
    for i in range(nl):
        for n in allowed_fn(tags[i], co[i]):
            j = BN.index(n)
            W[i, j] = 1.0 / (DIST[i, j] ** power + 1e-10)
    W /= np.maximum(W.sum(1, keepdims=True), 1e-12)
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
    W /= np.maximum(W.sum(1, keepdims=True), 1e-12)
    _assign(ob, W)
    return W


def skin_like(obs, body, body_co, W):
    """pièces posées sur la peau (bouche, sourcils…) : poids du sommet du corps le plus proche"""
    kd = KDTree(len(body_co))
    for i, c in enumerate(body_co):
        kd.insert(c, i)
    kd.balance()
    for o in obs:
        vc = np.empty(len(o.data.vertices) * 3)
        o.data.vertices.foreach_get('co', vc)
        near = [kd.find(c)[1] for c in vc.reshape(-1, 3)]
        _assign(o, W[near])


def attach(o, bname):
    """accessoire rigide, accroché à un os"""
    mw = o.matrix_world.copy()
    o.parent = S['arm']
    o.parent_type = 'BONE'
    o.parent_bone = bname
    o.matrix_world = mw
    return o


# =====================================================================================================
# Animations (rotations autour des axes du monde, cuites en clés)
# =====================================================================================================
AX = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}
TAU = math.tau


def q_world(bname, rots):
    r = S['REST'][bname].to_3x3()
    q = Quaternion()
    for a, deg in rots:
        ax = AX[a] if isinstance(a, str) else Vector(a)
        q = Quaternion((r.inverted() @ ax).normalized(), math.radians(deg)) @ q
    return q


def pose(fk=None, root=(0, 0, 0), scale=None, root_bone='root'):
    """fk : {os: [(axe, degrés), ...]} ; root : déplacement de l'os racine (repère monde) ; scale : (sx, sy, sz) de la racine"""
    return dict(fk=fk or {}, root=root, scale=scale, root_bone=root_bone)


def bake(clips):
    """clips : [(nom, images, fn)] ; fn(t de 0 à 1) → pose(...) ; boucles : faire coïncider t=0 et t=1"""
    arm, pb, REST = S['arm'], S['arm'].pose.bones, S['REST']
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
                pb[bname].rotation_quaternion = q_world(bname, rots)
            rb = st['root_bone']
            pb[rb].location = REST[rb].to_3x3().inverted() @ Vector(st['root'])
            if st['scale']:
                sc = REST[rb].to_3x3().inverted() @ Vector(st['scale'])
                pb[rb].scale = (abs(sc[0]), abs(sc[1]), abs(sc[2]))
            for b in pb:
                b.keyframe_insert('rotation_quaternion', frame=f)
            pb[rb].keyframe_insert('location', frame=f)
            pb[rb].keyframe_insert('scale', frame=f)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
    arm.animation_data.action = None
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    log('animations', [c[0] for c in clips])


# petits outils de mouvement
def wave(t, n=1, ph=0.0):
    return math.sin(TAU * (n * t + ph))


def hop(t, n=1, ph=0.0):
    """bond : 0 au sol, 1 au sommet ; n bonds par boucle"""
    return abs(math.sin(math.pi * (n * t + ph)))


# =====================================================================================================
# Aperçus et export
# =====================================================================================================
def preview(shots, size=640, ground='#4fae45'):
    """shots : [(étiquette, clip, image, position caméra, cible)] → PNG dans le dossier d'aperçus"""
    if not S['preview']:
        return
    from mathutils import Vector as Vc
    scene, arm = S['scene'], S['arm']
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = size
    world = bpy.data.worlds.new('W')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.08, 0.06, 0.2, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(45), 0, math.radians(-30))
    scene.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=8)
    gr = bpy.context.active_object
    gr.data.materials.append(mat('Sol', ground, 0.9))
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.view_settings.view_transform = 'Standard'
    for label, action, frame, pos, target in shots:
        if arm and arm.animation_data:
            for tr in arm.animation_data.nla_tracks:
                tr.mute = tr.name != action
        scene.frame_set(frame)
        cam.data.lens = 50
        cam.location = pos
        cam.rotation_euler = (Vc(target) - Vc(pos)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(S['preview'], f"{S['name']}_{label}.png")
        bpy.ops.render.render(write_still=True)
        log('aperçu', label)
    if arm and arm.animation_data:
        for tr in arm.animation_data.nla_tracks:
            tr.mute = False
    for o in (cam, sun, gr):
        remove(o)


def export(out=None):
    out = out or S['out']
    scene = S['scene']
    scene.frame_set(0)
    for m in bpy.data.materials:
        m.use_backface_culling = True
    for o in bpy.context.view_layer.objects:
        o.select_set(o.type in ('MESH', 'ARMATURE'))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    kw = dict(filepath=out, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
              export_skins=True, export_yup=True, export_apply=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    log('EXPORT OK', out, f'{os.path.getsize(out) / 1024:.0f} Ko')
