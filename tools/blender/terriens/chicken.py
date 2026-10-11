# Le poulet artilleur : poule blanche dodue, crête rouge, bec jaune, pattes orange, bandeau de commando kaki
# noué derrière la tête, cartouchière d'œufs en travers du poitrail et un petit mortier sanglé sur le dos,
# pointé vers le ciel. Ils vont par deux, gardent leurs distances et tirent des œufs en cloche.
#   Blender -b -P tools/blender/terriens/chicken.py -- public/models/terriens/chicken.glb [dossier_aperçus]
# Clips : Idle (picore, tête par à-coups), Walk (se dandine), Run (dandine en battant des ailes), Warn (se baisse,
# vise, gonfle les plumes), Hit (caquette de rire, tête en arrière), Dance (danse des canards), Fire (le mortier
# recule d'un coup, la poule s'aplatit puis se redresse ; 12 images, une fois).
# Pièce pilotable : l'objet « Mortier » (tube), porté par l'os « mortier ».
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import bpy
import numpy as np
from mathutils import Vector, Quaternion
import kit as K
from kit import V, ell, cone, rbox, srgb

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/chicken.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('chicken', OUT, PREVIEW)
# fichiers de travail (volumes .vdb) à part : d'autres terriens peuvent être modelés en même temps
K.S['work'] = os.path.join(os.path.dirname(os.path.abspath(PREVIEW)), 'work_chicken') if PREVIEW else '/tmp/terrien_chicken'
os.makedirs(K.S['work'], exist_ok=True)

# --- proportions ---------------------------------------------------------------------------------------
ROOT_Z = 0.24
# la tête est dessinée autour de HC0 puis grossie de HS autour de son centre (grosse tête de dessin animé)
HC0, HS = V(0, -0.125, 0.505), 1.17
HEAD_C, HEAD_R = V(0, -0.13, 0.505), V(0.072, 0.078, 0.078) * HS


def hp(p):
    return tuple(HEAD_C + (V(*p) - HC0) * HS)


def hr(r):
    return tuple(V(*r) * HS)


LEG = {'L': V(0.068, 0.0, 0), 'R': V(-0.068, 0.0, 0)}
HIPL_Z, ANK_Z = 0.14, 0.03                      # haut de la patte orange, cheville
SHW = V(0.125, -0.06, 0.36)                     # épaule de l'aile gauche
MB, MM = V(0, 0.045, 0.425), V(0, 0.122, 0.70)  # culasse et bouche du mortier
MD = (MM - MB) / np.linalg.norm(MM - MB)

