# Le petit diable : rouge vif, petites cornes, sourcils froncés, paupières tombantes, sourire pointu plein de crocs,
# barbiche, queue en pointe de flèche (sur cinq os, elle ondule), sabots fendus, fourche à trois dents.
# Il sautille sans arrêt.
#   Blender -b -P tools/blender/terriens/devil.py -- public/models/terriens/devil.glb [dossier_aperçus]
# Clips : Idle (sautille en se frottant les mains), Walk (petits sauts), Run (grands bonds, fourche pointée),
#         Warn (fait tournoyer la fourche, ricane en silence), Hit (rire plié en deux, tape du sabot), Dance (gigue).
# Pièces nommées : Fourche (os fork, enfant de handR), Dents, OeilG / OeilD (+P pupilles) ; la queue fait partie
#   de la peau (os tail1 … tail5).
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import bpy
import numpy as np
import kit as K
from kit import V, ell, cone, rbox, srgb, wave, hop
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/devil.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('devil', OUT, PREVIEW)
# dossier de travail à moi (les volumes .vdb), pour ne pas croiser les autres terriens modelés en même temps
K.S['work'] = os.path.join(os.path.dirname(os.path.abspath(PREVIEW)) if PREVIEW else '/tmp', 'work_devil')
os.makedirs(K.S['work'], exist_ok=True)

# =====================================================================================================
# Outils en plus du kit : volumes « fonction », tubes, cœurs, yeux brillants, posture globale, IK à deux os,
# clés de position / d'échelle sur d'autres os que la racine, aperçus avec un sol plus bas.
# =====================================================================================================
_sd0 = K.sd_prim


def _sd(p, X, Y, Z):
    if p['kind'] == 'fn':
        return p['fn'](X, Y, Z)
    return _sd0(p, X, Y, Z)


K.sd_prim = _sd


def crescent(tag, A, B, k=0.01):
    """creuse l'ellipsoïde A privé de l'ellipsoïde B (une bouche en croissant)"""
    fa, fb = ell('a', *A), ell('b', *B)
    return dict(tag=tag, kind='fn', fn=lambda X, Y, Z: np.maximum(_sd0(fa, X, Y, Z), -_sd0(fb, X, Y, Z)), k=k, op='sub')


def tube(name, pts, radii, m, seg=8, caps=True):
    """tube lisse le long d'une ligne brisée (rayon par point)"""
    pts = [Vector(tuple(p)) for p in pts]
    n = len(pts)
    radii = [radii] * n if np.isscalar(radii) else list(radii)
    T = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    up = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N = (up - T[0] * up.dot(T[0])).normalized()
    verts, faces = [], []
    for i in range(n):
        if i:
            N = T[i - 1].rotation_difference(T[i]) @ N
            N = (N - T[i] * N.dot(T[i])).normalized()
        Bn = T[i].cross(N)
        for j in range(seg):
            a = K.TAU * j / seg
            verts.append(pts[i] + (N * math.cos(a) + Bn * math.sin(a)) * radii[i])
    for i in range(n - 1):
        for j in range(seg):
            faces.append((i * seg + j, i * seg + (j + 1) % seg, (i + 1) * seg + (j + 1) % seg, (i + 1) * seg + j))
    if caps:
        c0 = len(verts)
        verts.append(pts[0])
        verts.append(pts[-1])
        for j in range(seg):
            faces.append((c0, (j + 1) % seg, j))
            faces.append((c0 + 1, (n - 1) * seg + j, (n - 1) * seg + (j + 1) % seg))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    K.S['scene'].collection.objects.link(ob)
    return K._finish(ob, name, m)


def solid2(name, prims, lo, hi, colors, faces, vox, matname, rough=0.5, extra=None):
    ob = K.sdf_mesh(name, prims, lo, hi, vox=vox)
    K.decimate(ob, faces, symmetric=False)
    K.paint(ob, prims, colors, extra)
    ob.data.materials.append(K.vc_material(matname, rough=rough))
    return ob


def heart_prims(tag, pos, s, M=np.eye(3)):
    """cœur dodu : deux lobes en haut (z local), pointe en bas, épaisseur selon y local ; M oriente, pos place"""
    pos = V(*pos)
    out = []
    for sx in (1, -1):
        out.append(ell(tag, tuple(pos + M @ V(0.42 * sx * s, 0, 0.2 * s)), (0.5 * s, 0.34 * s, 0.5 * s), k=0.25 * s, R=M))
    out.append(rbox(tag, tuple(pos + M @ V(0, 0, -0.22 * s)), (0.6 * s, 0.34 * s, 0.6 * s), r=0.12 * s, k=0.25 * s,
                    R=M @ K.rot(0, 45, 0)))
    return out


