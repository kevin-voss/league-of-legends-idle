import * as THREE from "three";
import { debugLog } from "../core/DebugLog.js";

const textureCache = new Map<string, THREE.Texture>();

export function enableShadows(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.frustumCulled = false;
    }
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export function getHorizontalFootprint(root: THREE.Object3D): { x: number; z: number; y: number } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return { x: size.x, z: size.z, y: size.y };
}

export function loadKaykitAtlas(atlasUrl: string): THREE.Texture {
  const cached = textureCache.get(atlasUrl);
  if (cached) {
    return cached;
  }

  const texture = new THREE.TextureLoader().load(atlasUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(atlasUrl, texture);
  return texture;
}

/** KayKit FBX uses Phong materials without maps wired — upgrade to lit Standard + atlas. */
export function upgradeMaterials(root: THREE.Object3D, atlasUrl?: string): void {
  const atlas = atlasUrl ? loadKaykitAtlas(atlasUrl) : null;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const upgraded = sourceMaterials.map((source) => {
      const color =
        "color" in source && source.color instanceof THREE.Color ? source.color.clone() : new THREE.Color(0xffffff);
      const existingMap = "map" in source ? source.map : null;
      const map = existingMap ?? atlas;

      return new THREE.MeshStandardMaterial({
        map: map ?? undefined,
        color,
        roughness: 0.82,
        metalness: 0.05,
        side: THREE.DoubleSide
      });
    });

    child.material = upgraded.length === 1 ? upgraded[0]! : upgraded;
  });
}

/** Rotate props so their thinnest axis points up (lies on the XZ ground plane). */
export function layFlatOnGround(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const before = getHorizontalFootprint(root);
  const thinnest = Math.min(before.x, before.y, before.z);
  if (thinnest === before.y) {
    root.rotation.x = -Math.PI / 2;
  } else if (thinnest === before.x) {
    root.rotation.z = Math.PI / 2;
  } else if (thinnest === before.z) {
    root.rotation.x = Math.PI / 2;
  }
  root.updateMatrixWorld(true);
  debugLog("ModelUtils", "layFlatOnGround", { before, after: getHorizontalFootprint(root) });
}

/**
 * Uniform scale so the model's largest axis fits `targetSize`, then sit on y=0.
 * Uses max(x,y,z) — scaling only on XZ makes tall thin meshes (KayKit trees) enormous.
 */
export function fitModelToFootprint(root: THREE.Object3D, targetSize: number): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.multiplyScalar(targetSize / longest);

  const grounded = new THREE.Box3().setFromObject(root);
  root.position.y -= grounded.min.y;
}

export function fitGroundProp(root: THREE.Object3D, targetWidth: number, label?: string): void {
  layFlatOnGround(root);
  fitModelToFootprint(root, targetWidth);
  if (label) {
    debugLog("ModelUtils", `fitGroundProp ${label}`, getHorizontalFootprint(root));
  }
}

/**
 * KayKit hex tiles are already upright (thin in Y). Do not layFlat — that turns them vertical.
 * Scales to tile width on XZ and clamps height so ground stays below structures.
 */
/** Lane path tiles — upright meshes are laid flat before scaling (coast/river variants). */
export function fitLanePathTile(root: THREE.Object3D, tileWidth: number, maxHeight = 0.16): void {
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const horizontal = Math.max(size.x, size.z, 0.001);
  if (size.y > horizontal * 0.85) {
    layFlatOnGround(root);
  }
  fitHexTileOnGround(root, tileWidth, maxHeight);
}

export function fitHexTileOnGround(root: THREE.Object3D, tileWidth: number, maxHeight = 0.14): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const horizontal = Math.max(size.x, size.z, 0.001);
  const scale = tileWidth / horizontal;
  root.scale.multiplyScalar(scale);

  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  const scaledSize = scaled.getSize(new THREE.Vector3());
  if (scaledSize.y > maxHeight) {
    root.scale.y *= maxHeight / scaledSize.y;
  }

  snapObjectToGround(root);
}

/** Align the lowest point of a prop to y = 0. */
export function snapObjectToGround(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y;
}

export function setModelOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
      }
    }
  });
}