body = [
    # le corps dodu (un œuf couché), le poitrail bombé, le ventre
    ell('body', (0, 0.03, 0.29), (0.15, 0.185, 0.14), k=0.05),
    ell('breast', (0, -0.08, 0.3), (0.128, 0.11, 0.125), k=0.05),
    ell('body', (0, 0.0, 0.215), (0.115, 0.13, 0.075), k=0.04),
    cone('neck', (0, -0.075, 0.38), (0, -0.115, 0.47), 0.08, 0.065, k=0.05),
    # la tête, la crête à trois lobes, les barbillons
    ell('head', tuple(HEAD_C), tuple(HEAD_R), k=0.04),
    ell('comb', hp((0, -0.158, 0.588)), hr((0.014, 0.024, 0.03)), k=0.012),
    ell('comb', hp((0, -0.124, 0.606)), hr((0.016, 0.028, 0.037)), k=0.012),
    ell('comb', hp((0, -0.088, 0.592)), hr((0.014, 0.024, 0.031)), k=0.012),
    ell('wattle', hp((0.009, -0.196, 0.447)), hr((0.012, 0.012, 0.024)), k=0.008),
    ell('wattle', hp((-0.009, -0.196, 0.447)), hr((0.012, 0.012, 0.024)), k=0.008),
    # paupières froncées : l'air commando
    ell('lid', hp((0.039, -0.19, 0.544)), hr((0.031, 0.03, 0.014)), k=0.008, R=K.rot(0, -24, 0)),
    ell('lid', hp((-0.039, -0.19, 0.544)), hr((0.031, 0.03, 0.014)), k=0.008, R=K.rot(0, 24, 0)),
    # la queue en panache
    ell('tail', (0, 0.2, 0.37), (0.055, 0.06, 0.095), k=0.04, R=K.rot(-30, 0, 0)),
    ell('tail', (0.04, 0.215, 0.39), (0.025, 0.04, 0.085), k=0.03, R=K.rot(-38, 0, 14)),
    ell('tail', (-0.04, 0.215, 0.39), (0.025, 0.04, 0.085), k=0.03, R=K.rot(-38, 0, -14)),
    ell('tail', (0, 0.235, 0.44), (0.02, 0.035, 0.06), k=0.03, R=K.rot(-50, 0, 0)),
]
for s, b in LEG.items():
    sx = 1 if s == 'L' else -1
    body.append(ell('thigh', tuple(b + V(0.006 * sx, 0.035, 0.18)), (0.05, 0.065, 0.06), k=0.04))
    body.append(cone('leg', tuple(b + V(0, 0.03, HIPL_Z + 0.01)), tuple(b + V(0, 0.022, ANK_Z)), 0.016, 0.013, k=0.01))
    F = b + V(0, 0.022, 0.016)
    for dx in (-0.032, 0.0, 0.032):
        body.append(cone('toe', tuple(F), tuple(F + V(dx * sx, -0.072, -0.007)), 0.011, 0.007, k=0.006))
    body.append(cone('toe', tuple(F), tuple(F + V(0, 0.038, -0.006)), 0.01, 0.007, k=0.006))

C = {k: srgb(v) for k, v in dict(
    white='#fbfaf4', cream='#efe9da', comb='#e8281f', wattle='#d81f22', lid='#e9e2cf', leg='#ffa31a', toe='#f29010',
    strap='#6b4528', buckle='#c8b060', tail='#f4f2ea', tailtip='#d8d4c8').items()}
COL = {'default': C['white'], 'body': C['white'], 'breast': C['white'], 'neck': C['white'], 'head': C['white'],
       'comb': C['comb'], 'wattle': C['wattle'], 'lid': C['lid'], 'tail': C['tail'], 'thigh': C['white'],
       'leg': C['leg'], 'toe': C['toe']}
# la cartouchière : bande en travers du poitrail, de l'épaule gauche (haute) au flanc droit (bas)
BAND_N = np.array([-0.6, 0.0, 1.0]) / np.linalg.norm([-0.6, 0.0, 1.0])
BAND_P = np.array([0.0, 0.0, 0.305])


def extra(co, nor, col, tag):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    fluffy = np.isin(tag, ('body', 'breast', 'neck', 'thigh'))
    # un peu de relief dans le plumage : poitrail crème, dessous légèrement plus sombre
    col[fluffy & (z < 0.2)] = C['cream']
    # bouts de la queue un peu gris
    col[(tag == 'tail') & (z > 0.45)] = C['tailtip']
    # pattes : écailles plus sombres aux doigts
    col[(tag == 'leg') & (z < 0.05)] = C['toe']


def surf(prims, p, d):
    """premier point de surface en venant de p dans la direction d"""
    ts = np.linspace(0, 0.5, 4000)
    pts = np.asarray(p, float)[None, :] + ts[:, None] * np.asarray(d, float)[None, :]
    f = K.field(prims, pts[:, 0], pts[:, 1], pts[:, 2])
    return pts[int(np.argmax(f < 0))]


def solid(name, prims, lo, hi, colors, faces, vox=0.0025, rough=0.5, extra_fn=None):
    """pièce rigide en volumes, peinte par sommets (avec retouche facultative)"""
    ob = K.sdf_mesh(name, prims, lo, hi, vox=vox)
    K.decimate(ob, faces, symmetric=False)
    K.paint(ob, prims, colors, extra_fn)
    ob.data.materials.append(K.vc_material(name + 'Mat', rough=rough))
    return ob


