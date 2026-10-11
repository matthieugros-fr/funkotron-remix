# Outils communs aux terriens qui poussent un engin (mower.py : la tondeuse, cart.py : le caddie).
# Complète kit.py sans le modifier :
#   - fk_eval(st) : cinématique directe (où sont les os pour une pose donnée), pour placer les mains ;
#   - ik_arm(st, 'L', cible, pôle) : bras à deux os posé sur une cible (poignet sur le guidon) ;
#   - point(M, os, p) : où se trouve un point du modèle de repos accroché à un os, dans la pose ;
#   - bake(clips, movable) : comme K.bake, mais tout os peut aussi être déplacé ('loc'), mis à l'échelle ('scl')
#     ou recevoir une matrice monde complète ('mat', os sans parent) ; fk accepte aussi un Quaternion local.
#   - private_work(nom) : dossier de travail privé pour les volumes .vdb (plusieurs Blender tournent en même temps).
import math
import os
import shutil
import tempfile
import bpy
from mathutils import Vector, Quaternion, Matrix
import kit as K

Y = Vector((0, 1, 0))


def private_work(name):
    K.S['work'] = tempfile.mkdtemp(prefix=f'terrien_{name}_')
    return K.S['work']


def cleanup():
    w = K.S.get('work', '')
    if w and os.path.basename(w).startswith('terrien_') and w != K.S.get('preview'):
        shutil.rmtree(w, ignore_errors=True)


def pose(fk=None, root=(0, 0, 0), scale=None, loc=None, scl=None, mat=None):
    return dict(fk=fk or {}, root=root, scale=scale, root_bone='root', loc=loc or {}, scl=scl or {}, mat=mat or {})


def _info():
    if 'PARENT' not in K.S:
        ad = K.S['arm_data']
        K.S['PARENT'] = {b.name: (b.parent.name if b.parent else None) for b in ad.bones}
        order, seen = [], set()

        def visit(n):
            if n in seen:
                return
            p = K.S['PARENT'][n]
            if p:
                visit(p)
            seen.add(n)
            order.append(n)
        for b in ad.bones:
            visit(b.name)
        K.S['ORDER'] = order
    return K.S['PARENT'], K.S['ORDER']


def _q(b, rots):
    if rots is None:
        return Quaternion()
    if isinstance(rots, Quaternion):
        return rots
    return K.q_world(b, rots)


def basis(st, b):
    """matrice locale (matrix_basis) de l'os b pour l'état st, comme bake() la pose"""
    REST = K.S['REST']
    if b in st['mat']:
        return REST[b].inverted() @ st['mat'][b]
    q = _q(b, st['fk'].get(b))
    r3i = REST[b].to_3x3().inverted()
    loc = Vector()
    sc = Vector((1, 1, 1))
    if b == st['root_bone']:
        loc = r3i @ Vector(st['root'])
        if st['scale']:
            s = r3i @ Vector(st['scale'])
            sc = Vector((abs(s[0]), abs(s[1]), abs(s[2])))
    else:
        if b in st['loc']:
            loc = r3i @ Vector(st['loc'][b])
        if b in st['scl']:
            s = st['scl'][b]
            sc = Vector((s, s, s)) if isinstance(s, (int, float)) else Vector(s)
    return Matrix.Translation(loc) @ q.to_matrix().to_4x4() @ Matrix.Diagonal(Vector((sc[0], sc[1], sc[2], 1.0)))


def fk_eval(st):
    PARENT, ORDER = _info()
    REST = K.S['REST']
    M = {}
    for b in ORDER:
        B = basis(st, b)
        p = PARENT[b]
        M[b] = (M[p] @ REST[p].inverted() @ REST[b] @ B) if p else (REST[b] @ B)
    return M


def point(M, b, p):
    """position dans la pose d'un point p (repère de repos) accroché à l'os b"""
    return (M[b] @ K.S['REST'][b].inverted() @ Vector(tuple(p)).to_4d()).to_3d()


def direction(M, b, d):
    return (M[b].to_3x3() @ K.S['REST'][b].to_3x3().inverted() @ Vector(tuple(d))).normalized()


def _frame(y, n):
    y = y.normalized()
    n = (n - y * n.dot(y)).normalized()
    return Matrix((y, n, y.cross(n))).transposed()     # colonnes : y, n, y×n


