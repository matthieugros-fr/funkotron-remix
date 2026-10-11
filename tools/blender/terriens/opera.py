# La cantatrice : diva wagnérienne imposante. Casque à cornes, longues tresses blondes, plastron doré à pointes,
# grande robe violette à godets, cape rouge à col d'hermine, bras dodus, lance dorée. Elle ne court pas : elle se
# plante près du joueur et chante si fort que ça fait mal (mâchoire sur l'os `jaw`, qui s'ouvre en grand).
#   Blender -b -P tools/blender/terriens/opera.py -- public/models/terriens/opera.glb [dossier_aperçus]
# Clips : Idle (respire, se racle la gorge), Walk / Run (démarche majestueuse et lourde), Warn (grande inspiration,
# main sur le cœur), Hit (salut de diva), Dance (valse pesante), Sing (bouche grande ouverte, vibrato).
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import math
import numpy as np
import bpy
import openvdb as vdb
from mathutils import Vector
import kit as K
from kit import V, ell, cone, rbox, srgb, pose

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/opera.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
K.init('opera', OUT, PREVIEW)
# volumes de travail dans un dossier à soi (d'autres terriens peuvent être modelés en même temps)
K.S['work'] = os.path.join(os.path.dirname(os.path.abspath(PREVIEW)) if PREVIEW else '/tmp', 'work_opera')
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


def mesh(name, prims, lo, hi, vox=0.006, clip=None, smooth=2, fieldfn=None, more=None):
    lo = np.floor(V(*lo) / vox) * vox
    n = np.ceil((V(*hi) - lo) / vox).astype(int) + 1
    ax = [lo[i] + np.arange(n[i]) * vox for i in range(3)]
    GX, GY, GZ = ax[0][:, None, None], ax[1][None, :, None], ax[2][None, None, :]
    if fieldfn is not None:
        d = fieldfn(GX, GY, GZ).astype(np.float32)
    else:
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
    if more is not None:
        d = K.smin(d, more(GX, GY, GZ), 0.008)
    if clip is not None:
        d = np.maximum(d, clip(GX, GY, GZ))
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


def solid(name, prims, lo, hi, colors, faces, vox=0.005, clip=None, rough=0.5, extra=None, more=None):
    ob = mesh(name, prims, lo, hi, vox=vox, clip=clip, more=more)
    K.decimate(ob, faces, symmetric=False)
    K.paint(ob, prims, colors, extra)
    ob.data.materials.append(K.vc_material(name + 'Mat', rough=rough))
    return ob


