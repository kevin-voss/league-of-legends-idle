import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { getRigAnimationPaths, kaykitAtlasFor } from "./AssetCatalog.js";
import { debugError, debugLog } from "../core/DebugLog.js";
import { enableShadows, upgradeMaterials } from "./ModelUtils.js";

function resourcePathFor(url: string): string {
  const index = url.lastIndexOf("/");
  return index >= 0 ? url.slice(0, index + 1) : "/";
}

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface NatureManifest {
  available: boolean;
  trees: string[];
  rocks: string[];
  plants: string[];
  hills: string[];
  terrain: string[];
}

export class AssetManager {
  private readonly gltfLoader = new GLTFLoader();
  private readonly fbxLoader = new FBXLoader();
  private readonly cache = new Map<string, LoadedModel>();
  private readonly propCache = new Map<string, THREE.Group>();
  private natureManifest: NatureManifest | null = null;

  async loadModel(path: string, withMediumRigAnimations = false): Promise<LoadedModel> {
    const cacheKey = withMediumRigAnimations ? `${path}::rig-medium` : path;
    if (this.cache.has(cacheKey)) {
      return this.cloneCached(cacheKey);
    }

    const character = await this.loadGltf(path);
    const animations = [...character.animations];

    if (withMediumRigAnimations) {
      const rig = getRigAnimationPaths(path);
      const [movement, general] = await Promise.all([this.loadGltf(rig.movement), this.loadGltf(rig.general)]);
      animations.push(...movement.animations, ...general.animations);
    }

    const entry: LoadedModel = {
      scene: character.scene,
      animations
    };
    this.cache.set(cacheKey, entry);
    return this.cloneCached(cacheKey);
  }

  async loadProp(path: string): Promise<THREE.Group> {
    const cached = this.propCache.get(path);
    if (cached) {
      return cached.clone(true);
    }

    const isFbx = path.toLowerCase().endsWith(".fbx");
    debugLog("AssetManager", `loadProp ${path}`);
    const scene = isFbx ? (await this.loadFbx(path)).scene : (await this.loadGltf(path)).scene;
    if (!isFbx) {
      enableShadows(scene);
    }
    this.propCache.set(path, scene);
    return scene.clone(true);
  }

  async loadFbx(path: string): Promise<LoadedModel> {
    if (this.cache.has(path)) {
      return this.cloneCached(path);
    }

    const scene = await new Promise<THREE.Group>((resolve, reject) => {
      this.fbxLoader.setResourcePath(resourcePathFor(path));
      this.fbxLoader.load(
        path,
        (group) => resolve(group),
        undefined,
        (error) => {
          debugError("AssetManager", `FBX failed: ${path}`, error);
          reject(error);
        }
      );
    });

    upgradeMaterials(scene, kaykitAtlasFor(path));
    enableShadows(scene);
    const entry: LoadedModel = { scene, animations: [] };
    this.cache.set(path, entry);
    return this.cloneCached(path);
  }

  async getNatureManifest(): Promise<NatureManifest> {
    if (this.natureManifest) {
      return this.natureManifest;
    }

    try {
      const response = await fetch("/nature-manifest.json");
      if (response.ok) {
        this.natureManifest = (await response.json()) as NatureManifest;
        return this.natureManifest;
      }
    } catch {
      // Fall through to empty manifest.
    }

    this.natureManifest = { available: false, trees: [], rocks: [], plants: [], hills: [], terrain: [] };
    return this.natureManifest;
  }

  private async loadGltf(path: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
    return new Promise((resolve, reject) => {
      // GLB paths are absolute; setPath would duplicate the directory prefix.
      this.gltfLoader.setPath("");
      this.gltfLoader.load(
        path,
        (gltf) => {
          enableShadows(gltf.scene);
          resolve({ scene: gltf.scene, animations: gltf.animations });
        },
        undefined,
        (error) => {
          debugError("AssetManager", `GLTF failed: ${path}`, error);
          reject(error);
        }
      );
    });
  }

  private cloneCached(key: string): LoadedModel {
    const cached = this.cache.get(key);
    if (!cached) {
      throw new Error(`Missing cached asset: ${key}`);
    }
    return {
      scene: this.cloneSceneGraph(cached.scene),
      animations: cached.animations.map((clip) => clip.clone())
    };
  }

  /** Skinned meshes must use SkeletonUtils.clone — Object3D.clone breaks multi-instance rigs. */
  private cloneSceneGraph(scene: THREE.Group): THREE.Group {
    if (this.hasSkinnedMesh(scene)) {
      return SkeletonUtils.clone(scene) as THREE.Group;
    }
    return scene.clone(true);
  }

  private hasSkinnedMesh(root: THREE.Object3D): boolean {
    let found = false;
    root.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        found = true;
      }
    });
    return found;
  }
}