def eyes2(c_left, r, sc=(1, 1, 1), pupil_dir=(0, -1, 0), pupil_r=0.5, white='#ffffff', pupil='#1a1033', sparkle=True, seg=16):
    """deux yeux (blanc, pupille, petit reflet) ; c_left = centre de l'œil gauche (x > 0)"""
    out = []
    w, p = K.mat('Blanc', white, rough=0.15), K.mat('Pupille', pupil, rough=0.2)
    d = Vector(pupil_dir).normalized()
    for sx, n in ((1, 'OeilG'), (-1, 'OeilD')):
        c = Vector((c_left[0] * sx, c_left[1], c_left[2]))
        out.append(K.sphere(n, tuple(c), r, w, scale=sc, seg=seg))
        k = 1 / math.sqrt((d.x / (r * sc[0])) ** 2 + (d.y / (r * sc[1])) ** 2 + (d.z / (r * sc[2])) ** 2)
        pc = c + d * k * 0.9
        rp = r * pupil_r
        out.append(K.sphere(n + 'P', tuple(pc), rp, p, scale=(1, 0.5, sc[2]), seg=seg))
        if sparkle:
            out.append(K.sphere(n + 'R', tuple(pc + Vector((-0.38 * rp, -0.6 * rp, 0.42 * rp * sc[2]))), rp * 0.32, w, seg=6))
    return out


def _B():
    return K.S['arm'].data.bones


def _P():
    return K.S['arm'].pose.bones


def gmat(n):
    """matrice posée de l'os (repère de l'armature = monde), calculée depuis les canaux, sans évaluer la scène"""
    b, p = _B()[n], _P()[n]
    basis = Matrix.LocRotScale(p.location, p.rotation_quaternion, p.scale)
    if b.parent is None:
        return b.matrix_local @ basis
    return gmat(b.parent.name) @ (b.parent.matrix_local.inverted() @ b.matrix_local) @ basis


def base_q(n):
    b = _B()[n]
    if b.parent is None:
        return b.matrix_local.to_quaternion()
    g = gmat(b.parent.name).to_3x3().normalized()
    return (g @ (b.parent.matrix_local.to_3x3().inverted() @ b.matrix_local.to_3x3())).to_quaternion()


def rdir(n, v):
    """direction v (au repos) emportée par la pose de l'os n"""
    g = gmat(n).to_3x3().normalized() @ _B()[n].matrix_local.to_3x3().inverted()
    return (g @ Vector(v)).normalized()


def follow(n, p):
    """point p (au repos) emporté par la pose de l'os n"""
    return gmat(n) @ (_B()[n].matrix_local.inverted() @ Vector(tuple(p)))


def qw(rots):
    q = Quaternion()
    for a, deg in rots:
        ax = K.AX[a] if isinstance(a, str) else Vector(a).normalized()
        q = Quaternion(ax, math.radians(deg)) @ q
    return q


def set_glob(n, rots, w=1.0):
    """oriente l'os dans le monde : son orientation de repos tournée par rots, quel que soit le parent"""
    want = base_q(n).inverted() @ qw(rots) @ _B()[n].matrix_local.to_quaternion()
    p = _P()[n]
    p.rotation_quaternion = p.rotation_quaternion.slerp(want, w) if w < 1 else want


def aim_q(n, d):
    qb = base_q(n)
    sw = (qb @ Vector((0, 1, 0))).rotation_difference(Vector(d).normalized())
    return qb.inverted() @ sw @ qb


def ik2(up, lo, target, pole, w=1.0):
    """IK à deux os : le bout de lo va sur target ; le coude part du côté de pole (direction)"""
    if w <= 0:
        return
    P, B = _P(), _B()
    fu, fl = P[up].rotation_quaternion.copy(), P[lo].rotation_quaternion.copy()
    T = Vector(target() if callable(target) else target)
    S = gmat(up).translation.copy()
    a, b = B[up].length, B[lo].length
    d = T - S
    L = min(max(d.length, abs(a - b) + 1e-4), a + b - 1e-4)
    u = d.normalized()
    pl = Vector(pole() if callable(pole) else pole)
    pv = pl - u * pl.dot(u)
    pv = pv.normalized() if pv.length > 1e-6 else u.orthogonal().normalized()
    ca = (a * a + L * L - b * b) / (2 * a * L)
    E = S + (u * ca + pv * math.sqrt(max(0.0, 1 - ca * ca))) * a
    P[up].rotation_quaternion = aim_q(up, E - S)
    P[lo].rotation_quaternion = aim_q(lo, S + u * L - E)
    if w < 1:
        P[up].rotation_quaternion = fu.slerp(P[up].rotation_quaternion, w)
        P[lo].rotation_quaternion = fl.slerp(P[lo].rotation_quaternion, w)


