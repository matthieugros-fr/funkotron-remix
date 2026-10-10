// Tomates lancées et cadeaux livrés en parachute.
import * as THREE from 'three';
import { presentModel } from './pickups.js';
import { topOf } from './terrain3d.js';
import { sound } from './audio.js';

const tomatoGeo = new THREE.SphereGeometry(0.13, 10, 8);
const tomatoMat = new THREE.MeshLambertMaterial({ color: '#e8281f' });
const leafMat = new THREE.MeshLambertMaterial({ color: '#3f9a3d' });

export class Tomatoes {
  constructor(scene) { this.scene = scene; this.list = []; }

  throw(player) {
    const m = new THREE.Mesh(tomatoGeo, tomatoMat);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.05, 5), leafMat); leaf.position.y = 0.13; m.add(leaf);
    m.castShadow = true;
    const h = player.heading, d = { x: Math.sin(h), z: Math.cos(h) };
    m.position.set(player.pos.x + d.x * 0.3, player.pos.y + 1.0, player.pos.z + d.z * 0.3);
    this.scene.add(m);
    sound.play('tomate_lancer');
    this.list.push({ m, vx: d.x * 7.5, vy: 3.2, vz: d.z * 7.5, level: player.level, life: 3 });
  }

  update(dt, world, fx) {
    this.list = this.list.filter((t) => {
      t.vy -= 14 * dt; t.life -= dt;
      const p = t.m.position;
      p.x += t.vx * dt; p.y += t.vy * dt; p.z += t.vz * dt;
      t.m.rotation.x += dt * 12;
      const ty = world.type(t.level, p.x, p.z);
      const ground = ty ? world.levels[t.level].y + topOf(ty) : -Infinity;
      if (p.y <= ground + 0.1 || t.life <= 0) {
        if (p.y <= ground + 0.1) {
          sound.play('tomate_splat', { vol: 0.8 });
          for (let k = 0; k < 14; k++) {
            const a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.6;
            fx.spawn(p.x, ground + 0.1, p.z, Math.cos(a) * s, 1.5 + Math.random() * 2, Math.sin(a) * s, 0.5, k % 3 ? '#e8281f' : '#ffb0a0', 12);
          }
        }
        this.scene.remove(t.m);
        return false;
      }
      return true;
    });
  }

  clear() { for (const t of this.list) this.scene.remove(t.m); this.list = []; }
}

// Le facteur de l'espace : le cadeau commandé descend en parachute à côté de ToeJam.
export class Delivery {
  constructor(g, type) {
    const p = g.player, k = p.level, w = g.world;
    const spot = w.nearestLand(k, p.pos.x + Math.sin(p.heading) * 1.6, p.pos.z + Math.cos(p.heading) * 1.6);
    this.g = g; this.k = k; this.type = type; this.x = spot.x; this.z = spot.z;
    this.ground = w.levels[k].y + topOf(w.type(k, spot.x, spot.z));
    const grp = (this.m = new THREE.Group());
    grp.add(presentModel(w.levels[k].mats, g.bag.wrapOf[type]));
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ff5fd2', side: THREE.DoubleSide }));
    canopy.position.y = 1.5; canopy.scale.y = 0.6; grp.add(canopy);
    const cord = new THREE.LineBasicMaterial({ color: '#ffffff' });
    for (const [x, z] of [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]]) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(x, 1.5, z)]);
      grp.add(new THREE.Line(geo, cord));
    }
    grp.position.set(this.x, this.ground + 9, this.z);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scene.add(grp);
    this.t = 0;
    sound.play('livraison', { vol: 0.8 });
  }

  update(dt) {
    const m = this.m;
    this.t += dt;
    m.position.y -= dt * 2.4;
    m.rotation.z = Math.sin(this.t * 2) * 0.12;
    m.position.x = this.x + Math.sin(this.t * 1.3) * 0.2;
    if (m.position.y > this.ground) return false;
    this.g.scene.remove(m);
    this.g.world.addPresent(this.k, this.x, this.z, this.type);
    this.g.fx.dust(new THREE.Vector3(this.x, this.ground, this.z), 10);
    return true;
  }
}
