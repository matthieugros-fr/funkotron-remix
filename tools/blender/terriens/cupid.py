# Cupidon : bébé joufflu et rose, boucles blondes, couche-culotte, petites ailes de plumes, grand arc doré et flèche
# à pointe en cœur. Il vole tout le temps (le jeu le place à ~1,5 m de haut), tourne autour du joueur puis pique dessus.
#   Blender -b -P tools/blender/terriens/cupid.py -- public/models/terriens/cupid.glb [dossier_aperçus]
# Clips : Idle (vol stationnaire), Walk (vol tranquille), Run (piqué, arc bandé), Warn (bande l'arc et vise),
#         Hit (glousse, mains sur les joues, cœurs), Dance (vrille). Les ailes battent dans tous les clips.
# Pièces nommées : AileG / AileD (ailes, os wingL / wingR), Arc, Corde (peau : os bow + nock), Fleche (os nock),
#   Coeur / Coeur2 / Coeur3 (cœurs du clip Hit, réduits à presque rien dans les autres clips), Cheveux, Boucle.
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
OUT = argv[0] if argv else '/tmp/cupid.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('cupid', OUT, PREVIEW)
# dossier de travail à moi (les volumes .vdb), pour ne pas croiser les autres terriens modelés en même temps
K.S['work'] = os.path.join(os.path.dirname(os.path.abspath(PREVIEW)) if PREVIEW else '/tmp', 'work_cupid')
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
# Proportions (le bas du corps à z ~ 0 ; le jeu le soulève à ~1,5 m)
# =====================================================================================================
HIP_Z = 0.19
HEAD_C = V(0, -0.01, 0.585)
HEAD_R = V(0.172, 0.16, 0.162)
SH = V(0.12, 0.0, 0.375)       # épaule gauche
EL = V(0.17, -0.03, 0.29)      # coude
WR = V(0.19, -0.08, 0.21)      # poignet
HD = V(0.195, -0.115, 0.172)   # bout du poing
HIP = V(0.068, 0.0, 0.17)
KNEE = V(0.085, -0.045, 0.1)
ANK = V(0.085, -0.005, 0.045)
TOE = V(0.085, -0.08, 0.02)
MOUTH_A = ((0, -0.172, 0.5), (0.054, 0.06, 0.042))
MOUTH_B = ((0, -0.172, 0.532), (0.064, 0.08, 0.034))

body = [
    # la couche : culotte bouffante, fond rebondi, entrejambe, bord roulé
    ell('diaper', (0, 0.01, 0.2), (0.15, 0.135, 0.09), k=0.03),
    ell('diaper', (0, 0.055, 0.185), (0.135, 0.1, 0.085), k=0.03),
    ell('diaper', (0, 0.0, 0.14), (0.08, 0.09, 0.05), k=0.03),
    ell('band', (0, 0.0, 0.268), (0.152, 0.137, 0.022), k=0.012),
    # gros ventre, poitrine, cou de bébé
    ell('belly', (0, -0.025, 0.31), (0.14, 0.13, 0.11), k=0.04),
    ell('chest', (0, 0.0, 0.375), (0.125, 0.11, 0.075), k=0.05),
    ell('neck', (0, -0.005, 0.43), (0.075, 0.07, 0.04), k=0.04),
    ell('navel', (0, -0.157, 0.33), (0.01, 0.012, 0.012), k=0.004, op='sub'),
    # la tête : énorme, joues rebondies, menton, nez bouton, oreilles
    ell('head', tuple(HEAD_C), tuple(HEAD_R), k=0.04),
    ell('cheek', (0.088, -0.112, 0.52), (0.066, 0.056, 0.056), k=0.035),
    ell('cheek', (-0.088, -0.112, 0.52), (0.066, 0.056, 0.056), k=0.035),
    ell('head', (0, -0.085, 0.478), (0.09, 0.07, 0.055), k=0.04),
    ell('nose', (0, -0.17, 0.567), (0.024, 0.02, 0.019), k=0.012),
    ell('ear', (0.17, 0.0, 0.57), (0.025, 0.035, 0.045), k=0.02),
    ell('ear', (-0.17, 0.0, 0.57), (0.025, 0.035, 0.045), k=0.02),
    # grand sourire ouvert (croissant)
    crescent('mouth', MOUTH_A, MOUTH_B, k=0.008),
]
for sx in (1, -1):
    m = V(sx, 1, 1)
    body.append(cone('arm', tuple(SH * m), tuple(EL * m), 0.046, 0.039, k=0.025))
    body.append(cone('arm', tuple(EL * m), tuple(WR * m), 0.039, 0.034, k=0.015))
    body.append(ell('hand', tuple(((WR + HD) / 2) * m), (0.038, 0.036, 0.04), k=0.02))
    body.append(cone('leg', tuple(HIP * m), tuple(KNEE * m), 0.058, 0.046, k=0.03))
    body.append(cone('leg', tuple(KNEE * m), tuple(ANK * m), 0.046, 0.033, k=0.02))
    body.append(ell('foot', tuple(((ANK + TOE) / 2 + V(0, 0, -0.004)) * m), (0.036, 0.056, 0.026), k=0.02))