def pose2(fk=None, root=(0, 0, 0), scale=None, loc=None, scl=None, steps=None, ground=None):
    """fk comme le kit ; loc / scl : position (repère du monde au repos) / échelle d'autres os ;
    steps : [('glob', os, rots, poids), ('ik', haut, bas, cible, pôle, poids)] appliqués dans l'ordre ;
    ground : si donné, la racine monte ou descend pour que la cheville la plus basse soit à (hauteur de repos + ground)"""
    return dict(fk=fk or {}, root=root, scale=scale, loc=loc or {}, scl=scl or {}, steps=steps or [], ground=ground)


def bake2(clips, keyed=()):
    arm = K.S['arm']
    pb, REST = arm.pose.bones, K.S['REST']
    arm.animation_data_create()
    for name, frames, fn in clips:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        prev = {}
        for f in range(frames + 1):
            st = fn(f / frames)
            for b in pb:
                b.rotation_quaternion = Quaternion()
                b.location = (0, 0, 0)
                b.scale = (1, 1, 1)
            for bn, rots in st['fk'].items():
                pb[bn].rotation_quaternion = K.q_world(bn, rots)
            pb['root'].location = REST['root'].to_3x3().inverted() @ Vector(st['root'])
            if st['scale']:
                sc = REST['root'].to_3x3().inverted() @ Vector(st['scale'])
                pb['root'].scale = (abs(sc[0]), abs(sc[1]), abs(sc[2]))
            for bn, v in st['loc'].items():
                pb[bn].location = REST[bn].to_3x3().inverted() @ Vector(v)
            for bn, s in st['scl'].items():
                pb[bn].scale = (s, s, s)
            for stp in st['steps']:
                if stp[0] == 'glob':
                    set_glob(*stp[1:])
                elif stp[0] == 'ik':
                    ik2(*stp[1:])
            if st['ground'] is not None:
                low = min(gmat('foot' + sd).translation.z for sd in 'LR')
                dz = _B()['footL'].head_local.z + st['ground'] - low
                pb['root'].location = pb['root'].location + REST['root'].to_3x3().inverted() @ Vector((0, 0, dz))
            for b in pb:
                q = b.rotation_quaternion.copy()
                if b.name in prev and q.dot(prev[b.name]) < 0:
                    q.negate()
                    b.rotation_quaternion = q
                prev[b.name] = q
                b.keyframe_insert('rotation_quaternion', frame=f)
            for bn in ('root',) + tuple(keyed):
                pb[bn].keyframe_insert('location', frame=f)
                pb[bn].keyframe_insert('scale', frame=f)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
    arm.animation_data.action = None
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    K.log('animations', [c[0] for c in clips])


def preview2(shots, ground_z=0.0, size=640):
    """comme K.preview, avec le sol à la hauteur voulue (Cupidon vole)"""
    if not K.S['preview']:
        return
    scene, arm = K.S['scene'], K.S['arm']
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
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, ground_z))
    gr = bpy.context.active_object
    gr.data.materials.append(K.mat('Sol', '#4fae45', 0.9))
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.view_settings.view_transform = 'Standard'
    for label, action, frame, pos, target in shots:
        for tr in arm.animation_data.nla_tracks:
            tr.mute = tr.name != action
        scene.frame_set(frame)
        cam.data.lens = 50
        cam.location = pos
        cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(K.S['preview'], f"{K.S['name']}_{label}.png")
        bpy.ops.render.render(write_still=True)
        K.log('aperçu', label)
    for tr in arm.animation_data.nla_tracks:
        tr.mute = False
    for o in (cam, sun, gr):
        K.remove(o)


def sm(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)

# =====================================================================================================
# Proportions (~0,9 de haut, cornes comprises)
# =====================================================================================================
HIP_Z = 0.3
HEAD_C = V(0, -0.01, 0.69)
HEAD_R = V(0.162, 0.148, 0.155)
SH = V(0.13, 0.0, 0.535)       # épaule gauche
EL = V(0.19, -0.02, 0.435)     # coude
WR = V(0.21, -0.06, 0.345)     # poignet
HD = V(0.215, -0.09, 0.305)    # bout du poing
HIP = V(0.068, 0.01, 0.3)
KNEE = V(0.082, -0.05, 0.175)
ANK = V(0.085, 0.015, 0.07)
TOE = V(0.085, -0.065, 0.03)
EYE_L, EYE_R = V(0.062, -0.122, 0.712), 0.043
MOUTH_A = ((0, -0.15, 0.612), (0.088, 0.07, 0.046))
MOUTH_B = ((0, -0.15, 0.645), (0.1, 0.09, 0.046))
TAIL = [V(0, 0.1, 0.33), V(0, 0.2, 0.275), V(0, 0.31, 0.29), V(0, 0.38, 0.37), V(0, 0.395, 0.48), V(0, 0.355, 0.575)]