K.log('maillage du corps')
BODY = K.sdf_mesh('Body', body, (-0.24, -0.3, 0.0), (0.24, 0.33, 0.71), vox=0.0035)
K.decimate(BODY, 7000)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Poule', rough=0.7))


# --- accessoires ------------------------------------------------------------------------------------------
def eyes(c_left, r, seg=16):
    out = []
    w, p = K.mat('Blanc', '#ffffff', rough=0.15), K.mat('Pupille', '#1a1033', rough=0.45)
    for sx, n in ((1, 'OeilG'), (-1, 'OeilD')):
        c = Vector((c_left[0] * sx, c_left[1], c_left[2]))
        out.append(K.sphere(n, tuple(c), r, w, seg=seg))
        d = Vector((-sx * 0.1, -1, 0.04)).normalized()       # regard un peu en dedans : elle fixe sa cible
        out.append(K.sphere(n + 'P', tuple(c + d * r * 0.9), r * 0.52, p, scale=(1, 0.55, 1), seg=seg))
    return out


EYES = eyes(hp((0.039, -0.186, 0.522)), 0.025 * HS)

# bec : la mandibule du haut sur la tête, celle du bas sur l'os « bec » (elle s'ouvre pour caqueter)
yel = {'default': srgb('#ffc21f'), 'tip': srgb('#f0a010')}
BEAK = solid('Bec', [ell('default', hp((0, -0.193, 0.5)), hr((0.03, 0.022, 0.02)), k=0.01),
                     cone('default', hp((0, -0.192, 0.502)), hp((0, -0.25, 0.489)), 0.022 * HS, 0.006 * HS, k=0.01),
                     ell('tip', hp((0, -0.257, 0.487)), hr((0.006, 0.008, 0.006)), k=0.006)],
             hp((-0.05, -0.29, 0.46)), hp((0.05, -0.16, 0.54)), yel, faces=360, vox=0.002, rough=0.35)
BEAK2 = solid('BecBas', [cone('default', hp((0, -0.19, 0.484)), hp((0, -0.236, 0.477)), 0.016 * HS, 0.004 * HS, k=0.008)],
              hp((-0.04, -0.27, 0.45)), hp((0.04, -0.16, 0.51)), yel, faces=200, vox=0.002, rough=0.35)


# bandeau de commando : une bande qui épouse la tête au-dessus des yeux, nœud derrière, deux pans qui flottent
def head_pt(phi, z, out=0.004):
    dz = (z - HEAD_C[2]) / HEAD_R[2]
    k = math.sqrt(max(0.0, 1 - dz * dz))
    return HEAD_C + V((HEAD_R[0] * k + out) * math.cos(phi), (HEAD_R[1] * k + out) * math.sin(phi), z - HEAD_C[2])


BAND_Z = hp((0, 0, 0.553))[2]
band_pts = [head_pt(math.radians(a), BAND_Z - 0.015 * math.sin(math.radians(a))) for a in range(0, 361, 15)]
bprims = [cone('default', tuple(band_pts[i]), tuple(band_pts[i + 1]), 0.0105, 0.0105, k=0.004) for i in range(len(band_pts) - 1)]
KNOT = head_pt(math.radians(90), BAND_Z - 0.015, 0.008)
bprims.append(ell('knot', tuple(KNOT + V(0, 0.006, 0)), (0.016, 0.012, 0.014), k=0.005))
olive = {'default': srgb('#3a4a20'), 'knot': srgb('#2e3a18')}
BAND = solid('Bandeau', bprims, (-0.12, -0.24, 0.48), (0.12, 0.02, 0.64), olive, faces=700, vox=0.0022, rough=0.7)
RUBAN = solid('Ruban', [cone('default', tuple(KNOT + V(0.004, 0.008, -0.004)), tuple(KNOT + V(0.022, 0.07, -0.05)), 0.009, 0.006, k=0.004),
                        ell('default', tuple(KNOT + V(0.026, 0.078, -0.058)), (0.008, 0.016, 0.008), k=0.004),
                        cone('default', tuple(KNOT + V(-0.004, 0.008, -0.004)), tuple(KNOT + V(-0.018, 0.06, -0.064)), 0.009, 0.006, k=0.004),
                        ell('default', tuple(KNOT + V(-0.021, 0.066, -0.072)), (0.008, 0.016, 0.008), k=0.004)],
              tuple(KNOT + V(-0.06, -0.02, -0.11)), tuple(KNOT + V(0.06, 0.12, 0.02)), olive, faces=300, vox=0.002, rough=0.7)