SKIN = srgb('#ffc3ad')
COL = {'default': SKIN, 'head': SKIN, 'cheek': SKIN, 'neck': SKIN, 'chest': SKIN, 'belly': SKIN, 'arm': SKIN, 'hand': srgb('#ffbca6'),
       'leg': SKIN, 'foot': srgb('#ffb8a2'), 'nose': srgb('#ffad98'), 'ear': srgb('#ffb3a0'),
       'diaper': srgb('#f8f9ff'), 'band': srgb('#ffffff')}
A_ELL, B_ELL = ell('a', *MOUTH_A), ell('b', *MOUTH_B)


def extra(co, nor, col, tag):
    # joues bien rouges (fard rond sur le devant des joues)
    for sx in (1, -1):
        d = np.linalg.norm(co - V(0.108 * sx, -0.158, 0.52), axis=1)
        f = np.clip(1 - d / 0.052, 0, 1) ** 0.6
        f[~np.isin(tag, ('cheek', 'head'))] = 0
        col[:] = col * (1 - 0.8 * f[:, None]) + srgb('#ff4f72') * (0.8 * f[:, None])
    # la bouche : l'intérieur rouge sombre, la langue rose en bas
    dc = np.maximum(_sd0(A_ELL, co[:, 0], co[:, 1], co[:, 2]), -_sd0(B_ELL, co[:, 0], co[:, 1], co[:, 2]))
    inside = dc < 0.004
    col[inside] = srgb('#80142c')
    col[inside & (co[:, 2] < 0.473) & (np.abs(co[:, 0]) < 0.035)] = srgb('#ff6f8c')
    # nombril, genoux à peine rosés
    nav = np.linalg.norm(co - V(0, -0.16, 0.33), axis=1) < 0.016
    col[nav] = srgb('#e88f7d')
    # la couche : une ombre bleutée sous le bord roulé
    fold = (tag == 'diaper') & (co[:, 2] > 0.235)
    col[fold] = srgb('#e4e8fa')


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.32, -0.3, -0.04), (0.32, 0.28, 0.79), vox=0.0045)
K.decimate(BODY, 7900)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Cupidon', rough=0.5))

# =====================================================================================================
# Pièces rigides
# =====================================================================================================
# --- les boucles blondes (un casque de bouclettes posé sur le crâne) ---
rng = np.random.default_rng(7)
CURLS = []


def fib(n):
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    th = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], 1)


for v in fib(120):
    v = v + rng.normal(0, 0.05, 3)
    v /= np.linalg.norm(v)
    x, y, z = v
    keep = (z > 0.3) | ((y > 0.15) & (z > -0.5)) | ((abs(x) > 0.6) & (z > 0.05) & (y > -0.3))
    if (y < -0.45 and z < 0.66) or (abs(x) > 0.82 and z < 0.32) or z < -0.55:
        keep = False
    if keep:
        r = 0.036 + 0.016 * rng.random()
        if y < -0.3:
            r *= 0.85                                     # petites bouclettes sur le front
        CURLS.append((HEAD_C + v * HEAD_R * (0.9 + 0.04 * rng.random()), r))
hair_prims = [ell('curl', tuple(c), (r, r, r * 0.92), k=0.014) for c, r in CURLS]
CC = np.array([c for c, r in CURLS])
CR = np.array([r for c, r in CURLS])


