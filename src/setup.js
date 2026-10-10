// Gestion des couleurs standard de Three.js : on calcule la lumière en linéaire,
// la conversion vers l'écran se fait dans la passe finale (render.js).
import * as THREE from 'three';
THREE.ColorManagement.enabled = true;