# ailes rigides, articulées à l'épaule
WINGS = []
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    WINGS.append(solid('Aile' + ('G' if s == 'L' else 'D'), [
        ell('default', tuple(V(0.152, 0.015, 0.305) * m), (0.032, 0.13, 0.085), k=0.02, R=K.rot(-12, 0, 6 * sx)),
        ell('tip', tuple(V(0.158, 0.125, 0.272) * m), (0.024, 0.065, 0.04), k=0.015, R=K.rot(-25, 0, 0)),
        ell('tip', tuple(V(0.155, 0.12, 0.238) * m), (0.02, 0.058, 0.03), k=0.015, R=K.rot(-12, 0, 0)),
        ell('default', tuple(V(0.14, -0.05, 0.35) * m), (0.03, 0.04, 0.04), k=0.02),
    ], (0.08, -0.14, 0.17) if sx > 0 else (-0.22, -0.14, 0.17), (0.22, 0.25, 0.43) if sx > 0 else (-0.08, 0.25, 0.43),
        {'default': C['white'], 'tip': C['tailtip']}, faces=520, vox=0.003, rough=0.7))

# le mortier : tube kaki évasé, frettes, culasse sombre, plaque de dos, hausse ; l'âme est creusée
tube_prims = [
    rbox('plate', (0, 0.038, 0.432), (0.07, 0.078, 0.011), r=0.008, k=0.01, R=K.rot(-6, 0, 0)),
    ell('breech', tuple(MB + MD * 0.02), (0.05, 0.05, 0.035), k=0.012),
    cone('tube', tuple(MB + MD * 0.02), tuple(MM), 0.039, 0.044, k=0.008),
    cone('ring', tuple(MM - MD * 0.028), tuple(MM), 0.053, 0.053, k=0.004),
    cone('ring', tuple(MB + MD * 0.13), tuple(MB + MD * 0.15), 0.048, 0.048, k=0.004),
    rbox('sight', tuple(MB + MD * 0.15 + V(0.052, 0, 0)), (0.012, 0.018, 0.026), r=0.004, k=0.006),
    cone('bore', tuple(MM - MD * 0.13), tuple(MM + MD * 0.05), 0.032, 0.032, k=0.004, op='sub'),
]
tcol = {'default': srgb('#7f7a3e'), 'tube': srgb('#7f7a3e'), 'ring': srgb('#565330'), 'breech': srgb('#3e3c28'),
        'plate': srgb('#4a4f58'), 'sight': srgb('#25252a')}


def tube_extra(co, nor, col, tag):
    rel = co - MM
    along = rel @ MD
    radial = np.linalg.norm(rel - along[:, None] * MD[None, :], axis=1)
    col[(radial < 0.0345) & (along > -0.14)] = srgb('#141410')       # l'âme, noire


MORTAR = solid('Mortier', tube_prims, (-0.09, -0.06, 0.39), (0.1, 0.2, 0.76), tcol, faces=1500, vox=0.0025, rough=0.45, extra_fn=tube_extra)

# la cartouchière : une sangle de cuir qui fait le tour du corps dans le plan BAND, avec sa boucle
torso = [q for q in body if q['tag'] in ('body', 'breast', 'neck', 'thigh')]
BV = np.cross(BAND_N, [0, 1, 0])
spts = []
for a in range(0, 360, 12):
    d = math.cos(math.radians(a)) * BV + math.sin(math.radians(a)) * np.array([0, 1.0, 0])
    q = surf(torso, BAND_P + d * 0.45, -d)
    spts.append(q + d * 0.003)