def hair_extra(co, nor, col, tag):
    # les creux entre les bouclettes un peu plus foncés, le dessus plus clair
    d = np.linalg.norm(co[:, None, :] - CC[None, :, :], axis=2) / CR[None, :]
    d.sort(axis=1)
    f = np.clip((d[:, 1] - d[:, 0]) / 0.25, 0, 1)[:, None]
    light = srgb('#ffe27a') * (0.9 + 0.1 * np.clip(nor[:, 2:3], 0, 1))
    col[:] = srgb('#f0b43a') * (1 - f) + light * f


HAIR = solid2('Cheveux', hair_prims, (-0.24, -0.22, 0.4), (0.24, 0.24, 0.81), {'default': srgb('#ffd84a')}, 1500, 0.0045,
              'Cheveux', rough=0.6, extra=hair_extra)
# l'accroche-cœur : une petite mèche enroulée à plat sur le front
spiral = []
for i in range(18):
    f = i / 17
    a = math.pi * (0.5 + 2.6 * f)
    rr = 0.028 * (1 - 0.75 * f)
    spiral.append((0.03 + rr * math.cos(a), -0.147 - 0.006 * f, 0.69 + rr * math.sin(a)))
CURL = tube('Boucle', spiral, [0.0085 - 0.004 * i / 17 for i in range(18)], K.mat('Boucle', '#ffd84a', rough=0.5), seg=6)

# --- les yeux : grands, ronds, brillants, le regard un peu en l'air (béat) ---
EYES = eyes2((0.066, -0.133, 0.607), 0.046, sc=(1, 1, 1.18), pupil_dir=(0, -1, 0.14), pupil_r=0.56)

# --- les ailes : rémiges en éventail sous un bord de petites plumes rondes ---
WING_R0 = V(0.05, 0.1, 0.41)
WO = V(1, 0.42, 0.42)
WO /= np.linalg.norm(WO)
WUP = V(0, 0, 1) - WO * WO[2]
WUP /= np.linalg.norm(WUP)
WN = np.cross(WO, WUP)
WSPAN = 0.27


def wedge(s):
    return WING_R0 + WO * WSPAN * s + WUP * (0.11 * math.sin(math.pi * min(s, 1) * 0.8))


def wing_prims(sx):
    M = np.diag([sx, 1, 1])
    out = [ell('covert', tuple(M @ (WING_R0 + WO * 0.02)), (0.045, 0.032, 0.055), k=0.02)]
    # grandes plumes (rémiges) en éventail, de plus en plus longues et couchées vers le bout
    for i in range(8):
        f = i / 7
        b = wedge(0.1 + 0.9 * f)
        ang = math.radians(2 + 58 * f)
        d = -WUP * math.cos(ang) + WO * math.sin(ang)
        L = 0.12 + 0.09 * f ** 0.8
        R = np.stack([d, WN, np.cross(d, WN)], 1)
        out.append(ell('feather', tuple(M @ (b + d * (L * 0.5 - 0.014))), (L / 2, 0.013, 0.036), k=0.006, R=M @ R))
    # rangée de plumes moyennes, arrondies, par-dessus (côté dos) : un aspect duveteux
    for i in range(6):
        f = i / 5
        b = wedge(0.08 + 0.8 * f)
        ang = math.radians(4 + 50 * f)
        d = -WUP * math.cos(ang) + WO * math.sin(ang)
        L = 0.07 + 0.03 * f
        R = np.stack([d, WN, np.cross(d, WN)], 1)
        out.append(ell('covert2', tuple(M @ (b + d * (L * 0.5 - 0.01) + WN * 0.008)), (L / 2, 0.014, 0.038), k=0.008, R=M @ R))
    # bord d'attaque : petites plumes rondes
    for s in np.linspace(0.0, 1.0, 8):
        R = np.stack([WO, WN, WUP], 1)
        out.append(ell('covert', tuple(M @ (wedge(s) - WUP * 0.02)), (0.05, 0.02, 0.04), k=0.014, R=M @ R))
    return out


def wing_extra(sx):
    def f(co, nor, col, tag):
        r0 = WING_R0 * V(sx, 1, 1)
        t = np.clip((np.linalg.norm(co - r0, axis=1) - 0.2) / 0.14, 0, 1)
        t[tag != 'feather'] = 0
        col[:] = col * (1 - t[:, None]) + srgb('#d6e0ff') * t[:, None]
    return f


