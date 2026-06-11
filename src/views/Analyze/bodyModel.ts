import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Muscle regions used throughout the Analyze module.
 */
export const MUSCLE_REGIONS = [
  'chest', 'upper-back', 'lower-back', 'shoulders',
  'biceps', 'triceps', 'forearms', 'core',
  'glutes', 'quads', 'hamstrings', 'calves',
  'neck', 'hip-flexors',
] as const;

export type MuscleRegion = typeof MUSCLE_REGIONS[number];

/**
 * Map broad library muscleGroup values to our 14 fine-grained regions.
 * Secondary muscles also use this mapping.
 * When a group maps to multiple regions, activation is split equally.
 */
export const MUSCLE_GROUP_MAP: Record<string, MuscleRegion[]> = {
  // Broad groups from library.csv
  'chest':      ['chest'],
  'back':       ['upper-back', 'lower-back'],
  'shoulders':  ['shoulders'],
  'arms':       ['biceps', 'triceps', 'forearms'],
  'core':       ['core'],
  'legs':       ['quads', 'hamstrings', 'calves'],
  'glutes':     ['glutes'],
  'full-body':  ['chest', 'upper-back', 'lower-back', 'shoulders', 'biceps', 'triceps', 'core', 'glutes', 'quads', 'hamstrings'],
  // Fine-grained secondaryMuscles values
  'biceps':       ['biceps'],
  'triceps':      ['triceps'],
  'forearms':     ['forearms'],
  'quads':        ['quads'],
  'hamstrings':   ['hamstrings'],
  'calves':       ['calves'],
  'upper-back':   ['upper-back'],
  'lower-back':   ['lower-back'],
  'neck':         ['neck'],
  'hip-flexors':  ['hip-flexors'],
};

/**
 * Map GLB mesh names → our muscle regions.
 * Some GLB meshes map to the same region (e.g. abs + obliques → core).
 * Some regions have no mesh in the GLB (neck, hip-flexors) — data-only.
 */
const MESH_TO_REGION: Record<string, MuscleRegion> = {
  'chest':      'chest',
  'lats':       'upper-back',
  'traps':      'upper-back',   // traps also contributes to upper-back
  'lower_back': 'lower-back',
  'shoulders':  'shoulders',
  'biceps':     'biceps',
  'triceps':    'triceps',
  'forearms':   'forearms',
  'abs':        'core',
  'obliques':   'core',
  'glutes':     'glutes',
  'quads':      'quads',
  'hamstrings': 'hamstrings',
  'calves':     'calves',
};

/** Soft pastel for untrained muscles */
const DEFAULT_COLOR = new THREE.Color(0xc8c8d0);
/** Base body — light warm grey */
const BASE_COLOR = new THREE.Color(0xddd8d3);

/** Heatmap gradient: pastel lavender → warm peach → soft coral */
export function getHeatmapColor(intensity: number): THREE.Color {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped === 0) return DEFAULT_COLOR.clone();

  const cool  = new THREE.Color(0xb8b8d0); // soft lavender-grey
  const warm  = new THREE.Color(0xffb374); // warm peach
  const hot   = new THREE.Color(0xff6b6b); // soft coral

  if (clamped <= 0.5) {
    return cool.clone().lerp(warm, clamped * 2);
  }
  return warm.clone().lerp(hot, (clamped - 0.5) * 2);
}

/**
 * Load the GLB body model and tag each mesh with its muscle region name.
 * Returns the scene group ready to add to a Three.js scene.
 */
export async function loadBodyModel(): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const basePath = import.meta.env.BASE_URL ?? '/';
  const gltf = await loader.loadAsync(`${basePath}models/body.glb`);
  const model = gltf.scene;

  // Tag meshes with our region names and apply default material
  model.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;

    const region = MESH_TO_REGION[obj.name];
    if (region) {
      // Rename mesh to our region for raycasting/heatmap lookup
      obj.userData.glbName = obj.name; // keep original name
      obj.name = region;
      obj.material = new THREE.MeshStandardMaterial({
        color: DEFAULT_COLOR,
        roughness: 0.85,
        metalness: 0.02,
      });
    } else if (obj.name === 'base') {
      // Non-muscle base body
      obj.material = new THREE.MeshStandardMaterial({
        color: BASE_COLOR,
        roughness: 0.9,
        metalness: 0.0,
      });
    }
  });

  return model;
}

/**
 * Apply heatmap colours to the body model.
 * Multiple meshes may share the same region name — they all get the same colour.
 */
export function applyHeatmap(body: THREE.Group, scores: Map<MuscleRegion, number>) {
  body.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
    const region = obj.name as MuscleRegion;
    if (!MUSCLE_REGIONS.includes(region)) return;
    const intensity = scores.get(region) ?? 0;
    const mat = obj.material as THREE.MeshStandardMaterial;
    mat.color.copy(getHeatmapColor(intensity));
    mat.needsUpdate = true;
  });
}