spts.append(spts[0])
sprims = [cone('default', tuple(spts[i] + BAND_N * o), tuple(spts[i + 1] + BAND_N * o), 0.0075, 0.0075, k=0.008)
          for i in range(len(spts) - 1) for o in (-0.008, 0.0, 0.008)]          # trois cordons fondus : une bande plate
side = min(spts, key=lambda q: q[0] + abs(q[1]) * 0.5)          # le flanc droit
sprims.append(rbox('buckle', tuple(side + V(-0.006, 0, 0)), (0.008, 0.02, 0.016), r=0.004, k=0.003))
STRAP = solid('Cartouchiere', sprims, (-0.25, -0.3, 0.1), (0.25, 0.3, 0.5), {'default': C['strap'], 'buckle': C['buckle']},
              faces=1000, vox=0.0028, rough=0.6)

# œufs dans la cartouchière
EGGS = []
for i, ex in enumerate((-0.055, 0.0, 0.055)):
    ez = BAND_P[2] + 0.6 * ex
    p = surf(torso, (ex, -0.4, ez), (0, 1, 0))
    EGGS.append(K.sphere(f'Oeuf{i}', (ex, p[1] - 0.012, ez), 0.016, K.mat('Coquille', '#fff1d0', rough=0.4), scale=(1, 0.8, 1.3), seg=12))

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0.03, ROOT_Z), (0, 0.03, 0.34))
K.bone('spine', (0, 0.03, 0.34), (0, -0.07, 0.42), 'root', True)
K.bone('neck', (0, -0.07, 0.42), (0, -0.12, 0.49), 'spine', True)
K.bone('head', (0, -0.12, 0.49), (0, -0.13, 0.64), 'neck', True)
K.bone('bec', hp((0, -0.19, 0.484)), hp((0, -0.24, 0.477)), 'head')
K.bone('ruban', tuple(KNOT), tuple(KNOT + V(0, 0.07, -0.06)), 'head')
K.bone('tail', (0, 0.17, 0.33), (0, 0.25, 0.45), 'root')
K.bone('mortier', MB, MM, 'spine')
for s, sx in (('L', 1), ('R', -1)):
    m = V(sx, 1, 1)
    K.bone('wing' + s, SHW * m, V(0.165, 0.15, 0.29) * m, 'spine')
    b = LEG[s]
    K.bone('thigh' + s, b + V(0, 0.035, 0.22), b + V(0, 0.03, HIPL_Z), 'root')
    K.bone('shin' + s, b + V(0, 0.03, HIPL_Z), b + V(0, 0.022, ANK_Z), 'thigh' + s, True)
    K.bone('foot' + s, b + V(0, 0.022, ANK_Z), b + V(0, -0.06, 0.012), 'shin' + s, True)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in ('head', 'comb', 'wattle', 'lid'):
        return ['head']
    if tg == 'neck':
        return ['spine', 'neck', 'head']
    if tg in ('body', 'breast'):
        return ['root', 'spine']
    if tg == 'tail':
        return ['root', 'tail']
    if tg == 'thigh':
        return ['root', 'thigh' + s]
    if tg == 'leg':
        return ['thigh' + s, 'shin' + s] if p[2] > 0.11 else ['shin' + s]
    if tg == 'toe':
        return ['shin' + s, 'foot' + s] if p[1] > 0.03 else ['foot' + s]
    return ['root', 'spine']


K.skin(BODY, CO, TAG, allowed)
for o in EYES + [BEAK, BAND]:
    K.attach(o, 'head')
K.attach(BEAK2, 'bec')
K.attach(RUBAN, 'ruban')
K.attach(WINGS[0], 'wingL')
K.attach(WINGS[1], 'wingR')
K.attach(MORTAR, 'mortier')
for o in EGGS + [STRAP]:
    K.attach(o, 'spine')