WCOL = {'default': srgb('#ffffff'), 'covert': srgb('#ffffff'), 'covert2': srgb('#fbfbff'), 'feather': srgb('#f4f6ff')}
WINGS = []
for sx, n in ((1, 'AileG'), (-1, 'AileD')):
    lo = (min(0.0, sx * 0.56), -0.04, 0.14)
    hi = (max(0.0, sx * 0.56), 0.46, 0.7)
    WINGS.append(solid2(n, wing_prims(sx), lo, hi, WCOL, 1000, 0.004, 'Plumes', rough=0.6, extra=wing_extra(sx)))

# --- l'arc doré (en forme de « bouche de Cupidon » : deux arcs en avant, pointes recourbées vers lui) ---
G = (WR + HD) / 2              # le poing gauche tient la poignée
BOW_H, BOW_A, BOW_B = 0.19, 0.05, 0.07
NOCK0 = G + V(0, BOW_B, 0)
ss = np.linspace(-1, 1, 25)
bow_pts = [G + V(0, -BOW_A * math.sin(math.pi * abs(s)) + BOW_B * abs(s) ** 3, BOW_H * s) for s in ss]
gold = K.mat('Or', '#ffc436', rough=0.25, metal=0.6)
BOW = [tube('Arc', bow_pts, [0.011 + 0.008 * (1 - abs(s)) for s in ss], gold, seg=6)]
for sz in (1, -1):
    BOW.append(K.sphere('ArcBout' + ('H' if sz > 0 else 'B'), tuple(G + V(0, BOW_B + 0.004, sz * (BOW_H + 0.008))), 0.017, gold, seg=8))
BOW.append(tube('ArcPoignee', [G + V(0, 0, -0.045), G + V(0, 0, 0.045)], 0.017, K.mat('Poignee', '#e0284f', rough=0.5), seg=10))
# la corde : peau sur l'arc (bouts) et l'encoche (milieu), pour se tendre quand il bande l'arc
str_pts = [G + V(0, BOW_B, BOW_H * s) for s in np.linspace(-1, 1, 17)]
STRING = tube('Corde', str_pts, 0.0032, K.mat('Corde', '#fff4e0', rough=0.6), seg=5)

# --- la flèche : hampe dorée, empennage rose, pointe en cœur (posée à plat) ---
M_ARROW = np.stack([V(1, 0, 0), V(0, 0, -1), V(0, 1, 0)], 1)   # cœur à plat : lobes vers l'encoche, pointe vers -Y
arrow = [cone('shaft', tuple(NOCK0 + V(0, 0.004, 0)), tuple(NOCK0 + V(0, -0.3, 0)), 0.0078, 0.0078, k=0.004),
         ell('nockb', tuple(NOCK0 + V(0, 0.006, 0)), (0.01, 0.011, 0.01), k=0.004)]
for a in (90, 210, 330):
    rr = V(math.cos(math.radians(a)), 0, math.sin(math.radians(a)))
    R = np.stack([V(0, 1, 0), rr, np.cross(V(0, 1, 0), rr)], 1)
    arrow.append(ell('vane', tuple(NOCK0 + V(0, -0.045, 0) + rr * 0.016), (0.042, 0.016, 0.0035), k=0.004, R=R))
arrow += heart_prims('heart', NOCK0 + V(0, -0.322, 0), 0.037, M_ARROW)
ACOL = {'default': srgb('#f7d774'), 'shaft': srgb('#f7d774'), 'nockb': srgb('#ff5a8a'), 'vane': srgb('#ff9cc4'),
        'heart': srgb('#ff2457')}
ARROW = solid2('Fleche', arrow, tuple(NOCK0 + V(-0.07, -0.4, -0.05)), tuple(NOCK0 + V(0.07, 0.03, 0.05)), ACOL, 500, 0.0025,
               'Fleche', rough=0.35)

# --- les cœurs du fou rire (au-dessus de la tête) ---
COEUR_POS = [V(0, -0.03, 0.9), V(0.17, -0.05, 0.78), V(-0.17, -0.05, 0.8)]
HEARTS = []
for i, (pos, s) in enumerate(zip(COEUR_POS, (0.058, 0.036, 0.036))):
    nm = 'Coeur' if i == 0 else f'Coeur{i + 1}'
    HEARTS.append(solid2(nm, heart_prims('h', pos, s), tuple(pos - 0.08), tuple(pos + 0.08), {'default': srgb('#ff2457')},
                         240 if i == 0 else 150, 0.003, 'Coeur', rough=0.3))

