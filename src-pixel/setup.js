// Doit être importé en premier : les couleurs du pixel art passent telles quelles,
// sans conversion d'espace colorimétrique.
import * as THREE from 'three';
THREE.ColorManagement.enabled = false;