def lid(c, r, side):
    """paupière tombante : calotte de sphère au-dessus d'un bord en biais (plus bas côté nez : l'air mauvais)"""
    c = V(*c)

    def f(X, Y, Z):
        d = np.sqrt((X - c[0]) ** 2 + (Y - c[1]) ** 2 + (Z - c[2]) ** 2) - r
        edge = c[2] + 0.1 * r + 0.42 * (X - c[0]) * side
        return np.maximum(d, (edge - Z) * 0.9)
    return dict(tag='lid', kind='fn', fn=f, k=0.006, op='add')


body = [
    # bassin, buste bedonnant, poitrine, cou
    ell('torso', (0, 0.01, 0.33), (0.11, 0.095, 0.07), k=0.04),
    ell('torso', (0, 0.0, 0.44), (0.13, 0.11, 0.13), k=0.05),
    ell('belly', (0, -0.035, 0.405), (0.115, 0.1, 0.1), k=0.05),
    ell('torso', (0, 0.0, 0.51), (0.125, 0.095, 0.07), k=0.05),
    cone('neck', (0, 0, 0.53), (0, -0.01, 0.6), 0.05, 0.05, k=0.04),
    # la tête : pommettes, menton pointu, barbiche, nez crochu, oreilles en pointe
    ell('head', tuple(HEAD_C), tuple(HEAD_R), k=0.04),
    ell('head', (0.075, -0.075, 0.645), (0.07, 0.065, 0.06), k=0.04),
    ell('head', (-0.075, -0.075, 0.645), (0.07, 0.065, 0.06), k=0.04),
    cone('chin', (0, -0.07, 0.6), (0, -0.105, 0.535), 0.05, 0.016, k=0.035),
    cone('beard', (0, -0.112, 0.55), (0, -0.138, 0.475), 0.022, 0.003, k=0.012),
    cone('nose', (0, -0.135, 0.705), (0, -0.175, 0.672), 0.022, 0.013, k=0.02),
    cone('ear', (0.145, 0.0, 0.7), (0.245, 0.035, 0.775), 0.038, 0.004, k=0.02),
    cone('ear', (-0.145, 0.0, 0.7), (-0.245, 0.035, 0.775), 0.038, 0.004, k=0.02),
    # paupières en biais, sourcils froncés
    lid(EYE_L, EYE_R * 1.12, 1),
    lid(EYE_L * V(-1, 1, 1), EYE_R * 1.12, -1),
    ell('brow', (0.062, -0.13, 0.776), (0.054, 0.02, 0.016), k=0.012, R=K.rot(0, -26, 0)),
    ell('brow', (-0.062, -0.13, 0.776), (0.054, 0.02, 0.016), k=0.012, R=K.rot(0, 26, 0)),
    # le sourire en croissant
    crescent('mouth', MOUTH_A, MOUTH_B, k=0.008),
]
# les cornes : courtes, recourbées vers l'extérieur puis vers le haut
for sx in (1, -1):
    hp = [V(0.075 * sx, -0.02, 0.81), V(0.105 * sx, -0.015, 0.872), V(0.124 * sx, 0.0, 0.922), V(0.118 * sx, 0.02, 0.962)]
    hr = [0.031, 0.021, 0.012, 0.003]
    for i in range(3):
        body.append(cone('horn', tuple(hp[i]), tuple(hp[i + 1]), hr[i], hr[i + 1], k=0.02 if i == 0 else 0.006))
# bras maigres, mains en moufle avec pouce
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('arm', tuple(SH * m), tuple(EL * m), 0.037, 0.031, k=0.025))
    body.append(cone('arm', tuple(EL * m), tuple(WR * m), 0.031, 0.028, k=0.015))
    body.append(ell('hand', tuple(((WR + HD) / 2) * m), (0.034, 0.03, 0.042), k=0.02))
    body.append(ell('hand', tuple((WR * 0.6 + HD * 0.4 + V(-0.022, -0.02, 0)) * m), (0.013, 0.013, 0.022), k=0.01))
# jambes de bouc (genou en avant, jarret en arrière), sabots noirs fendus
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('leg', tuple(HIP * m), tuple(KNEE * m), 0.056, 0.04, k=0.03))
    body.append(cone('leg', tuple(KNEE * m), tuple(ANK * m), 0.04, 0.03, k=0.02))
    body.append(ell('hoof', tuple(V(0.085 * sx, -0.015, 0.036)), (0.043, 0.054, 0.036), k=0.018))
