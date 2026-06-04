import * as THREE from "three";
import { debugLog } from "./DebugLog.js";
import { WORLD_MAP_CENTER_X, WORLD_MAP_CENTER_Z, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from "./CoordinateMap.js";

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.75;

export class ThreeEngine {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly baseFrustum: number;
  private readonly lookOffset = new THREE.Vector3(14, 18, 14);
  private readonly unprojectA = new THREE.Vector3();
  private readonly unprojectB = new THREE.Vector3();
  private zoom = 1;
  private panX = 0;
  private panZ = 0;
  private aspect = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2420);

    this.baseFrustum = Math.max(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) * 0.58;
    this.camera = new THREE.OrthographicCamera(-this.baseFrustum, this.baseFrustum, this.baseFrustum, -this.baseFrustum, 0.1, 200);
    this.applyCameraTransform();

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
      frustum: this.baseFrustum,
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

    this.aspect = width / Math.max(height, 1);
    this.applyProjection();
    debugLog("ThreeEngine", "resize", { width, height, aspect: this.aspect });
  }

  zoomBy(factor: number, anchorX: number, anchorY: number, viewWidth: number, viewHeight: number): void {
    const nextZoom = THREE.MathUtils.clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === this.zoom) {
      return;
    }

    const worldBefore = this.screenToGround(anchorX, anchorY, viewWidth, viewHeight);
    this.zoom = nextZoom;
    this.applyProjection();
    const worldAfter = this.screenToGround(anchorX, anchorY, viewWidth, viewHeight);
    this.panX += worldBefore.x - worldAfter.x;
    this.panZ += worldBefore.z - worldAfter.z;
    this.applyCameraTransform();
  }

  panScreenDelta(deltaX: number, deltaY: number, viewWidth: number, viewHeight: number): void {
    const before = this.screenToGround(viewWidth * 0.5, viewHeight * 0.5, viewWidth, viewHeight);
    const after = this.screenToGround(
      viewWidth * 0.5 + deltaX,
      viewHeight * 0.5 + deltaY,
      viewWidth,
      viewHeight
    );
    this.panX += before.x - after.x;
    this.panZ += before.z - after.z;
    this.applyCameraTransform();
  }

  resetCamera(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panZ = 0;
    this.applyProjection();
    this.applyCameraTransform();
  }

  private screenToGround(screenX: number, screenY: number, viewWidth: number, viewHeight: number): THREE.Vector3 {
    const ndcX = (screenX / Math.max(viewWidth, 1)) * 2 - 1;
    const ndcY = 1 - (screenY / Math.max(viewHeight, 1)) * 2;
    this.unprojectA.set(ndcX, ndcY, 0).unproject(this.camera);
    this.unprojectB.set(ndcX, ndcY, 1).unproject(this.camera);
    const dir = this.unprojectB.sub(this.unprojectA);
    const t = Math.abs(dir.y) < 0.0001 ? 0 : -this.unprojectA.y / dir.y;
    return this.unprojectA.clone().addScaledVector(dir, t);
  }

  private applyProjection(): void {
    const frustum = this.baseFrustum / this.zoom;
    this.camera.left = -frustum * this.aspect;
    this.camera.right = frustum * this.aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
  }

  private applyCameraTransform(): void {
    const focusX = WORLD_MAP_CENTER_X + this.panX;
    const focusZ = WORLD_MAP_CENTER_Z + this.panZ;
    this.camera.position.set(
      focusX + this.lookOffset.x,
      this.lookOffset.y,
      focusZ + this.lookOffset.z
    );
    this.camera.lookAt(focusX, 0, focusZ);
    this.camera.updateMatrixWorld();
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