# =====================================================================================================
# Outils d'animation
# =====================================================================================================
def bake(clips):
    """comme K.bake, mais fk accepte aussi des quaternions (repère du monde au repos), et loc pour n'importe quel os"""
    arm, pb, REST = K.S['arm'], K.S['arm'].pose.bones, K.S['REST']
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
            for bname, r in st['fk'].items():
                if isinstance(r, Quaternion):
                    rq = REST[bname].to_3x3().to_quaternion()
                    pb[bname].rotation_quaternion = rq.inverted() @ r @ rq
                else:
                    pb[bname].rotation_quaternion = K.q_world(bname, r)
            pb['root'].location = REST['root'].to_3x3().inverted() @ Vector(st.get('root', (0, 0, 0)))
            if st.get('scale'):
                sc = REST['root'].to_3x3().inverted() @ Vector(st['scale'])
                pb['root'].scale = (abs(sc[0]), abs(sc[1]), abs(sc[2]))
            for bname, v in st.get('loc', {}).items():
                pb[bname].location = REST[bname].to_3x3().inverted() @ Vector(v)
            for b in pb:
                b.keyframe_insert('rotation_quaternion', frame=f)
                b.keyframe_insert('location', frame=f)
                b.keyframe_insert('scale', frame=f)
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
    arm.animation_data.action = None
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    K.log('animations', [c[0] for c in clips])


def ss(a, b, t):
    x = min(1.0, max(0.0, (t - a) / (b - a)))
    return x * x * (3 - 2 * x)


def win(t, a, b, r):
    return ss(a, a + r, t) * (1 - ss(b - r, b, t))


def P(fk, root=(0, 0, 0), scale=None, loc=None):
    return dict(fk=fk, root=root, scale=scale, loc=loc or {})


LEG_LEN = (0.22 - HIPL_Z) + (HIPL_Z - ANK_Z)


def crouch(fk, d, sz=1.0):
    """plie les pattes pour que le corps descende de d sans que les pieds quittent le sol"""
    th = math.degrees(math.acos(max(0.2, 1 - d / (LEG_LEN * sz))))
    for s in ('L', 'R'):
        fk['thigh' + s] = fk.get('thigh' + s, []) + [('x', -th)]
        fk['shin' + s] = fk.get('shin' + s, []) + [('x', 2 * th)]
        fk['foot' + s] = fk.get('foot' + s, []) + [('x', -th)]


def legs(fk, ph, lift=30, knee=50, comp=0.0):
    """pas : ph phase de la patte gauche ; comp compense une bascule du corps (degrés)"""
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(K.TAU * (ph + o))
        up = max(0.0, math.cos(K.TAU * (ph + o)))
        fk['thigh' + s] = [('x', -comp - lift * w)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -knee * 0.6 * up)]


def wings(fk, a, flap=0.0):
    """a : ouverture des ailes (degrés, vers le haut et le dehors)"""
    fk['wingL'] = [('y', -a), ('x', flap)]
    fk['wingR'] = [('y', a), ('x', flap)]


def puff(sz_xy, sz_z):
    """gonflement du corps par l'os racine ; renvoie (échelle, correction de hauteur pour garder les pieds au sol)"""
    return (sz_xy, sz_xy, sz_z), -ROOT_Z * (1 - sz_z)


# =====================================================================================================
# Les clips
# =====================================================================================================
def idle(t):
    # la tête tourne par à-coups (gauche, droite, face), puis elle picore deux fois et secoue la queue
    hz = 38 * ss(0.08, 0.11, t) - 70 * ss(0.27, 0.3, t) + 32 * ss(0.44, 0.47, t)
    hy = 14 * ss(0.08, 0.11, t) - 26 * ss(0.27, 0.3, t) + 12 * ss(0.44, 0.47, t)
    peck = win(t, 0.54, 0.9, 0.08)
    pk = sum(max(0.0, math.sin(math.pi * (t - a) / 0.075)) if a < t < a + 0.075 else 0.0 for a in (0.63, 0.75))
    bend = 34 * peck
    fk = {'root': [('x', bend)], 'neck': [('x', 22 * peck + 30 * pk)], 'head': [('z', hz), ('y', hy), ('x', 18 * peck + 22 * pk)],
          'tail': [('x', 18 * win(t, 0.9, 0.99, 0.03) * math.sin(K.TAU * 3 * t)), ('z', 3 * K.wave(t))],
          'bec': [('x', 18 * win(t, 0.16, 0.24, 0.025))],
          'ruban': [('x', 6 * K.wave(t, 1) - 0.8 * (bend + 40 * peck + 52 * pk)), ('z', 5 * K.wave(t, 2))],
          'spine': [('x', 1.5 * K.wave(t, 2))]}
    wings(fk, 4 + 2 * K.wave(t, 2) + 14 * peck)
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -bend)]
    return P(fk, root=(0, 0, 0.003 * K.wave(t, 2) - 0.012 * peck))