for sx in (1, -1):
    body.append(rbox('cleft', (0.085 * sx, -0.06, 0.036), (0.004, 0.03, 0.045), r=0.002, k=0.004, op='sub'))
# la queue : fine, en S, et sa pointe de flèche (à plat, face à l'arrière)
tr = [0.027, 0.024, 0.022, 0.02, 0.019, 0.018]
for i in range(5):
    body.append(cone('tail', tuple(TAIL[i]), tuple(TAIL[i + 1]), tr[i], tr[i + 1], k=0.03 if i == 0 else 0.01))
TD = TAIL[5] - TAIL[4]
TD /= np.linalg.norm(TD)
TW = V(1, 0, 0)
TN = np.cross(TD, TW)
MT = np.stack([TW, TN, TD], 1)        # x : largeur, y : épaisseur, z : sens de la queue
body += [ell('tailtip', tuple(TAIL[5] + TD * 0.014 + TW * 0.03 * s), (0.032, 0.013, 0.027), k=0.012, R=MT) for s in (1, -1)]
body.append(rbox('tailtip', tuple(TAIL[5] + TD * 0.05), (0.042, 0.013, 0.042), r=0.004, k=0.012, R=MT @ K.rot(0, 45, 0)))

RED = '#e3241b'
COL = {'default': srgb(RED), 'torso': srgb(RED), 'belly': srgb('#f0442c'), 'neck': srgb(RED), 'head': srgb(RED),
       'chin': srgb(RED), 'nose': srgb('#c71912'), 'ear': srgb(RED), 'lid': srgb('#cc1d16'), 'brow': srgb('#1a0a10'),
       'beard': srgb('#1a0a10'), 'horn': srgb('#fff0c4'), 'arm': srgb(RED), 'hand': srgb('#d61e17'), 'leg': srgb(RED),
       'hoof': srgb('#1e1218'), 'tail': srgb(RED), 'tailtip': srgb('#c8141a')}
A_ELL, B_ELL = ell('a', *MOUTH_A), ell('b', *MOUTH_B)


def extra(co, nor, col, tag):
    # cornes : ivoire, la pointe plus foncée
    h = tag == 'horn'
    f = np.clip((co[:, 2] - 0.84) / 0.11, 0, 1)
    col[h] = srgb('#fff0c4') * (1 - f[h, None]) + srgb('#c99a52') * f[h, None]
    # la bouche : intérieur sombre, langue rouge clair au fond
    dc = np.maximum(_sd0(A_ELL, co[:, 0], co[:, 1], co[:, 2]), -_sd0(B_ELL, co[:, 0], co[:, 1], co[:, 2]))
    inside = dc < 0.004
    col[inside] = srgb('#36050e')
    col[inside & (co[:, 2] < 0.582) & (np.abs(co[:, 0]) < 0.04)] = srgb('#ff4f5e')
    # le ventre un peu plus clair au centre, les sabots un peu luisants sur le dessus
    b = tag == 'belly'
    g = np.clip(1 - np.linalg.norm((co - V(0, -0.13, 0.4)) / V(0.09, 0.2, 0.09), axis=1), 0, 1)
    col[b] = col[b] * (1 - 0.5 * g[b, None]) + srgb('#ff6a3c') * (0.5 * g[b, None])


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.32, -0.3, -0.03), (0.32, 0.46, 1.0), vox=0.0045)
K.decimate(BODY, 9000)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Diable', rough=0.45))

# =====================================================================================================
# Pièces rigides
# =====================================================================================================
# yeux jaunes, pupilles qui regardent de côté (sournois)
EYES = eyes2(tuple(EYE_L), EYE_R, pupil_dir=(0.32, -1, -0.12), pupil_r=0.42, white='#fff7b8', pupil='#14060c', sparkle=False)

# les crocs : une rangée de petites dents pointues sous la lèvre du haut
no_mouth = [p for p in body if p['tag'] != 'mouth']
teeth = []
tooth_m = K.mat('Dents', '#ffffff', rough=0.2)
ys = np.linspace(-0.3, 0.0, 301)
for i, x in enumerate(np.linspace(-0.066, 0.066, 7)):
    zt = MOUTH_B[0][2] - MOUTH_B[1][2] * math.sqrt(max(0.0, 1 - (x / MOUTH_B[1][0]) ** 2))
    d = K.field(no_mouth, np.full(301, x), ys, np.full(301, zt - 0.006))
    yf = ys[np.argmax(d < 0)]
    ln = 0.026 if abs(i - 3) == 2 else 0.019             # deux crocs plus longs
    teeth.append(K.cone_mesh(f'Dent{i}', (x, yf + 0.011, zt + 0.004), (x, yf + 0.011, zt - ln), 0.0095, 0.001, tooth_m, seg=6, smooth=False))