def ik_arm(st, s, target, pole, hand=None, iters=3):
    """pose arm/forearm (et hand si 'hand' = direction monde des doigts) pour amener le poignet sur target.
    pole : point monde vers lequel le coude se plie. Écrit des Quaternions dans st['fk']."""
    PARENT, _ = _info()
    REST, BSEG = K.S['REST'], K.S['BSEG']
    a, f, h = 'arm' + s, 'forearm' + s, 'hand' + s
    L1 = (Vector(BSEG[a][1]) - Vector(BSEG[a][0])).length
    L2 = (Vector(BSEG[f][1]) - Vector(BSEG[f][0])).length
    # plan de flexion au repos (dans le repère local de l'os du bras)
    sh0, el0, wr0 = Vector(BSEG[a][0]), Vector(BSEG[a][1]), Vector(BSEG[f][1])
    n_rest = (el0 - sh0).cross(wr0 - el0)
    if n_rest.length < 1e-6:
        n_rest = Vector((1, 0, 0))
    n0 = REST[a].to_3x3().inverted() @ n_rest.normalized()
    B0 = _frame(Vector((0, 1, 0)), n0)
    T = Vector(tuple(target))
    goal = T.copy()
    pa = PARENT[a]
    for _ in range(iters):
        st['fk'].pop(a, None)
        st['fk'].pop(f, None)
        M = fk_eval(st)
        P = M[pa] @ REST[pa].inverted() @ REST[a]
        S = P.translation.copy()
        sc = P.to_3x3().col[1].length          # échelle héritée (écrasement de la racine)
        l1, l2 = L1 * sc, L2 * sc
        D = goal - S
        d = max(abs(l1 - l2) + 1e-3, min(D.length, l1 + l2 - 0.004))
        u = D.normalized()
        v = Vector(tuple(pole)) - S
        v = (v - u * v.dot(u))
        if v.length < 1e-6:
            v = Vector((0, 0, -1)) - u * (-u.z)
        v.normalize()
        x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
        y = math.sqrt(max(l1 * l1 - x * x, 0.0))
        E = S + u * x + v * y
        W = S + u * d
        Pi = P.to_3x3().inverted()
        n_w = (E - S).cross(W - E)
        B1 = _frame((Pi @ (E - S)).normalized(), (Pi @ n_w).normalized())
        qa = (B1 @ B0.transposed()).to_quaternion()
        st['fk'][a] = qa
        Ma = P @ qa.to_matrix().to_4x4()
        Pf = Ma @ REST[a].inverted() @ REST[f]
        dl = (Pf.to_3x3().inverted() @ (W - Pf.translation)).normalized()
        st['fk'][f] = Y.rotation_difference(dl)
        # correction : ce que donne vraiment la chaîne (échelles héritées)
        M = fk_eval(st)
        got = Vector(M[f].col[3][:3]) + M[f].to_3x3() @ Vector((0, (Vector(BSEG[f][1]) - Vector(BSEG[f][0])).length, 0))
        err = T - got
        if err.length < 1e-4:
            break
        goal = goal + err
    if hand is not None:
        M = fk_eval(st)
        Ph = M[f] @ REST[f].inverted() @ REST[h]
        dl = (Ph.to_3x3().inverted() @ Vector(tuple(hand))).normalized()
        st['fk'][h] = Y.rotation_difference(dl)
    return st


def aim(st, b, d_world, M=None):
    """oriente l'os b (son axe) vers la direction monde d_world, quelle que soit la pose de son parent"""
    PARENT, _ = _info()
    REST = K.S['REST']
    M = M or fk_eval(st)
    p = PARENT[b]
    P = (M[p] @ REST[p].inverted() @ REST[b]) if p else REST[b]
    dl = (P.to_3x3().inverted() @ Vector(tuple(d_world))).normalized()
    st['fk'][b] = Y.rotation_difference(dl)
    return st


def lerp(a, b, w):
    return Vector(tuple(a)).lerp(Vector(tuple(b)), w)


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def seg(t, a, b):
    """0 avant a, 1 après b, lissé entre les deux"""
    return smooth((t - a) / (b - a)) if b > a else float(t >= a)


def path(t, keys):
    """keys : [(t, point)] → point interpolé (lissé) sur le trajet"""
    if t <= keys[0][0]:
        return Vector(tuple(keys[0][1]))
    for (t0, p0), (t1, p1) in zip(keys, keys[1:]):
        if t <= t1:
            return lerp(p0, p1, smooth((t - t0) / max(t1 - t0, 1e-9)))
    return Vector(tuple(keys[-1][1]))