def walk(t):
    # dandinement : le corps roule d'une patte sur l'autre, la tête avance par à-coups
    fk = {'root': [('y', 8 * K.wave(t, 2)), ('x', 6)], 'neck': [('x', 12 * K.wave(t, 4, 0.1))], 'head': [('x', -12 * K.wave(t, 4, 0.1)), ('z', 5 * K.wave(t, 2))],
          'tail': [('z', 10 * K.wave(t, 2, 0.25))], 'ruban': [('x', -10 + 8 * K.wave(t, 4))]}
    legs(fk, 2 * t, lift=30, knee=55, comp=6)
    wings(fk, 7 + 4 * K.hop(t, 4))
    return P(fk, root=(0.012 * K.wave(t, 2), 0, 0.014 * K.hop(t, 4)))


def run(t):
    # course : penchée en avant, ça dandine fort et ça bat des ailes, le bandeau flotte
    fk = {'root': [('y', 10 * K.wave(t, 2)), ('x', 18)], 'neck': [('x', 18 + 6 * K.wave(t, 4))], 'head': [('x', -30 - 6 * K.wave(t, 4))],
          'tail': [('x', -10), ('z', 14 * K.wave(t, 2, 0.25))], 'ruban': [('x', -45 + 18 * K.wave(t, 8)), ('z', 10 * K.wave(t, 4))],
          'mortier': [('x', 4 * K.wave(t, 4)), ('y', 3 * K.wave(t, 2))], 'bec': [('x', 10 * K.hop(t, 4))]}
    legs(fk, 2 * t, lift=42, knee=80, comp=18)
    wings(fk, 55 + 40 * K.wave(t, 4), flap=10 * K.wave(t, 4, 0.25))
    return P(fk, root=(0.015 * K.wave(t, 2), 0, 0.035 * K.hop(t, 4)))


def warn(t):
    # elle se baisse, gonfle les plumes, rentre la tête et pointe le mortier sur sa cible
    e = ss(0.0, 0.55, t)
    jit = math.sin(K.TAU * 6 * t) * ss(0.5, 0.8, t) * 1.5
    sc, dz = puff(1 + 0.14 * e, 1 + 0.05 * e)
    fk = {'root': [('x', 8 * e)], 'neck': [('x', -14 * e)], 'head': [('x', 14 * e + jit), ('z', jit)],
          'tail': [('x', -25 * e)], 'mortier': [('x', 24 * e + jit)], 'ruban': [('x', 10 * e)]}
    wings(fk, 26 * e)
    crouch(fk, 0.04 * e, sc[2])
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', -8 * e)] + fk['thigh' + s]
    return P(fk, root=(0, 0, -0.04 * e + dz), scale=sc)


def laugh(t):
    # caquètement : tête renversée, bec qui claque, ailes qui se tapent les cuisses
    sh = K.wave(t, 6)
    fk = {'root': [('x', -10 + 2 * sh), ('y', 4 * K.wave(t, 3))], 'neck': [('x', -24 + 5 * sh)], 'head': [('x', -26 + 6 * sh), ('z', 8 * K.wave(t, 1))],
          'bec': [('x', 34 * K.hop(t, 6))], 'tail': [('x', 18 + 8 * sh)], 'ruban': [('x', 45 + 12 * sh)]}
    wings(fk, 22 + 28 * K.hop(t, 6))
    for s in ('L', 'R'):
        fk['thigh' + s] = [('x', 10 - 8 * K.hop(t, 6))]
        fk['shin' + s] = [('x', 14 * K.hop(t, 6))]
    return P(fk, root=(0, 0.01, 0.014 * K.hop(t, 6)))