K.activate(teeth[0])
for o in teeth[1:]:
    o.select_set(True)
bpy.ops.object.join()
TEETH = bpy.context.view_layer.objects.active
TEETH.name = 'Dents'

# la fourche : manche de fer sombre, bague dorée, trois dents d'acier à pointe de flèche
FR = ((WR + HD) / 2) * V(-1, 1, 1)


def F(x, y, z):
    return tuple(FR + V(x, y, z))


fork = [cone('shaft', F(0, 0, -0.29), F(0, 0, 0.42), 0.012, 0.012, k=0.004),
        ell('shaft', F(0, 0, -0.295), (0.016, 0.016, 0.016), k=0.004),
        ell('collar', F(0, 0, 0.428), (0.021, 0.021, 0.02), k=0.004),
        cone('prong', F(-0.062, 0, 0.465), F(0, 0, 0.436), 0.0105, 0.011, k=0.008),
        cone('prong', F(0, 0, 0.436), F(0.062, 0, 0.465), 0.011, 0.0105, k=0.008),
        cone('prong', F(0, 0, 0.436), F(0, 0, 0.565), 0.0095, 0.0072, k=0.006)]
for px in (-0.062, 0.062):
    fork.append(cone('prong', F(px, 0, 0.465), F(px * 1.05, 0, 0.555), 0.0092, 0.0072, k=0.006))
for px, top in ((-0.065, 0.555), (0, 0.565), (0.065, 0.555)):
    fork.append(rbox('tip', F(px, 0, top + 0.016), (0.018, 0.0065, 0.018), r=0.003, k=0.005, R=K.rot(0, 45, 0)))
FCOL = {'default': srgb('#3a3346'), 'shaft': srgb('#3a3346'), 'collar': srgb('#ffcc33'), 'prong': srgb('#cfd8ea'),
        'tip': srgb('#eef3ff')}
FORK = solid2('Fourche', fork, F(-0.11, -0.04, -0.33), F(0.11, 0.04, 0.61), FCOL, 1500, 0.003, 'FourcheMetal', rough=0.3)

# =====================================================================================================
# Squelette
# =====================================================================================================
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 0.4))
K.bone('spine', (0, 0, 0.4), (0, 0, 0.57), 'root', True)
K.bone('head', (0, 0, 0.57), (0, 0, 0.9), 'spine', True)
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    K.bone('thigh' + s, HIP * m, KNEE * m, 'root')
    K.bone('shin' + s, KNEE * m, ANK * m, 'thigh' + s, True)
    K.bone('foot' + s, ANK * m, TOE * m, 'shin' + s, True)
for i in range(5):
    K.bone(f'tail{i + 1}', TAIL[i], TAIL[i + 1], 'root' if i == 0 else f'tail{i}', i > 0)
K.bone('fork', FR, FR + V(0, 0, 0.15), 'handR')
K.rig_end()

TAILB = [f'tail{i}' for i in range(1, 6)]


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'chin', 'nose', 'ear', 'horn', 'brow', 'beard', 'lid', 'mouth'):
        return ['head']
    if tg == 'neck':
        return ['spine', 'head']
    if tg == 'torso':
        if p[2] > 0.47:
            return ['spine'] + (['arm' + s] if abs(p[0]) > 0.1 and p[2] > 0.5 else [])
        if p[2] < 0.33:
            return ['root'] + (['thigh' + s] if abs(p[0]) > 0.04 and p[2] < 0.3 else [])
        return ['root', 'spine']
    if tg == 'belly':
        return ['root', 'spine']
    if tg == 'arm':
        return ['spine', 'arm' + s, 'forearm' + s]
    if tg == 'hand':
        return ['forearm' + s, 'hand' + s]
    if tg == 'leg':
        return ['root', 'thigh' + s, 'shin' + s] if p[2] > 0.27 else ['thigh' + s, 'shin' + s]
    if tg == 'hoof':
        return ['shin' + s, 'foot' + s]
    if tg == 'tail':
        return TAILB + (['root'] if p[1] < 0.14 else [])
    if tg == 'tailtip':
        return ['tail5']
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES + [TEETH]:
    K.attach(o, 'head')
K.attach(FORK, 'fork')

# =====================================================================================================
# Animations
# =====================================================================================================


