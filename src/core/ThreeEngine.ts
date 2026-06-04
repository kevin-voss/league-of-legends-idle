import * as THREE from "three";
import { debugLog } from "./DebugLog.js";
import { WORLD_MAP_CENTER_X, WORLD_MAP_CENTER_Z, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from "./CoordinateMap.js";

export class ThreeEngine {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver | null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2420);

    const frustum = Math.max(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) * 0.58;
    this.camera = new THREE.OrthographicCamera(-frustum, frustum, frustum, -frustum, 0.1, 200);
    this.camera.position.set(WORLD_MAP_CENTER_X + 14, 18, WORLD_MAP_CENTER_Z + 14);
    this.camera.lookAt(WORLD_MAP_CENTER_X, 0, WORLD_MAP_CENTER_Z);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.setupLighting();

    this.resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => this.resize(canvas))
      : null;
    this.resizeObserver?.observe(canvas.parentElement ?? canvas);
    this.resize(canvas);
    debugLog("ThreeEngine", "initialized", {
      frustum: Math.max(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) * 0.58,
      camera: this.camera.position.toArray()
    });
  }

  private setupLighting(): void {
    const sun = new THREE.DirectionalLight(0xffffff, 1.45);
    sun.position.set(WORLD_MAP_CENTER_X + 8, 22, WORLD_MAP_CENTER_Z + 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadowSpan = Math.max(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) * 0.65;
    sun.shadow.camera.left = -shadowSpan;
    sun.shadow.camera.right = shadowSpan;
    sun.shadow.camera.top = shadowSpan;
    sun.shadow.camera.bottom = -shadowSpan;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);

    const ambient = new THREE.AmbientLight(0xd8e8df, 0.75);
    this.scene.add(ambient);

    const fill = new THREE.HemisphereLight(0xb8d4c8, 0x1a241c, 0.35);
    this.scene.add(fill);
  }

  resize(canvas: HTMLCanvasElement): void {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? canvas.clientWidth ?? 960;
    const height = parent?.clientHeight ?? canvas.clientHeight ?? width;
    this.renderer.setSize(width, height, false);

    const aspect = width / Math.max(height, 1);
    const frustum = Math.max(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) * 0.58;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
    debugLog("ThreeEngine", "resize", { width, height, aspect });
  }

  projectToScreen(world: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const projected = world.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const visible = projected.z > -1 && projected.z < 1;
    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      visible
    };
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}