def ss(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def along(d):
    """matrice de rotation dont l'axe z local suit la direction d"""
    return np.array(Vector(tuple(d)).normalized().to_track_quat('Z', 'Y').to_matrix(), dtype=np.float64)


# =====================================================================================================
# Proportions
# =====================================================================================================
HC, HS = V(0, -0.03, 1.48), 1.08         # centre de la tête, et sa taille (grosse tête cartoon)


def h(x, y, z):
    return tuple(HC + HS * V(x, y, z))


def hr(x, y, z):
    return tuple(HS * V(x, y, z))


MOUTH_C, MOUTH_R = HC + HS * V(0, -0.185, -0.1), HS * V(0.056, 0.055, 0.028)
EYE, ER = HC + HS * V(0.075, -0.14, 0.035), 0.058 * HS
JAW_A, JAW_B = HC + HS * V(0, 0.01, -0.04), HC + HS * V(0, -0.17, -0.17)       # charnière → menton
# bras gauche (x > 0) pendant ; bras droit plié devant, le poing serre la lance verticale
SH, EL, WR, HD = V(0.29, 0.0, 1.22), V(0.41, -0.02, 0.99), V(0.46, -0.08, 0.79), V(0.47, -0.1, 0.69)
SHr, ELr, WRr, HDr = V(-0.29, 0.0, 1.22), V(-0.43, 0.03, 1.0), V(-0.48, -0.17, 0.99), V(-0.5, -0.27, 1.0)
SPEAR = V(-0.492, -0.222, 0)              # axe de la lance (x, y)
HIP_Z = 0.88
LEG = {'L': V(0.12, 0, 0), 'R': V(-0.12, 0, 0)}

body = [
    # la robe : hanches larges, puis cloche immense jusqu'au sol, plis en godets
    ell('dress', (0, 0.02, 0.83), (0.35, 0.31, 0.17), k=0.06),
    cone('dress', (0, 0.0, 0.95), (0, 0.02, 0.12), 0.27, 0.52, k=0.06),
    # le corsage, la ceinture d'or et sa boucle
    ell('bodice', (0, 0.0, 1.1), (0.3, 0.23, 0.22), k=0.05),
    ell('belt', (0, 0.0, 0.945), (0.305, 0.25, 0.055), k=0.03),
    ell('buckle', (0, -0.245, 0.945), (0.07, 0.035, 0.058), k=0.015),
    # le gorgerin doré et le cou
    ell('gorget', (0, -0.01, 1.255), (0.2, 0.17, 0.055), k=0.03),
    cone('neck', (0, 0, 1.22), (0, -0.01, 1.36), 0.09, 0.085, k=0.04),
    # la tête : bonnes joues, double menton, petit nez retroussé, cheveux blonds sous le casque
    ell('head', tuple(HC), hr(0.2, 0.19, 0.215), k=0.05),
    ell('chin', h(0, -0.07, -0.165), hr(0.12, 0.1, 0.065), k=0.05),
    ell('nose', h(0, -0.195, -0.01), hr(0.035, 0.04, 0.035), k=0.025),
    ell('hair', h(0, 0.08, 0.03), hr(0.215, 0.19, 0.2), k=0.04),
]
for i in range(12):
    a = TAU * (i + 0.5) / 12
    body.append(cone('fold', (0.24 * math.cos(a), 0.21 * math.sin(a), 0.88), (0.5 * math.cos(a), 0.02 + 0.5 * math.sin(a), 0.12),
                     0.015, 0.065, k=0.05))
for sx in (1, -1):
    body += [
        # le plastron : deux coupes dorées à pointe (le soutien-gorge wagnérien)
        ell('cup', (0.12 * sx, -0.15, 1.13), (0.13, 0.12, 0.12), k=0.03),
        cone('cup', (0.125 * sx, -0.25, 1.135), (0.13 * sx, -0.345, 1.14), 0.035, 0.007, k=0.02),
        ell('pauldron', (0.29 * sx, 0.0, 1.235), (0.125, 0.13, 0.085), k=0.03, R=K.rot(0, 25 * sx, 0)),
        ell('cheek', h(0.105 * sx, -0.1, -0.06), hr(0.085, 0.07, 0.07), k=0.04),
        ell('hair', h(0.165 * sx, -0.06, 0.1), hr(0.062, 0.07, 0.05), k=0.03),         # mèches aux tempes
        ell('brow', h(0.075 * sx, -0.155, 0.11), hr(0.05, 0.014, 0.012), k=0.012, R=K.rot(0, 12 * sx, 0)),
    ]
    # les tresses : de derrière la joue, par-dessus l'épaule, jusque sur le ventre
    pts = [V(*h(0.17 * sx, 0.03, -0.06)), V(0.265 * sx, -0.05, 1.32), V(0.295 * sx, -0.15, 1.18), V(0.285 * sx, -0.22, 1.04),
           V(0.265 * sx, -0.265, 0.93)]
    seg = []
    for j in range(len(pts) - 1):
        for u in (0.0, 0.5):
            seg.append((pts[j] + (pts[j + 1] - pts[j]) * u, pts[j + 1] - pts[j]))
    for j, (c, d) in enumerate(seg):
        R = along(d) @ K.rot(0, 0, 35 if j % 2 else -35)
        side = np.cross(d / np.linalg.norm(d), V(0, -1, 0))
        off = side / max(np.linalg.norm(side), 1e-6) * (0.012 if j % 2 else -0.012)
        r = 0.05 - 0.012 * j / len(seg)
        body.append(ell('braid' if j % 2 else 'braid2', tuple(c + off), (r, r * 0.8, 0.055), k=0.012, R=R))
    end, dn = pts[-1], (pts[-1] - pts[-2]) / np.linalg.norm(pts[-1] - pts[-2])
    body.append(ell('ribbon', tuple(end), (0.05, 0.05, 0.022), k=0.008, R=along(dn)))
    body.append(cone('braidtip', tuple(end + dn * 0.02), tuple(end + dn * 0.085), 0.026, 0.042, k=0.01))
body.append(ell('mouth', tuple(MOUTH_C), tuple(MOUTH_R), k=0.012, op='sub'))


def arm(sx, sh, el, wr, hd, fist=False):
    m = sh + (el - sh) * 0.45
    out = [cone('arm', sh, el, 0.085, 0.072, k=0.03),
           ell('arm', m, (0.095, 0.095, 0.125), k=0.04, R=along(el - sh)),                 # bras dodu
           cone('armband', sh + (el - sh) * 0.7, sh + (el - sh) * 0.82, 0.088, 0.085, k=0.008),
           cone('forearm', el, wr, 0.07, 0.052, k=0.03),
           cone('wristband', wr + (el - wr) * 0.2, wr + (el - wr) * 0.07, 0.064, 0.06, k=0.008)]
    hc = (wr + hd) / 2
    if fist:
        out += [ell('hand', hc + V(0, 0.01, 0), (0.058, 0.07, 0.058), k=0.03, R=along(hd - wr)),
                ell('hand', hc + V(0.035 * -sx, 0.0, 0.04), (0.025, 0.035, 0.022), k=0.02)]        # pouce par-dessus
    else:
        out += [ell('hand', hc, (0.05, 0.042, 0.068), k=0.03, R=along(hd - wr)),
                ell('hand', hc + V(-0.035 * sx, -0.035, 0.015), (0.022, 0.022, 0.04), k=0.02, R=K.rot(0, 20 * sx, 0))]
    return out


body += arm(1, SH, EL, WR, HD)
body += arm(-1, SHr, ELr, WRr, HDr, fist=True)

GOLD, GOLD2 = srgb('#f0a01a'), srgb('#b8700c')
SKIN = srgb('#f6c4a0')
COL = {'default': SKIN, 'dress': srgb('#8a3ad0'), 'fold': srgb('#9a48e0'), 'bodice': srgb('#7a2ec0'), 'belt': GOLD,
       'buckle': GOLD, 'gorget': GOLD, 'cup': GOLD, 'pauldron': GOLD, 'armband': GOLD, 'wristband': GOLD,
       'neck': SKIN, 'head': SKIN, 'chin': SKIN, 'cheek': srgb('#f7b4a0'), 'nose': srgb('#f4a890'),
       'hair': srgb('#fff09a'), 'braid': srgb('#fff09a'), 'braid2': srgb('#f6d86a'), 'braidtip': srgb('#fff6c4'),
       'ribbon': srgb('#e8334a'), 'brow': srgb('#b07a2a'), 'arm': SKIN, 'forearm': SKIN, 'hand': SKIN}
FACE = ('head', 'chin', 'nose', 'cheek', 'brow', 'hair')


def extra(co, nor, col, tag):
    face = np.isin(tag, FACE)
    # le plastron d'abord : tout ce qui touche une coupe ou le gorgerin est doré, avec un liseré sombre
    torso = np.isin(tag, ('bodice', 'cup', 'gorget', 'neck'))
    dcup = np.min([K.sd_prim(p, co[:, 0], co[:, 1], co[:, 2]) for p in body if p['tag'] == 'cup'], axis=0)
    dgor = np.min([K.sd_prim(p, co[:, 0], co[:, 1], co[:, 2]) for p in body if p['tag'] == 'gorget'], axis=0)
    col[torso & ~(dcup < 0.02) & ~(dgor < 0.012)] = COL['bodice']
    col[torso & (dgor < 0.012)] = GOLD
    col[torso & (tag == 'neck') & (co[:, 2] < 1.29)] = GOLD
    col[torso & (dcup < 0.02)] = GOLD2
    col[torso & (dcup < 0.011)] = GOLD
    # la bouche : intérieur rouge sombre, langue rose, grosses lèvres rouges
    q = (co - MOUTH_C) / MOUTH_R
    qn = np.linalg.norm(q, axis=1)
    inner = face & (qn < 1.4) & ((nor * q).sum(1) < -0.05)
    lips = face & ~inner & (qn < 1.5) & (co[:, 1] < MOUTH_C[1] + 0.07)
    col[lips] = srgb('#e0204a')
    col[inner] = srgb('#7a1426')
    col[inner & (q[:, 2] < -0.2)] = srgb('#d8566e')
    # paupières bleues au-dessus des yeux
    for sx in (1, -1):
        e = co - EYE * V(sx, 1, 1)
        lid = face & (np.abs(e[:, 0]) < 0.065) & (e[:, 2] > 0.015) & (e[:, 2] < 0.07) & (co[:, 1] < EYE[1] + 0.05)
        col[lid & (tag != 'brow')] = srgb('#7c8cff')
    # joues fardées
    blush = (tag == 'cheek') & (co[:, 1] < HC[1] - 0.12)
    col[blush] = srgb('#f78f96')
    # ourlet doré de la robe, et un liseré plus haut
    dr = np.isin(tag, ('dress', 'fold'))
    col[dr & (co[:, 2] < 0.15)] = GOLD
    col[dr & (np.abs(co[:, 2] - 0.2) < 0.012)] = GOLD2
    # pierre rouge sur la boucle, rivets sur le gorgerin
    gem = (tag == 'buckle') & (np.abs(co[:, 0]) < 0.03) & (np.abs(co[:, 2] - 0.945) < 0.028)
    col[gem] = srgb('#e8233a')
    # lacet du corsage : une ligne dorée au milieu du ventre
    lace = (tag == 'bodice') & (co[:, 1] < -0.1) & (np.abs(co[:, 0]) < 0.012) & (co[:, 2] < 1.04)
    col[lace] = GOLD2


K.log('maillage du corps')
BODY = mesh('Body', body, (-0.62, -0.62, 0.0), (0.62, 0.58, 1.8), vox=0.0055, clip=lambda X, Y, Z: 0.07 - Z)
K.decimate(BODY, 8600, symmetric=False)
CO, TAG = K.paint(BODY, body, COL, extra)
BODY.data.materials.append(K.vc_material('Cantatrice', rough=0.5))

# --- la cape : rouge, doublure dorée, col d'hermine -----------------------------------------------------------
CAPE_T, CAPE_B = 1.3, 0.24


def cape_geom(Z):
    u = np.clip((CAPE_T - Z) / (CAPE_T - CAPE_B), 0, 1) ** 0.6
    return 0.4 + 0.21 * u, 0.27 + 0.34 * u, 0.03 + 0.05 * u      # demi-largeur, demi-profondeur, centre en y


def cape_field(X, Y, Z):
    ax, ay, cy = cape_geom(Z)
    rho = np.sqrt((X / ax) ** 2 + ((Y - cy) / ay) ** 2)
    d = np.abs(rho - 1) * np.minimum(ax, ay) - 0.013
    d = np.maximum(d, (cy + 0.06) - Y)
    d = np.maximum(d, np.maximum(Z - CAPE_T, CAPE_B - Z))
    a0, b0, c0 = cape_geom(np.float64(CAPE_T))
    r0 = np.sqrt((X / a0) ** 2 + ((Y - c0) / b0) ** 2)
    dt = np.sqrt(((r0 - 1) * min(a0, b0)) ** 2 + (Z - CAPE_T) ** 2) - 0.045
    dt = np.maximum(dt, (c0 + 0.035) - Y)
    return K.smin(d, dt, 0.02)


K.log('cape')
CAPE = mesh('Cape', None, (-0.72, -0.05, 0.18), (0.72, 0.78, 1.4), vox=0.006, fieldfn=cape_field)
K.decimate(CAPE, 1500, symmetric=True)
me = CAPE.data
CCO = np.empty(len(me.vertices) * 3)
me.vertices.foreach_get('co', CCO)
CCO = CCO.reshape(-1, 3)
ax_, ay_, cy_ = cape_geom(CCO[:, 2])
rho = np.sqrt((CCO[:, 0] / ax_) ** 2 + ((CCO[:, 1] - cy_) / ay_) ** 2)
ccol = np.tile(srgb('#c41e3a'), (len(CCO), 1))
ccol[rho < 0.995] = srgb('#6a0f2a')                               # doublure
erm = CCO[:, 2] > CAPE_T - 0.05
ccol[erm] = srgb('#fbfaf2')
spot = erm & ((np.floor(CCO[:, 0] * 22) + np.floor(CCO[:, 1] * 9)) % 4 == 0) & (np.abs((CCO[:, 0] * 22) % 1 - 0.5) < 0.22)
ccol[spot] = srgb('#1a1424')                                      # mouchetures de l'hermine
ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
ca.data.foreach_set('color', np.concatenate([ccol, np.ones((len(CCO), 1))], axis=1).ravel())
me.color_attributes.active_color = ca
CAPE.data.materials.append(K.vc_material('CapeMat', rough=0.7))

# --- le casque à cornes ---------------------------------------------------------------------------------------
helm = [ell('dome', h(0, 0.04, 0.08), hr(0.24, 0.245, 0.22), k=0.02),
        ell('crest', h(0, 0.035, 0.09), hr(0.028, 0.258, 0.232), k=0.012)]
for sx in (1, -1):
    hp = [V(*h(0.17 * sx, 0.03, 0.12)), V(*h(0.27 * sx, 0.02, 0.16)), V(*h(0.35 * sx, 0.01, 0.24)), V(*h(0.385 * sx, 0.005, 0.34)),
          V(*h(0.372 * sx, 0.01, 0.42)), V(*h(0.34 * sx, 0.02, 0.465))]
    hrad = [0.066, 0.058, 0.048, 0.035, 0.022, 0.006]
    for j in range(len(hp) - 1):
        helm.append(cone('horn', tuple(hp[j]), tuple(hp[j + 1]), hrad[j], hrad[j + 1], k=0.012))
RIM = lambda Y: HC[2] + 0.13 * HS - 0.265 * (Y - (HC[1] - 0.21 * HS))          # bord du casque, plus bas derrière


def rim_tube(X, Y, Z):
    # le jonc doré qui borde le casque : un boudin qui suit la coque le long du plan de coupe
    ds = K.sd_prim(helm[0], X, Y, Z)
    dpl = (Z - RIM(Y) - 0.016) / math.sqrt(1 + 0.265 ** 2)
    return np.sqrt(ds ** 2 + dpl ** 2) - 0.021
hcols = {'default': srgb('#cfd6e6'), 'dome': srgb('#cfd6e6'), 'crest': GOLD, 'ring': GOLD, 'horn': srgb('#fff1d6')}


def helm_extra(co, nor, col, tag):
    tip = (tag == 'horn') & (co[:, 2] > HC[2] + 0.38 * HS)
    col[tip] = srgb('#e2cfa0')
    col[rim_tube(co[:, 0], co[:, 1], co[:, 2]) < 0.006] = GOLD


K.log('casque')
HELM = solid('Casque', helm, (-0.47, -0.34, 1.38), (0.47, 0.36, 2.03), hcols, 2000, vox=0.005,
             clip=lambda X, Y, Z: RIM(Y) - Z, rough=0.3, extra=helm_extra, more=rim_tube)

# --- la lance dorée ---------------------------------------------------------------------------------------------
sx_, sy_ = SPEAR[0], SPEAR[1]
lance = [cone('shaft', (sx_, sy_, 0.34), (sx_, sy_, 1.92), 0.022, 0.02, k=0.005),
         ell('gold', (sx_, sy_, 0.34), (0.032, 0.032, 0.04), k=0.01),
         ell('gold', (sx_, sy_, 1.93), (0.042, 0.042, 0.035), k=0.01),
         ell('blade', (sx_, sy_, 2.03), (0.068, 0.014, 0.12), k=0.01),
         cone('blade', (sx_, sy_, 2.08), (sx_, sy_, 2.22), 0.034, 0.002, k=0.01)]
LANCE = solid('Lance', lance, (sx_ - 0.1, sy_ - 0.06, 0.28), (sx_ + 0.1, sy_ + 0.06, 2.25),
              {'default': srgb('#8a5a2a'), 'shaft': srgb('#8a5a2a'), 'gold': GOLD, 'blade': srgb('#e4eaf4')}, 700, vox=0.004, rough=0.3)


# --- les yeux (iris bleu, regard levé vers le ciel), les cils, les dents -----------------------------------
def diva_eyes():
    w, iris = K.mat('Blanc', '#ffffff', rough=0.15), K.mat('Iris', '#3f7bff', rough=0.2)
    pup, lash = K.mat('Pupille', '#1a1033', rough=0.2), K.mat('Cils', '#1a1033', rough=0.6)
    out = []
    for sx, n in ((1, 'OeilG'), (-1, 'OeilD')):
        c = Vector((EYE[0] * sx, EYE[1], EYE[2]))
        d = Vector((0.05 * sx, -1, 0.22)).normalized()
        out.append(K.sphere(n, tuple(c), ER, w, seg=16))
        out.append(K.sphere(n + 'I', tuple(c + d * ER * 0.85), ER * 0.55, iris, scale=(1, 0.36, 1), seg=12))
        out.append(K.sphere(n + 'P', tuple(c + d * ER * 0.98), ER * 0.3, pup, scale=(1, 0.4, 1), seg=10))
        for k, a in enumerate((-45, -5, 35)):
            r = math.radians(a)
            b = Vector((math.sin(r) * sx * 0.8, -0.45, math.cos(r) * 0.85)).normalized()
            base = c + b * ER * 0.95
            tip = base + (b + Vector((0.35 * sx * (1 if a > 0 else 0.2), -0.1, 0.5))).normalized() * 0.05 * HS
            out.append(K.cone_mesh(f'{n}Cil{k}', tuple(base), tuple(tip), 0.009, 0.002, lash, seg=5, smooth=False))
    return out


EYES = diva_eyes()
white = K.mat('Dents', '#ffffff', rough=0.2)
TEETH_UP = K.box('DentsHaut', tuple(MOUTH_C + HS * V(0, 0.02, 0.018)), hr(0.074, 0.03, 0.014), white, bevel=0.004)
TEETH_DN = K.box('DentsBas', tuple(MOUTH_C + HS * V(0, 0.024, -0.02)), hr(0.06, 0.03, 0.012), white, bevel=0.004)
shoe_m = K.mat('Souliers', '#d8203f', rough=0.35)
SHOES = {s: K.sphere('Soulier' + s, (0.13 * (1 if s == 'L' else -1), -0.37, 0.045), 0.06, shoe_m, scale=(1.1, 3.0, 0.8), seg=14)
         for s in ('L', 'R')}

# --- squelette ----------------------------------------------------------------------------------------------
K.rig_begin()
K.bone('root', (0, 0, HIP_Z), (0, 0, 1.0))
K.bone('spine', (0, 0, 1.0), (0, 0, 1.25), 'root', True)
K.bone('head', (0, 0, 1.25), (0, 0, 1.72), 'spine', True)
K.bone('jaw', JAW_A, JAW_B, 'head')
K.bone('skirt', (0, 0, 0.95), (0, 0.0, 0.1), 'root')
K.bone('cape', (0, 0.28, 1.3), (0, 0.6, 0.3), 'spine')
for s, (a, b, c, d) in (('L', (SH, EL, WR, HD)), ('R', (SHr, ELr, WRr, HDr))):
    K.bone('arm' + s, a, b, 'spine')
    K.bone('forearm' + s, b, c, 'arm' + s, True)
    K.bone('hand' + s, c, d, 'forearm' + s, True)
    o = LEG[s]
    K.bone('thigh' + s, o + V(0, 0, HIP_Z), o + V(0, -0.03, 0.48), 'root')
    K.bone('shin' + s, o + V(0, -0.03, 0.48), o + V(0, -0.02, 0.09), 'thigh' + s, True)
    K.bone('foot' + s, o + V(0, -0.02, 0.09), o + V(0.005, -0.3, 0.04), 'shin' + s, True)
K.rig_end()


def allowed(tg, p):
    s = 'L' if p[0] > 0 else 'R'
    if tg in FACE:
        return ['head']
    if tg in ('braid', 'braid2', 'ribbon', 'braidtip'):
        return ['head', 'spine']
    if tg == 'neck':
        return ['spine', 'head']
    if tg == 'gorget':
        return ['spine'] + (['arm' + s] if abs(p[0]) > 0.17 else [])
    if tg in ('bodice', 'cup'):
        return ['spine', 'root'] if p[2] < 1.02 else ['spine'] + (['arm' + s] if abs(p[0]) > 0.24 and p[2] > 1.14 else [])
    if tg == 'pauldron':
        return ['spine', 'arm' + s]
    if tg in ('arm', 'armband'):
        return ['spine', 'arm' + s, 'forearm' + s] if p[2] > 1.12 else ['arm' + s, 'forearm' + s]
    if tg in ('forearm', 'wristband'):
        return ['arm' + s, 'forearm' + s, 'hand' + s]
    if tg == 'hand':
        return ['forearm' + s, 'hand' + s]
    if tg in ('belt', 'buckle'):
        return ['root', 'spine']
    if tg in ('dress', 'fold'):
        return ['root', 'skirt']
    return ['root', 'spine']


def jaw_weight(p):
    """part de la mâchoire : sous la ligne charnière → coin des lèvres, et devant la charnière"""
    d = MOUTH_C - JAW_A
    L = math.hypot(d[1], d[2])
    s = (d[1] * (p[2] - JAW_A[2]) - d[2] * (p[1] - JAW_A[1])) / L
    return ss(-0.008, 0.012, s) * ss(JAW_A[1], JAW_A[1] - 0.08, p[1])


def jaw_hook(W):
    J, H = K.S['BNAMES'].index('jaw'), K.S['BNAMES'].index('head')
    for i in np.nonzero(np.isin(TAG, FACE))[0]:
        w = jaw_weight(CO[i])
        W[i, J] += W[i, H] * w
        W[i, H] *= 1 - w


_assign = K._assign
K._assign = lambda ob, W: (jaw_hook(W), _assign(ob, W))
K.skin(BODY, CO, TAG, allowed)
K._assign = _assign
K.skin(CAPE, CCO, np.array(['cape'] * len(CCO), dtype=object), lambda tg, p: ['spine', 'cape'])
for o in EYES + [HELM, TEETH_UP]:
    K.attach(o, 'head')
K.attach(TEETH_DN, 'jaw')
K.attach(LANCE, 'handR')
for s, o in SHOES.items():
    K.attach(o, 'foot' + s)


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


def legs(fk, ph, lift=16, knee=24):
    for s, o in (('L', 0.0), ('R', 0.5)):
        w = math.sin(TAU * (ph + o))
        up = max(0.0, math.cos(TAU * (ph + o)))
        fk['thigh' + s] = [('x', -lift * w)]
        fk['shin' + s] = [('x', knee * up)]
        fk['foot' + s] = [('x', -12 * up)]


MOUTH_SPOT = (0.05, -0.27, 1.35)          # le poing devant la bouche (raclement de gorge)
HEART = (0.2, -0.33, 1.13)                # la main sur le cœur


def idle(t):
    # grande respiration (le buste se gonfle), puis « hum hum » : le poing devant la bouche, deux secousses
    b = math.sin(math.pi * min(1.0, t / 0.55)) ** 2
    c = ss(0.55, 0.68, t) * (1 - ss(0.88, 0.99, t))
    j = c * K.hop(t, 11) ** 3
    fk = {'spine': [('x', -6 * b + 5 * c + 4 * j), ('y', 2 * K.wave(t))],
          'head': [('x', -8 * b + 8 * c + 9 * j), ('z', 6 * K.wave(t, 1, 0.2) * (1 - c))],
          'jaw': [('x', 6 * b + 2 * c + 7 * j)],
          'armR': [('y', 4 * b)], 'skirt': [('y', 1.5 * K.wave(t))], 'cape': [('x', 2 + 3 * b)]}
    reach(fk, 'L', MOUTH_SPOT, (0.7, 0.2, 0.9), c)
    fk['handL'] = [('x', -40 * c)]
    return pose(fk, root=(0, 0, 0.012 * b - 0.012 * j), scale=(1 + 0.025 * b, 1 + 0.03 * b, 1 + 0.008 * b))


def walk(t):
    # démarche de reine : menton levé, balancement d'un pied sur l'autre, la lance en bâton de marche
    sw = K.wave(t)
    fk = {'spine': [('x', -3), ('y', 4 * sw), ('z', 5 * sw)],
          'head': [('x', -8), ('y', -3 * sw), ('z', -4 * sw)], 'jaw': [('x', 2)],
          'armL': [('x', 16 * K.wave(t, 1, 0.5)), ('y', -14)], 'forearmL': [('x', -25 - 10 * K.wave(t, 1, 0.4)), ('y', -12)],
          'handL': [('y', -25)],
          'armR': [('x', -6 * sw)],
          'skirt': [('x', 3 * K.wave(t, 2, 0.1)), ('y', -5 * K.wave(t, 1, 0.1))],
          'cape': [('x', 8 + 4 * K.wave(t, 2, 0.15)), ('y', -5 * K.wave(t, 1, 0.1))]}
    legs(fk, t, lift=16, knee=24)
    return pose(fk, root=(0.035 * sw, 0, -0.025 * K.hop(t, 2)))


def run(t):
    # elle presse le pas sans perdre sa dignité : penchée, bras qui moulinent, cape au vent
    sw = K.wave(t)
    fk = {'spine': [('x', 8), ('y', 5 * sw), ('z', 7 * sw)],
          'head': [('x', -14), ('y', -4 * sw)], 'jaw': [('x', 6)],
          'armL': [('x', 32 * K.wave(t, 1, 0.5)), ('y', -25)], 'forearmL': [('x', -40), ('y', -10)],
          'armR': [('x', -8 - 10 * sw)],
          'skirt': [('x', 6 * K.wave(t, 2, 0.1)), ('y', -8 * K.wave(t, 1, 0.1))],
          'cape': [('x', 18 + 6 * K.wave(t, 2, 0.15)), ('y', -8 * K.wave(t, 1, 0.1))]}
    legs(fk, t, lift=26, knee=40)
    return pose(fk, root=(0.04 * sw, 0, 0.04 * K.hop(t, 2) - 0.02))


def warn(t):
    # grande inspiration, la main sur le cœur, le buste gonflé, la lance levée
    e = ss(0.0, 0.75, t)
    fk = {'spine': [('x', -13 * e)], 'head': [('x', -14 * e)], 'jaw': [('x', 10 * e)],
          'armR': [('x', -18 * e)], 'cape': [('x', 8 * e)], 'skirt': [('x', 2 * e)]}
    reach(fk, 'L', HEART, (0.8, 0.1, 0.5), e)
    fk['handL'] = [('z', 30 * e), ('x', -20 * e)]
    return pose(fk, root=(0, 0, 0.03 * e), scale=(1 + 0.07 * e, 1 + 0.07 * e, 1 + 0.02 * e))


def bow(t):
    # salut de diva : révérence profonde, bras ouverts, puis le menton se relève, très satisfaite
    b = ss(0.05, 0.42, t) * (1 - ss(0.6, 0.95, t))
    p = 1 - b
    fk = {'spine': [('x', 30 * b)], 'head': [('x', 14 * b - 12 * p), ('z', 8 * p * K.wave(t, 1, 0.4))],
          'jaw': [('x', 4 * p)],
          'armL': [('y', -60 * b - 12 * p), ('x', 28 * b)], 'forearmL': [('y', -25 * b), ('x', -10 * p)], 'handL': [('y', -30 * b)],
          'armR': [('y', 30 * b), ('x', 12 * b)], 'handR': [('y', -18 * b)],
          'thighL': [('x', 22 * b)], 'shinL': [('x', 35 * b)], 'thighR': [('x', -8 * b)], 'shinR': [('x', 22 * b)],
          'skirt': [('x', -6 * b)], 'cape': [('x', -22 * b + 4)]}
    return pose(fk, root=(0, 0.02 * b, -0.06 * b))


def dance(t):
    # valse pesante : elle tourne d'un côté puis de l'autre, s'élève et redescend deux fois, la jupe suit en retard
    tw = K.wave(t)
    b = K.hop(t, 2)
    fk = {'root': [('z', 28 * tw)],
          'spine': [('y', 8 * K.wave(t, 1, 0.25)), ('x', -4)],
          'head': [('y', -6 * K.wave(t, 1, 0.25)), ('x', -10)],
          'armL': [('y', -85), ('x', -15)], 'forearmL': [('y', -55)], 'handL': [('y', -20)],
          'armR': [('y', 25), ('x', -20)], 'handR': [('y', -20)],
          'skirt': [('y', -9 * K.wave(t, 1, 0.12)), ('x', 4 * K.wave(t, 2))],
          'cape': [('x', 10 + 6 * b), ('y', -9 * K.wave(t, 1, 0.12))]}
    legs(fk, t * 2, lift=12, knee=18)
    return pose(fk, root=(0.04 * tw, 0, 0.035 * b - 0.02))


def sing(t):
    # le grand air : bouche grande ouverte, poitrine gonflée, bras écartés, vibrato qui fait trembler tout le corps
    v = K.wave(t, 6)
    v2 = K.wave(t, 6, 0.25)
    fk = {'spine': [('x', -10 + 1.5 * v), ('y', 1.5 * v2)],
          'head': [('x', -14 + 2.5 * v), ('y', -2 * v2)],
          'jaw': [('x', 28 + 4 * v)],
          'armL': [('y', -78 + 5 * v), ('x', -22)], 'forearmL': [('y', -30 + 6 * v)], 'handL': [('y', -15 + 8 * v)],
          'armR': [('y', 62 - 5 * v), ('x', -8)], 'handR': [('y', -38)],
          'skirt': [('y', 2 * v2), ('x', 1.5 * v)], 'cape': [('x', 6 + 3 * v)]}
    return pose(fk, root=(0.006 * v2, 0, 0.015 + 0.006 * v), scale=(1.035 + 0.012 * v, 1.035 + 0.012 * v, 1.01))


K.bake([('Idle', 60, idle), ('Walk', 32, walk), ('Run', 24, run), ('Warn', 16, warn), ('Hit', 30, bow),
        ('Dance', 32, dance), ('Sing', 30, sing)])


def probe(action, frame, names):
    arm = K.S['arm']
    for tr in arm.animation_data.nla_tracks:
        tr.mute = tr.name != action
    K.S['scene'].frame_set(frame)
    K.log(action, frame, {n: tuple(round(v, 3) for v in arm.pose.bones[n].tail) for n in names})
    for tr in arm.animation_data.nla_tracks:
        tr.mute = False


probe('Idle', 46, ['handL'])
probe('Warn', 16, ['handL', 'forearmL'])
tris = {o.name: sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
K.log('triangles', sum(tris.values()), {k: v for k, v in tris.items() if v > 300})

K.preview([
    ('face', 'Idle', 0, (0.3, -4.4, 1.35), (0, 0, 1.0)),
    ('troisquarts', 'Idle', 0, (2.8, -3.2, 2.1), (0, 0, 1.0)),
    ('visage', 'Idle', 0, (0.3, -1.7, 1.6), (0, 0, 1.5)),
    ('dessus', 'Idle', 0, (3.2, -3.2, 4.4), (0, 0, 0.9)),
    ('dos', 'Walk', 0, (-1.2, 4.2, 1.8), (0, 0, 0.95)),
    ('chant', 'Sing', 3, (1.6, -3.6, 1.6), (0, 0, 1.05)),
    ('chant_visage', 'Sing', 3, (0.5, -1.8, 1.7), (0, 0, 1.45)),
    ('gorge', 'Idle', 46, (1.2, -2.6, 1.6), (0, 0, 1.2)),
    ('alerte', 'Warn', 16, (1.4, -3.4, 1.5), (0, 0, 1.05)),
    ('salut', 'Hit', 14, (2.6, -3.0, 1.4), (0, 0, 0.9)),
    ('valse', 'Dance', 8, (1.0, -3.8, 1.5), (0, 0, 1.0)),
    ('marche', 'Walk', 8, (3.9, -1.4, 1.3), (0, 0, 1.0)),
])
K.export()