def tail(fk, t, n, amp=14, lift=0.0, ph=0.0):
    """la queue ondule : une vague qui part de la base vers la pointe"""
    for i in range(1, 6):
        fk[f'tail{i}'] = [('x', lift + 0.45 * amp * wave(t, n, ph + 0.25 - 0.11 * i)), ('z', amp * wave(t, n, ph - 0.11 * i))]


def hop_legs(fk, h, land, tuck=1.0):
    """sautillement : jambes repliées en l'air, genoux qui plient à la réception"""
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -28 * h * tuck - 18 * land)]
        fk['shin' + s] = [('x', 50 * h * tuck + 34 * land)]
        fk['foot' + s] = [('x', 22 * h * tuck - 16 * land)]


def squash(sq):
    return (1 + 0.7 * sq, 1 + 0.7 * sq, 1 - sq)


def idle(t):
    # il sautille sur place en se frottant les mains, l'air de mijoter un mauvais coup
    h = hop(t, 5)
    land = max(0.0, 1 - h / 0.22) ** 2
    sq = 0.08 * land
    fk = {'spine': [('x', 10), ('z', 6 * wave(t, 1))],
          'head': [('x', -8), ('z', 10 * wave(t, 1, 0.2)), ('y', 7 * wave(t, 1, 0.45))]}
    hop_legs(fk, h, land, 0.7)
    tail(fk, t, 2, amp=12)
    r1, r2 = wave(t, 10), wave(t, 10, 0.25)
    steps = [('ik', 'armL', 'forearmL', lambda: follow('spine', (0.058, -0.19 + 0.016 * r1, 0.475 + 0.012 * r2)),
              lambda: rdir('spine', (1, 0.4, -0.7))),
             ('ik', 'armR', 'forearmR', lambda: follow('spine', (-0.058, -0.19 - 0.016 * r1, 0.475 - 0.012 * r2)),
              lambda: rdir('spine', (-1, 0.4, -0.7))),
             ('glob', 'fork', [('x', -26), ('y', -32)])]
    return pose2(fk, scale=squash(sq), steps=steps, ground=0.075 * h)


def walk(t):
    # petits sauts pieds joints, la fourche portée droite, l'autre bras qui balance
    h = hop(t, 2)
    land = max(0.0, 1 - h / 0.22) ** 2
    sq = 0.07 * land
    fk = {'spine': [('x', 12), ('y', 4 * wave(t, 1))], 'head': [('x', -10), ('z', 8 * wave(t, 1))],
          'armL': [('y', -18), ('x', -28 * wave(t, 2, 0.25))], 'forearmL': [('x', -45)],
          'armR': [('y', 12), ('x', -22)], 'forearmR': [('x', -45)]}
    hop_legs(fk, h, land, 1.0)
    tail(fk, t, 2, amp=16)
    steps = [('glob', 'fork', [('x', 8), ('y', -8)])]
    return pose2(fk, scale=squash(sq), steps=steps, ground=0.11 * h)


def run(t):
    # grands bonds en avant, jambes en grand écart, fourche pointée devant comme une lance
    h = hop(t, 2)
    land = max(0.0, 1 - h / 0.2) ** 2
    air = max(0.0, (h - 0.15) / 0.85)
    sq = 0.1 * land
    split = math.sin(K.TAU * t)
    fk = {'root': [('x', 16)], 'spine': [('x', 8)], 'head': [('x', -24), ('z', 5 * wave(t, 2))],
          'armL': [('x', 55 - 35 * split), ('y', -20)], 'forearmL': [('x', -35)]}
    for s, sg in (('L', 1), ('R', -1)):
        fk['thigh' + s] = [('x', -50 * sg * split - 12 * air - 18 * land)]
        fk['shin' + s] = [('x', 15 * air + 34 * land + 45 * max(0.0, -sg * split))]
        fk['foot' + s] = [('x', 20 * air - 16 * land)]
    tail(fk, t, 2, amp=10, lift=-14)
    steps = [('ik', 'armR', 'forearmR', lambda: follow('spine', (-0.17, -0.17, 0.43)), lambda: rdir('spine', (-1, 0.5, -0.4))),
             ('glob', 'fork', [('x', 80)])]
    return pose2(fk, root=(0, -0.02 * land, 0), scale=squash(sq), steps=steps, ground=0.3 * h)