# --- l'épingle à nourrice rose de la couche ---
pin_m = K.mat('Epingle', '#ff6fae', rough=0.3)
PIN = [K.torus('Epingle', (0.098, -0.118, 0.262), 0.016, 0.0038, pin_m, rot_deg=(80, 0, 20), seg=10),
       K.sphere('EpingleTete', (0.112, -0.122, 0.276), 0.008, pin_m, seg=8)]

# =====================================================================================================
# Squelette
# =====================================================================================================
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 0.27))
K.bone('spine', (0, 0, 0.27), (0, 0, 0.42), 'root', True)
K.bone('head', (0, 0, 0.42), (0, 0, 0.76), 'spine', True)
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('arm' + s, SH * m, EL * m, 'spine')
    K.bone('forearm' + s, EL * m, WR * m, 'arm' + s, True)
    K.bone('hand' + s, WR * m, HD * m, 'forearm' + s, True)
    K.bone('thigh' + s, HIP * m, KNEE * m, 'root')
    K.bone('shin' + s, KNEE * m, ANK * m, 'thigh' + s, True)
    K.bone('foot' + s, ANK * m, TOE * m, 'shin' + s, True)
    K.bone('wing' + s, WING_R0 * m, (WING_R0 + WO * 0.25) * m, 'spine')
K.bone('bow', G, G + V(0, 0, 0.12), 'handL')
K.bone('nock', NOCK0, NOCK0 + V(0, 0.06, 0), 'bow')
for i, pos in enumerate(COEUR_POS):
    K.bone('coeur' if i == 0 else f'coeur{i + 1}', pos, pos + V(0, 0, 0.06), 'root')
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'cheek', 'nose', 'ear', 'mouth'):
        return ['head']
    if tg == 'neck':
        return ['spine', 'head']
    if tg == 'chest':
        return ['spine'] + (['arm' + s] if abs(p[0]) > 0.085 and p[2] > 0.34 else [])
    if tg == 'belly':
        return ['root', 'spine']
    if tg in ('diaper', 'band'):
        return ['root'] + (['thigh' + s] if p[2] < 0.15 and abs(p[0]) > 0.03 else [])
    if tg == 'arm':
        return ['spine', 'arm' + s, 'forearm' + s]
    if tg == 'hand':
        return ['forearm' + s, 'hand' + s]
    if tg == 'leg':
        return ['root', 'thigh' + s, 'shin' + s] if p[2] > 0.15 else ['thigh' + s, 'shin' + s]
    if tg == 'foot':
        return ['shin' + s, 'foot' + s]
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES + [HAIR, CURL]:
    K.attach(o, 'head')
K.attach(WINGS[0], 'wingL')
K.attach(WINGS[1], 'wingR')
for o in BOW:
    K.attach(o, 'bow')
K.attach(ARROW, 'nock')
for o, b in zip(HEARTS, ('coeur', 'coeur2', 'coeur3')):
    K.attach(o, b)
for o in PIN:
    K.attach(o, 'root')
# la corde : les bouts suivent l'arc, le milieu suit l'encoche
sv = np.array([v.co[2] for v in STRING.data.vertices])
wn = np.clip(1 - np.abs(sv - G[2]) / BOW_H, 0, 1)
W = np.zeros((len(sv), len(K.S['BNAMES'])))
W[:, K.S['BNAMES'].index('nock')] = wn
W[:, K.S['BNAMES'].index('bow')] = 1 - wn
K._assign(STRING, W)

# =====================================================================================================
# Animations
# =====================================================================================================
HIDE = 0.001
PULL = 0.06
KEYED = ('nock', 'coeur', 'coeur2', 'coeur3')


def hearts_off():
    return {'coeur': HIDE, 'coeur2': HIDE, 'coeur3': HIDE}


def wings(fk, t, n, amp=36, bias=0.0, sweep=0.0):
    """battements : n par boucle ; f = 1 ailes en haut"""
    f = wave(t, n)
    sw = sweep + 8 * wave(t, n, 0.25)
    fk['wingL'] = [('z', sw), ('y', -(amp * f + bias))]
    fk['wingR'] = [('z', -sw), ('y', amp * f + bias)]