def bake(clips, movable=()):
    """clips : [(nom, images, fn)] ; fn(t) → engin.pose(...). Les os de 'movable' ont aussi leurs clés de position
    et d'échelle dans TOUS les clips (sinon un clip laisserait l'os là où le précédent l'avait mis)."""
    arm, pb, REST = K.S['arm'], K.S['arm'].pose.bones, K.S['REST']
    _info()
    keyloc = set(movable) | {'root'}
    arm.animation_data_create()
    worst, wname = 0.0, ''
    for name, frames, fn in clips:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        for fr in range(frames + 1):
            st = fn(fr / frames)
            for b in pb:
                b.matrix_basis = basis(st, b.name)
            for b in pb:
                b.keyframe_insert('rotation_quaternion', frame=fr)
                if b.name in keyloc:
                    b.keyframe_insert('location', frame=fr)
                    b.keyframe_insert('scale', frame=fr)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
    arm.animation_data.action = None
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    # contrôle (après coup : une mise à jour pendant la cuisson réévaluerait l'action et fausserait les clés) :
    # la pose lue par Blender colle à celle que calcule fk_eval
    scene = K.S['scene']
    for name, frames, fn in clips:
        for tr in arm.animation_data.nla_tracks:
            tr.mute = tr.name != name
        for fr in (frames // 3, frames // 2):
            scene.frame_set(fr)
            M = fk_eval(fn(fr / frames))
            for b in pb:
                e = max((b.matrix.translation - M[b.name].translation).length,
                        (b.matrix.to_3x3() @ Y - M[b.name].to_3x3() @ Y).length)
                if e > worst:
                    worst, wname = e, f'{name}:{fr}:{b.name}'
    for tr in arm.animation_data.nla_tracks:
        tr.mute = False
    scene.frame_set(0)
    K.log('animations', [c[0] for c in clips], f'écart FK/Blender max {worst:.5f}', wname if worst > 1e-4 else '')


def tris(objs=None):
    objs = objs or [o for o in bpy.data.objects if o.type == 'MESH']
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


def low_sphere(name, c, r, m, scale=(1, 1, 1), seg=14):
    return K.sphere(name, c, r, m, scale=scale, seg=seg)


def eyes(c_left, r, pupil_dir=(0, -1, 0), pupil_r=0.42, seg=16, names=('OeilG', 'OeilD'), white='#ffffff', pupil='#1a1033'):
    """comme K.eyes, en moins de triangles"""
    out = []
    w, p = K.mat('Blanc', white, rough=0.15), K.mat('Pupille', pupil, rough=0.2)
    d = Vector(pupil_dir).normalized()
    for sx, n in zip((1, -1), names):
        c = Vector((c_left[0] * sx, c_left[1], c_left[2]))
        out.append(K.sphere(n, tuple(c), r, w, seg=seg))
        pc = c + d * r * 0.93
        o = K.sphere(n + 'P', tuple(pc), r * pupil_r, p, scale=(1, 1, 1), seg=12)
        # pupille aplatie le long du regard (K.sphere a appliqué la position : sommets en coordonnées monde)
        q = Vector((0, -1, 0)).rotation_difference(d).to_matrix().to_4x4()
        o.data.transform(Matrix.Translation(pc) @ q @ Matrix.Diagonal(Vector((1, 0.5, 1, 1))) @ q.inverted() @ Matrix.Translation(-pc))
        out.append(o)
    return out


def tris_report(n=12):
    obs = sorted(((sum(len(p.vertices) - 2 for p in o.data.polygons), o.name) for o in bpy.data.objects if o.type == 'MESH'), reverse=True)
    K.log('triangles par pièce', ', '.join(f'{nm} {t}' for t, nm in obs[:n]))


def set_world_rot(st, b, R3, M=None):
    """donne à l'os b l'orientation monde R3 (3×3), quelle que soit la pose de son parent"""
    PARENT, _ = _info()
    REST = K.S['REST']
    M = M or fk_eval(st)
    p = PARENT[b]
    P = (M[p] @ REST[p].inverted() @ REST[b]) if p else REST[b]
    Pr = P.to_3x3().normalized()
    st['fk'][b] = (Pr.inverted() @ Matrix(R3)).to_quaternion()
    return st