def warn(t):
    # il repère le joueur : s'accroupit, fait tournoyer la fourche (deux tours), ricane la main devant la bouche
    e = sm(t / 0.35)
    sn = wave(t, 4)
    fk = {'spine': [('x', 14 * e), ('y', 5 * sn * e)], 'head': [('x', 10 * e - 4), ('z', -12 * e), ('y', 6 * sn * e)]}
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -22 * e)]
        fk['shin' + s] = [('x', 40 * e)]
        fk['foot' + s] = [('x', -18 * e)]
    tail(fk, t, 2, amp=8, lift=10 * e)
    sq = 0.05 * e
    steps = [('ik', 'armR', 'forearmR', lambda: follow('spine', (-0.26, -0.07, 0.72)), lambda: rdir('spine', (-0.6, 0.3, -1)), e),
             ('glob', 'fork', [('x', 720 * sm(t))]),
             ('ik', 'armL', 'forearmL', lambda: follow('head', (0.05, -0.17, 0.57)), lambda: rdir('spine', (1, 0, -1)), e)]
    return pose2(fk, root=(0, 0, 0.008 * sn * e), scale=squash(sq), steps=steps, ground=0.0)


def hit(t):
    # rire diabolique : plié en deux, une main sur le ventre, appuyé sur la fourche, il tape du sabot
    sh = wave(t, 6)
    st = hop(t, 3)
    fk = {'root': [('x', 10)], 'spine': [('x', 40 + 5 * sh), ('y', 4 * wave(t, 2))], 'head': [('x', -46 + 6 * sh), ('z', 8 * wave(t, 1))],
          'thighL': [('x', -58 * st)], 'shinL': [('x', 78 * st)], 'footL': [('x', -22 * st)],
          'thighR': [('x', -22)], 'shinR': [('x', 26)], 'footR': [('x', -14)]}
    tail(fk, t, 3, amp=22)
    steps = [('ik', 'armL', 'forearmL', lambda: follow('spine', (0.06, -0.16, 0.41 + 0.02 * sh)), lambda: rdir('spine', (1, 0.3, -0.5))),
             ('ik', 'armR', 'forearmR', lambda: follow('root', (-0.25, -0.1, 0.39)), lambda: rdir('root', (-1, 0.5, -0.3))),
             ('glob', 'fork', [('y', -6)])]
    return pose2(fk, root=(0, 0.02, 0), steps=steps, ground=0.006 * hop(t, 6))


def dance(t):
    # gigue endiablée : quatre sauts, une jambe lancée devant à chaque saut, poing sur la hanche, fourche brandie
    h = hop(t, 4)
    land = max(0.0, 1 - h / 0.22) ** 2
    sq = 0.06 * land
    c = math.sin(K.TAU * 2 * t)
    kl, kr = max(0.0, c), max(0.0, -c)
    fk = {'spine': [('z', 14 * wave(t, 2, 0.25)), ('x', 6)], 'head': [('y', 10 * wave(t, 2)), ('x', -8)],
          'thighL': [('x', -60 * kl - 10 * land)], 'shinL': [('x', 15 * kl + 20 * land)], 'footL': [('x', 30 * kl)],
          'thighR': [('x', -60 * kr - 10 * land)], 'shinR': [('x', 15 * kr + 20 * land)], 'footR': [('x', 30 * kr)],
          'armR': [('y', 140 + 15 * h), ('x', -10)], 'forearmR': [('y', 25 * h)]}
    tail(fk, t, 4, amp=20)
    steps = [('ik', 'armL', 'forearmL', lambda: follow('spine', (0.16, -0.01, 0.4)), lambda: rdir('spine', (1, 0.4, 0.3))),
             ('glob', 'fork', [('y', 8 * wave(t, 2))])]
    return pose2(fk, root=(0.025 * c, 0, 0), scale=squash(sq), steps=steps, ground=0.1 * h)


bake2([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)])

preview2([
    ('face', 'Idle', 0, (0.3, -2.8, 0.75), (0, 0, 0.5)),
    ('troisquarts', 'Idle', 7, (1.9, -2.0, 1.3), (0, 0, 0.48)),
    ('visage', 'Idle', 0, (0.2, -1.3, 0.8), (0, 0, 0.68)),
    ('dos', 'Idle', 20, (-1.4, 2.2, 1.1), (0, 0, 0.45)),
    ('dessus', 'Idle', 3, (2.6, -2.6, 3.0), (0, 0, 0.4)),
    ('sauts', 'Walk', 6, (2.2, -1.8, 0.8), (0, 0, 0.5)),
    ('bond', 'Run', 6, (2.6, -0.6, 0.8), (0, 0, 0.6)),
    ('tournoie', 'Warn', 9, (1.2, -2.5, 0.9), (0, 0, 0.5)),
    ('rire', 'Hit', 5, (1.4, -2.4, 0.8), (0, 0, 0.4)),
    ('gigue', 'Dance', 4, (0.8, -2.6, 0.9), (0, 0, 0.5)),
])
K.export()