def kick(fk, t, n, amp=25, bend=30, base=8, point=25):
    """jambes de bébé qui gigotent (en opposition)"""
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = wave(t, n, o)
        fk['thigh' + s] = [('x', base - amp * w)]
        fk['shin' + s] = [('x', bend + 0.7 * amp * w)]
        fk['foot' + s] = [('x', point + 10 * w)]


def draw_steps(pitch, w=1.0, idle_bow=None, fk_spine=0):
    """bander l'arc : bras gauche tendu devant, arc droit dans l'axe de visée, main droite sur l'encoche"""
    steps = [('ik', 'armL', 'forearmL', lambda: follow('root', (0.07, -0.19, 0.43)), lambda: rdir('root', (1, 0.2, -1)), w)]
    if idle_bow:
        steps.append(('glob', 'bow', idle_bow, 1.0))
    steps.append(('glob', 'bow', [('x', pitch)], w))

    def rwrist():
        N = gmat('nock').translation
        return N + rdir('nock', (0, 1, 0)) * 0.03 + rdir('root', (-1, 0, 0)) * 0.012 + rdir('root', (0, 0, -1)) * 0.006
    steps.append(('ik', 'armR', 'forearmR', rwrist, lambda: rdir('root', (-1, 0.8, -0.3)), w))
    return steps


IDLE_BOW = [('y', 10)]


def idle(t):
    # vol stationnaire : il flotte, les ailes battent vite, les jambes gigotent, petit coucou de la main droite
    fk = {'root': [('x', 5)], 'spine': [('y', 4 * wave(t, 1))],
          'head': [('y', 9 * wave(t, 1, 0.25)), ('x', -6 + 3 * wave(t, 2))],
          'armL': [('y', -40), ('x', -20)], 'forearmL': [('x', -30)],
          'armR': [('y', 55 + 8 * wave(t, 2)), ('x', -25)], 'forearmR': [('y', 50 + 25 * wave(t, 4))]}
    wings(fk, t, 8)
    kick(fk, t, 4)
    steps = [('glob', 'bow', IDLE_BOW + [('z', 6 * wave(t, 1))])]
    return pose2(fk, root=(0, 0, 0.035 * wave(t, 2)), scl=hearts_off(), steps=steps)


def walk(t):
    # vol tranquille : penché en avant, jambes qui traînent derrière en pédalant doucement
    fk = {'root': [('x', 20)], 'spine': [('y', 3 * wave(t, 1))], 'head': [('x', -16), ('z', 6 * wave(t, 1))],
          'armL': [('y', -35), ('x', -30)], 'forearmL': [('x', -25)],
          'armR': [('y', 30), ('x', 18 * wave(t, 1))], 'forearmR': [('x', -40)]}
    wings(fk, t, 3, amp=34)
    kick(fk, t, 1, amp=14, base=28, bend=35)
    steps = [('glob', 'bow', [('x', 12), ('y', 8)])]
    return pose2(fk, root=(0, 0, 0.028 * wave(t, 3, 0.25)), scl=hearts_off(), steps=steps)


def run(t):
    # piqué : plongé en avant, arc bandé dans l'axe, ailes rabattues en arrière qui battent très vite
    P = 36
    fk = {'root': [('x', P)], 'spine': [('z', -28), ('x', -4)], 'head': [('z', 28), ('x', -30), ('y', 3 * wave(t, 2))]}
    wings(fk, t, 4, amp=26, bias=-6, sweep=26)
    for s, o in (('L', 0.0), ('R', 0.5)):
        fk['thigh' + s] = [('x', 30 + 8 * wave(t, 4, o))]
        fk['shin' + s] = [('x', 20 + 10 * wave(t, 4, o))]
        fk['foot' + s] = [('x', 45)]
    return pose2(fk, root=(0, 0, 0.02 * wave(t, 4)), loc={'nock': (0, PULL + 0.004 * wave(t, 8), 0)}, scl=hearts_off(),
                 steps=draw_steps(P - 4))


def warn(t):
    # il repère sa cible : se redresse, bande l'arc et vise (une seule fois)
    e = sm(t / 0.7)
    fk = {'root': [('x', 5 - 3 * e)], 'spine': [('y', 4 * (1 - e)), ('z', -28 * e)],
          'head': [('z', 28 * e), ('x', -6 + 2 * e)],
          'armL': [('y', -40), ('x', -20)], 'forearmL': [('x', -30)],
          'armR': [('y', 55), ('x', -25)], 'forearmR': [('y', 50)]}
    wings(fk, t, 2, amp=36)
    kick(fk, t, 2, amp=18 * (1 - e) + 6, base=8 + 12 * e)
    trem = 0.003 * wave(t, 6) * e
    return pose2(fk, root=(0, 0, 0.02 * e), loc={'nock': (0, PULL * e + trem, 0)}, scl=hearts_off(),
                 steps=draw_steps(0, e, IDLE_BOW))


