import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { TapEvent } from "@/state/project";
import { drawTaps } from "./taps";

// A real, photoreal iPhone rendered with three.js to an offscreen canvas, which
// the 2D compositor draws into the scene. Only used when a Rotate segment has 3D
// enabled — the default phone is the flat 2D frame (see render-frame). The model
// is an "iPhone 15 Pro Max" by polyman (Sketchfab), CC BY 4.0, bundled at
// public/models/iphone.glb; its video screen is mesh "xXDHkMplTIDAXLN".

const MODEL_URL = import.meta.env.BASE_URL + "models/iphone.glb";
const DRACO_PATH = import.meta.env.BASE_URL + "draco/";
const SCREEN_MESH_NAME = "xXDHkMplTIDAXLN";

const RENDER_SIZE = 2048; // offscreen resolution — high, so tilt/zoom stays sharp
const TARGET_H = 2.0; // model is normalised to this height in world units
const FOV = 22;
/** Phone height as a fraction of the render canvas at rest — leaves tilt headroom. */
export const FRAME_FRACTION = 0.6;

// Screen paint surface — portrait, matching a real iPhone recording (≈0.462) so
// the video maps 1:1 with no resampling before it hits the GPU.
const SCREEN_TEX_W = 1170;
const SCREEN_TEX_H = 2532;

interface Kit {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  screenCanvas: HTMLCanvasElement;
  screenCtx: CanvasRenderingContext2D;
  screenTex: THREE.CanvasTexture;
}
let kit: Kit | null = null;
let failed = false; // WebGL unavailable
let modelRoot: THREE.Object3D | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * A soft, blurred phone-shaped shadow blob on a plane behind the phone. Because
 * it lives in the (transparent) 3D render and tracks the group, it composites
 * cleanly over the background and can never leave an opaque "hole".
 */
function makeContactShadow(): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 1024;
  const g = cv.getContext("2d");
  if (g) {
    g.filter = "blur(50px)";
    g.fillStyle = "rgba(0,0,0,0.9)";
    const w = 300;
    const h = 780;
    const x = (512 - w) / 2;
    const y = (1024 - h) / 2;
    const r = 130;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(TARGET_H * 0.62, TARGET_H * 1.18), mat);
  plane.position.set(0.03 * TARGET_H, -0.04 * TARGET_H, -0.45);
  return plane;
}

function init(): Kit | null {
  if (kit) return kit;
  if (failed) return null;
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(RENDER_SIZE, RENDER_SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);
    const viewH = TARGET_H / FRAME_FRACTION;
    camera.position.set(0, 0, viewH / (2 * Math.tan((FOV * Math.PI) / 180 / 2)));
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.0);
    rim.position.set(5, -2, 3);
    scene.add(rim);

    const group = new THREE.Group();
    group.add(makeContactShadow()); // soft shadow that tracks the phone in 3D
    scene.add(group);

    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = SCREEN_TEX_W;
    screenCanvas.height = SCREEN_TEX_H;
    const screenCtx = screenCanvas.getContext("2d");
    if (!screenCtx) throw new Error("no 2d ctx for screen");
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.flipY = true; // screen UVs + the model's π Y-flip land the video upright
    // Trilinear + anisotropic filtering keeps the screen sharp at oblique angles
    // (the whole point of rotating it). Plain LinearFilter with no mipmaps made
    // anisotropy a no-op, so tilted frames undersampled → the "degraded" look.
    screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    screenTex.minFilter = THREE.LinearMipmapLinearFilter;
    screenTex.magFilter = THREE.LinearFilter;
    screenTex.generateMipmaps = true;

    kit = { renderer, scene, camera, group, screenCanvas, screenCtx, screenTex };
    return kit;
  } catch {
    failed = true; // WebGL unavailable — caller falls back to the 2D phone.
    return null;
  }
}

/** Pick the display mesh: the known screen node, else the brightest-emissive flat mesh. */
function findScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  const named = root.getObjectByName(SCREEN_MESH_NAME);
  if (named instanceof THREE.Mesh) return named;
  let best: THREE.Mesh | null = null;
  let bestScore = -1;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial | undefined;
    const emissive = m?.emissive ? m.emissive.r + m.emissive.g + m.emissive.b : 0;
    if (emissive > bestScore) {
      bestScore = emissive;
      best = o;
    }
  });
  return best;
}

/**
 * Load the iPhone model once (lazily). Resolves when the model is ready to
 * render — or immediately if WebGL is unavailable (caller then uses the 2D
 * phone). Safe to call repeatedly; export awaits it before rendering.
 */
export function ensurePhone3D(): Promise<void> {
  if (loadPromise) return loadPromise;
  const k = init();
  if (!k) return Promise.resolve(); // no WebGL
  loadPromise = new Promise<void>((resolve) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      MODEL_URL,
      (gltf) => {
        const root = gltf.scene;
        k.group.add(root);
        root.rotation.y = Math.PI; // face the screen toward the camera

        // Normalise: centre at the origin and scale to TARGET_H tall.
        root.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = TARGET_H / size.y;
        root.scale.setScalar(s);
        root.position.set(-center.x * s, -center.y * s, -center.z * s);

        // Map the video onto the display: unlit, full-bright, like a real screen.
        const screen = findScreenMesh(root);
        if (screen) {
          screen.material = new THREE.MeshBasicMaterial({ map: k.screenTex, toneMapped: false });
        }
        modelRoot = root;
        draco.dispose();
        resolve();
      },
      undefined,
      () => {
        // Model failed to load — leave modelRoot null so we keep the 2D phone.
        draco.dispose();
        resolve();
      },
    );
  });
  return loadPromise;
}

interface Phone3DParams {
  video: HTMLVideoElement | null;
  taps: TapEvent[];
  t: number;
  color: string;
  rotateX: number; // degrees
  rotateY: number;
  roll: number;
}

/**
 * Render the 3D phone and return the offscreen canvas, or null if the model
 * isn't ready yet / WebGL is unavailable (caller draws the 2D phone). Kicks off
 * the lazy load on first call.
 */
export function renderPhone3D(p: Phone3DParams): HTMLCanvasElement | null {
  const k = init();
  if (!k) return null;
  if (!modelRoot) {
    void ensurePhone3D();
    return null;
  }

  // Paint the screen: dark base → video (cover) → taps. Corners/rounding come
  // from the display mesh geometry, so no clip is needed here.
  const { screenCtx: c, screenCanvas: sc } = k;
  c.clearRect(0, 0, sc.width, sc.height);
  c.fillStyle = "#111114";
  c.fillRect(0, 0, sc.width, sc.height);
  if (p.video && p.video.videoWidth > 0) {
    const vr = p.video.videoWidth / p.video.videoHeight;
    const sr = sc.width / sc.height;
    let dw = sc.width;
    let dh = sc.height;
    if (vr > sr) dw = sc.height * vr;
    else dh = sc.width / vr;
    try {
      c.drawImage(p.video, (sc.width - dw) / 2, (sc.height - dh) / 2, dw, dh);
    } catch {
      /* frame not ready — keep the dark fill */
    }
  }
  drawTaps(c, p.taps, p.t, { x: 0, y: 0, w: sc.width, h: sc.height });
  k.screenTex.needsUpdate = true;

  k.group.rotation.set(
    (p.rotateX * Math.PI) / 180,
    (p.rotateY * Math.PI) / 180,
    (p.roll * Math.PI) / 180,
  );
  k.renderer.render(k.scene, k.camera);
  return k.renderer.domElement;
}