def dance(t):
    # danse des canards : premier temps, le bec et les ailes battent ; second temps, accroupie, on tortille du croupion
    A = win(t, 0.0, 0.5, 0.05)
    B = win(t, 0.5, 1.0, 0.05)
    fk = {'neck': [('x', 12 * K.hop(t, 4))], 'head': [('x', -8 * K.hop(t, 4)), ('z', 12 * K.wave(t, 1))],
          'bec': [('x', 30 * K.hop(t, 8) * A)], 'tail': [('x', 22 * K.hop(t, 8) * B)],
          'root': [('z', 16 * K.wave(t, 4) * B)], 'ruban': [('x', -15 * K.hop(t, 4))]}
    wings(fk, (8 + 70 * K.hop(t, 8)) * A + 18 * B, flap=-10 * A)
    for s in ('L', 'R'):
        fk['thigh' + s] = [('z', -16 * K.wave(t, 4) * B)]
    crouch(fk, 0.045 * B * (0.6 + 0.4 * K.hop(t, 4)) + 0.012 * A * K.hop(t, 8))
    return P(fk, root=(0, 0, -0.045 * B * (0.6 + 0.4 * K.hop(t, 4)) - 0.012 * A * K.hop(t, 8)))


def fire(t):
    # le coup part : le tube recule d'un coup, la poule s'écrase, puis se redresse en vacillant
    rec = ss(0.0, 0.07, t) * (1 - ss(0.12, 0.75, t))
    sq = ss(0.0, 0.1, t) * (1 - ss(0.1, 0.5, t)) - 0.3 * win(t, 0.45, 1.0, 0.2)
    sc, dz = puff(1 + 0.18 * sq, 1 - 0.24 * sq)
    fk = {'neck': [('x', 22 * sq)], 'head': [('x', -10 * sq)], 'tail': [('x', 28 * sq)],
          'bec': [('x', 25 * win(t, 0.05, 0.45, 0.1))], 'mortier': [('x', -10 * rec)], 'ruban': [('x', -30 * rec)]}
    wings(fk, 40 * max(0.0, sq) + 10 * rec)
    return P(fk, root=(0, 0, dz), scale=sc, loc={'mortier': tuple(-MD * 0.055 * rec)})


bake([('Idle', 60, idle), ('Walk', 24, walk), ('Run', 16, run), ('Warn', 16, warn), ('Hit', 30, laugh), ('Dance', 32, dance),
      ('Fire', 12, fire)])

K.preview([
    ('face', 'Idle', 0, (0.25, -1.9, 0.55), (0, 0, 0.35)),
    ('troisquarts', 'Idle', 0, (1.4, -1.4, 0.95), (0, 0, 0.35)),
    ('visage', 'Idle', 0, (0.18, -0.95, 0.6), (0, -0.08, 0.47)),
    ('dos', 'Idle', 0, (-1.2, 1.4, 1.0), (0, 0, 0.4)),
    ('iso', 'Idle', 0, (1.6, -1.6, 1.9), (0, 0, 0.3)),
    ('picore', 'Idle', 41, (1.8, -0.6, 0.6), (0, -0.05, 0.3)),
    ('marche', 'Walk', 6, (1.3, -1.6, 0.8), (0, 0, 0.33)),
    ('course', 'Run', 4, (1.5, -1.4, 0.8), (0, 0, 0.33)),
    ('alerte', 'Warn', 16, (1.4, -1.4, 0.8), (0, 0, 0.33)),
    ('rire', 'Hit', 8, (1.4, -1.5, 0.8), (0, 0, 0.36)),
    ('danse', 'Dance', 4, (0.6, -1.8, 0.7), (0, 0, 0.33)),
    ('danse2', 'Dance', 22, (0.6, -1.8, 0.7), (0, 0, 0.33)),
    ('tir', 'Fire', 2, (1.8, -0.9, 0.7), (0, 0, 0.35)),
])
K.export()