def hit(t):
    # il glousse : mains sur les joues, épaules secouées, jambes qui battent, cœurs qui montent au-dessus de la tête
    sh = wave(t, 5)
    fk = {'root': [('x', -6 + 3 * sh)], 'spine': [('y', 6 * wave(t, 2)), ('x', 4 * sh)],
          'head': [('y', 14 * wave(t, 1)), ('x', -8 + 5 * sh)]}
    wings(fk, t, 4, amp=40)
    kick(fk, t, 3, amp=30, bend=40)
    steps = [('ik', 'armL', 'forearmL', lambda: follow('head', (0.15, -0.115, 0.452)), lambda: rdir('spine', (1, 0.2, -1))),
             ('ik', 'armR', 'forearmR', lambda: follow('head', (-0.15, -0.115, 0.452)), lambda: rdir('spine', (-1, 0.2, -1))),
             ('glob', 'bow', [('y', 18), ('x', -10)])]
    loc, scl = {}, {}
    pulse = hop(t, 3)
    loc['coeur'] = (0, 0, 0.025 * wave(t, 1))
    scl['coeur'] = 0.85 + 0.3 * pulse
    for bn, ph, sx in (('coeur2', 0.0, 1), ('coeur3', 0.5, -1)):
        q = (t + ph) % 1
        loc[bn] = (sx * 0.03 * math.sin(K.TAU * q * 1.5), 0, 0.17 * q)
        scl[bn] = max(HIDE, math.sin(math.pi * q) * 1.1)
    return pose2(fk, root=(0, 0, 0.03 * hop(t, 5)), loc=loc, scl=scl, steps=steps)


def dance(t):
    # vrille joyeuse : un tour complet sur lui-même, bras en l'air, penché, jambes jointes qui battent la mesure
    b = hop(t, 2)
    fk = {'root': [('y', 14), ('z', 360 * t)], 'spine': [('x', -6)], 'head': [('x', -14), ('y', 8 * wave(t, 2))],
          'armL': [('y', -125 - 15 * b), ('x', -10)], 'forearmL': [('y', -25)],
          'armR': [('y', 125 + 15 * b), ('x', -10)], 'forearmR': [('y', 25)]}
    wings(fk, t, 4, amp=40)
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', 12 + 22 * b)]
        fk['shin' + s] = [('x', 15 + 35 * b)]
        fk['foot' + s] = [('x', 40)]
    steps = [('glob', 'bow', [('y', 20), ('z', 360 * t)])]
    return pose2(fk, root=(0, 0, 0.06 * b), scl=hearts_off(), steps=steps)


bake2([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, hit), ('Dance', 32, dance)],
      keyed=KEYED)

GZ = -1.3   # sol des aperçus : il vole
preview2([
    ('face', 'Idle', 0, (0.25, -2.6, 0.62), (0, 0, 0.4)),
    ('troisquarts', 'Idle', 10, (1.9, -1.9, 1.15), (0, 0, 0.38)),
    ('visage', 'Idle', 0, (0.15, -1.15, 0.64), (0, 0, 0.55)),
    ('dos', 'Idle', 15, (-1.3, 2.1, 1.1), (0, 0, 0.42)),
    ('dessus', 'Idle', 7, (2.6, -2.6, 3.0), (0, 0, 0.3)),
    ('vol', 'Walk', 6, (2.2, -1.6, 0.8), (0, 0, 0.35)),
    ('pique', 'Run', 6, (2.5, -0.8, 0.6), (0, -0.1, 0.32)),
    ('vise', 'Warn', 16, (1.3, -2.2, 0.7), (0, -0.05, 0.42)),
    ('glousse', 'Hit', 8, (0.5, -2.3, 0.8), (0, 0, 0.5)),
    ('vrille', 'Dance', 8, (0.9, -2.4, 0.9), (0, 0, 0.42)),
], ground_z=GZ)
K.export()
