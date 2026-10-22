import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type BiomeId = 'forest' | 'canyon' | 'autumn' | 'twilight';
export type TimeOfDay = 'dawn' | 'noon' | 'sunset' | 'night';
export type CameraMode = 'close' | 'medium' | 'panoramic' | 'cinematic';

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  icon: string;
  subtitle: string;
  skyZenith: number;
  skyHorizon: number;
  fogColor: number;
  sunColor: number;
  ambientColor: number;
  sunIntensity: number;
  groundColor: number;
  cliffColor: number;
  peakColor: number;
  treeLeavesColors: number[];
  trunkColor: number;
  bushColors: number[];
  rockColor: number;
  plantColors: number[];
  mountainColor: number;
  grassColor: number;
}

// Deterministic 2D Noise generator for infinite procedural terrain
class ProceduralNoise {
  private perm: number[] = new Array(512);

  constructor(seed = 9821) {
    this.reseed(seed);
  }

  reseed(seed: number) {
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 11) % 2147483647;
      const j = s % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }

  fbm(x: number, y: number, octaves = 4, persistence = 0.5, lacunarity = 2.0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

interface ChunkRecord {
  mesh: THREE.Mesh;
  propsGroup: THREE.Group;
  chunkX: number;
  chunkZ: number;
}

@Component({
  selector: 'app-lowpolyopenworld',
  imports: [CommonModule, RouterLink],
  templateUrl: './lowpolyopenworld.html',
  styleUrl: './lowpolyopenworld.scss',
  host: {
    ngSkipHydration: 'true',
  },
})
export class Lowpolyopenworld implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportContainer') containerRef!: ElementRef<HTMLDivElement>;

  // Biome presets matching reference photos (Desert Canyon & Lush Emerald Forest)
  readonly biomes: BiomeConfig[] = [
    {
      id: 'forest',
      name: 'Lush Emerald Valley',
      icon: '🌲',
      subtitle: 'Dense stylized forest with rolling hills, flowering flora & granite boulders',
      skyZenith: 0x4a90e2,
      skyHorizon: 0xd4f1f4,
      fogColor: 0xbad8af,
      sunColor: 0xfffbe6,
      ambientColor: 0x3d5a45,
      sunIntensity: 1.5,
      groundColor: 0x479c26,
      cliffColor: 0x415b36,
      peakColor: 0x76946e,
      treeLeavesColors: [0x2f7d2f, 0x3d9435, 0x4bb341, 0x246325],
      trunkColor: 0x935c2e,
      bushColors: [0x3d8c2e, 0x4ea63a, 0x2e6b22],
      rockColor: 0x6e7b84,
      plantColors: [0x9c27b0, 0xe91e63, 0xffeb3b, 0x4caf50],
      mountainColor: 0x5a7550,
      grassColor: 0x43a047,
    },
    {
      id: 'canyon',
      name: 'Red Rock Canyon',
      icon: '🏜️',
      subtitle: 'Sunbaked sandstone ridges, rugged bluffs, dry shrubs & desert flora',
      skyZenith: 0x4082c4,
      skyHorizon: 0xfcb074,
      fogColor: 0xf5a266,
      sunColor: 0xffe2b5,
      ambientColor: 0x613620,
      sunIntensity: 1.7,
      groundColor: 0xde6824,
      cliffColor: 0x993710,
      peakColor: 0xf28b49,
      treeLeavesColors: [0x7b8535, 0x949e41, 0x606a2b],
      trunkColor: 0x6d4023,
      bushColors: [0xb8a243, 0x928135, 0x6b772b],
      rockColor: 0xb55325,
      plantColors: [0xd6993a, 0xe6a147, 0x828a38],
      mountainColor: 0xc25721,
      grassColor: 0xc9a244,
    },
    {
      id: 'autumn',
      name: 'Golden Autumn Bluffs',
      icon: '🍂',
      subtitle: 'Warm amber groves, scarlet foliage, fallen timber & glowing horizons',
      skyZenith: 0x3b6ea5,
      skyHorizon: 0xffd194,
      fogColor: 0xf5c382,
      sunColor: 0xffad42,
      ambientColor: 0x5e3a24,
      sunIntensity: 1.45,
      groundColor: 0xb35a17,
      cliffColor: 0x592e14,
      peakColor: 0xf09848,
      treeLeavesColors: [0xd84315, 0xef6c00, 0xf57c00, 0xfbc02d],
      trunkColor: 0x4e342e,
      bushColors: [0xe65100, 0xf57f17, 0xef6c00],
      rockColor: 0x6d4c41,
      plantColors: [0xff5722, 0xff9800, 0xffc107],
      mountainColor: 0x8d4722,
      grassColor: 0xd4882c,
    },
    {
      id: 'twilight',
      name: 'Bioluminescent Twilight',
      icon: '🌌',
      subtitle: 'Mystic nocturnal oasis with ethereal neon canopies & glowing spores',
      skyZenith: 0x070b19,
      skyHorizon: 0x1b1c3d,
      fogColor: 0x121526,
      sunColor: 0x76a0ff,
      ambientColor: 0x1f1938,
      sunIntensity: 0.9,
      groundColor: 0x1a2639,
      cliffColor: 0x0f172a,
      peakColor: 0x334155,
      treeLeavesColors: [0x00f2fe, 0x4facfe, 0x9d4edd, 0x7209b7],
      trunkColor: 0x1e1e2f,
      bushColors: [0x4361ee, 0x3a0ca3, 0x7209b7],
      rockColor: 0x334155,
      plantColors: [0x00f2fe, 0xff007f, 0x7000ff],
      mountainColor: 0x1e293b,
      grassColor: 0x3b82f6,
    },
  ];

  activeBiomeId: BiomeId = 'forest';
  activeTimeOfDay: TimeOfDay = 'noon';
  activeCameraMode: CameraMode = 'medium';

  // HUD & Stats
  playerStats = {
    posX: '0.0',
    posY: '0.0',
    posZ: '0.0',
    speed: '0',
    state: 'Idle',
    activeChunks: 0,
    assetsRendered: 0,
    fps: 60,
  };

  // Asset Loading states
  isLoadingAssets = true;
  loadingProgress = 0;
  loadingStatusText = 'Initializing Low-Poly World Engine...';

  isHelpOpen = true;
  miniMapAngle = 0;
  cinematicOrbitAngle = 0;

  // Touch virtual controls state
  touchJoystick = {
    active: false,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
    moveX: 0,
    moveZ: 0,
  };

  private isBrowser = false;
  private animationId: number | null = null;
  private noise = new ProceduralNoise(7432);

  // Three.js Core
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private skyDome!: THREE.Mesh;
  private waterPlane!: THREE.Mesh;
  private starsPoints!: THREE.Points;
  private firefliesGroup: THREE.Points | null = null;

  // Character
  private characterGroup!: THREE.Group;
  private charTorso!: THREE.Group;
  private charHead!: THREE.Group;
  private charLeftArm!: THREE.Group;
  private charRightArm!: THREE.Group;
  private charLeftLeg!: THREE.Group;
  private charRightLeg!: THREE.Group;
  private charLanternLight!: THREE.PointLight;

  // Movement & Physics
  private charPos = new THREE.Vector3(0, 0, 0);
  private charVelocity = new THREE.Vector3(0, 0, 0);
  private charRotation = 0;
  private targetRotation = 0;
  private isGrounded = true;
  private animTimer = 0;
  private isMoving = false;
  private isSprinting = false;

  // Camera Orbit
  private cameraYaw = 0;
  private cameraPitch = 0.35;
  private cameraDistance = 7.5;
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Chunks & Assets
  private readonly CHUNK_SIZE = 40;
  private readonly CHUNK_SEGMENTS = 14;
  private readonly VIEW_RADIUS = 3; // (2*3+1)^2 = 49 chunks grid
  private loadedChunks = new Map<string, ChunkRecord>();
  private currentChunkCoord = { x: 0, z: 0 };

  // Asset Templates Cache loaded from public/OpenworldLowpoly/
  private assetTemplates: Map<string, THREE.Group> = new Map();
  private totalAssetsCount = 0;

  // Input states
  private keys: { [key: string]: boolean } = {};
  private lastTime = 0;
  private frameCount = 0;
  private lastFpsTime = 0;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  get currentBiome(): BiomeConfig {
    return this.biomes.find((b) => b.id === this.activeBiomeId) || this.biomes[0];
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.initScene();
      this.initCharacter();
      this.initEnvironment();
      this.loadAllFbxAssets().then(() => {
        this.isLoadingAssets = false;
        this.updateChunks(true);

        // Snap character to ground
        const startGroundY = this.getTerrainHeight(0, 0);
        this.charPos.set(0, startGroundY + 0.1, 0);
        this.characterGroup.position.copy(this.charPos);

        this.lastTime = performance.now();
        this.lastFpsTime = performance.now();
        this.animate();
        this.cdr.detectChanges();
      });
    }
  }

  ngOnDestroy() {
    if (this.animationId !== null && this.isBrowser) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.loadedChunks.clear();
    this.assetTemplates.clear();
  }

  // --------------------------------------------------------------------------
  // ASSET LOADING PIPELINE (FBX Assets from /OpenworldLowpoly/)
  // --------------------------------------------------------------------------
  private async loadAllFbxAssets(): Promise<void> {
    const assetFiles = [
      'Tree_1',
      'Tree_2',
      'Tree_3',
      'Bush_1',
      'Bush_2',
      'Bush_3',
      'Rock_1',
      'Rock_2',
      'Rock_3',
      'Rock_4',
      'Rock_5',
      'Rock_6',
      'Stone_1',
      'Mounting_1',
      'Mounting_2',
      'Mounting_3',
      'Plant_1',
      'Plant_2',
      'Plant_3',
      'Plant_4',
      'Plant_5',
      'Plant_6',
      'Plant_7',
      'Log_1',
      'Log_2',
      'Log_3',
      'Grass_1',
      'Grass_2',
      'Terrain_1',
      'Terrain_2',
      'Environment_1',
    ];

    const loader = new FBXLoader();
    let loadedCount = 0;

    for (const name of assetFiles) {
      this.loadingStatusText = `Streaming Low-Poly Asset: ${name}.fbx...`;
      this.loadingProgress = Math.round((loadedCount / assetFiles.length) * 100);
      this.cdr.detectChanges();

      try {
        const fbx = await loader.loadAsync(`/OpenworldLowpoly/${name}.fbx`);
        const template = this.prepareFbxModel(name, fbx);
        this.assetTemplates.set(name, template);
      } catch (err) {
        console.warn(`Could not load FBX asset: ${name}, using procedural fallback.`, err);
        const fallback = this.createFallbackModel(name);
        this.assetTemplates.set(name, fallback);
      }

      loadedCount++;
    }

    this.loadingProgress = 100;
    this.loadingStatusText = 'Generating Procedural World Chunks...';
    this.cdr.detectChanges();
  }

  /**
   * Optimize and configure loaded FBX for crisp low-poly flat-shading
   * Converts FBX centimeter scale (100 units = 1m) to world meter units
   */
  private prepareFbxModel(name: string, model: THREE.Group): THREE.Group {
    // 1. Scale from FBX centimeters (100 units = 1m) to Three.js world meters
    model.scale.setScalar(0.01);

    // 2. Normalization & flat-shading
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
        }

        // Apply vibrant flat-shading material preserving original aesthetic
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => this.tuneMaterial(name, m));
          } else {
            mesh.material = this.tuneMaterial(name, mesh.material);
          }
        }
      }
    });

    // 3. Auto-center model at base using world bounding box after 0.01 scaling
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Shift model inside a wrapper so pivot (0,0,0) is at bottom center (Y = 0)
    model.position.set(-center.x, -box.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(model);
    return wrapper;
  }

  private tuneMaterial(assetName: string, mat: THREE.Material): THREE.Material {
    const orig = mat as any;
    const std = new THREE.MeshStandardMaterial({
      color: orig.color ? orig.color.clone() : new THREE.Color(0xffffff),
      map: orig.map || null,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.05,
    });
    return std;
  }

  /**
   * Procedural low-poly fallback geometry if any FBX is missing
   */
  private createFallbackModel(name: string): THREE.Group {
    const group = new THREE.Group();
    const isTree = name.startsWith('Tree');
    const isRock = name.startsWith('Rock') || name.startsWith('Stone');
    const isMountain = name.startsWith('Mounting');

    if (isTree) {
      const trunkGeom = new THREE.CylinderGeometry(0.12, 0.22, 1.5, 5);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x795548,
        flatShading: true,
        roughness: 0.9,
      });
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 0.75;
      trunk.castShadow = true;
      group.add(trunk);

      const foliageGeom = new THREE.DodecahedronGeometry(0.9, 0);
      const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x388e3c,
        flatShading: true,
        roughness: 0.8,
      });
      const foliage = new THREE.Mesh(foliageGeom, foliageMat);
      foliage.position.y = 2.0;
      foliage.castShadow = true;
      group.add(foliage);
    } else if (isMountain) {
      const geom = new THREE.ConeGeometry(5, 8, 5);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8d6e63,
        flatShading: true,
      });
      const m = new THREE.Mesh(geom, mat);
      m.position.y = 4;
      group.add(m);
    } else if (isRock) {
      const geom = new THREE.DodecahedronGeometry(0.8, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x78909c,
        flatShading: true,
      });
      const r = new THREE.Mesh(geom, mat);
      r.position.y = 0.4;
      group.add(r);
    } else {
      const geom = new THREE.SphereGeometry(0.5, 4, 3);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x4caf50,
        flatShading: true,
      });
      const b = new THREE.Mesh(geom, mat);
      b.position.y = 0.3;
      group.add(b);
    }
    return group;
  }

  // --------------------------------------------------------------------------
  // THREE.JS SCENE SETUP
  // --------------------------------------------------------------------------
  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Scene
    this.scene = new THREE.Scene();
    const biome = this.currentBiome;
    this.scene.background = new THREE.Color(biome.skyHorizon);
    this.scene.fog = new THREE.FogExp2(biome.fogColor, 0.0075);

    // Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.updateCameraTransform();

    // Lighting
    this.ambientLight = new THREE.AmbientLight(biome.ambientColor, 0.7);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(biome.skyZenith, biome.groundColor, 0.6);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(biome.sunColor, biome.sunIntensity);
    this.dirLight.position.set(60, 100, 40);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 280;
    const d = 55;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  private initEnvironment(): void {
    const biome = this.currentBiome;

    // Atmospheric Skydome
    const skyGeom = new THREE.SphereGeometry(450, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: biome.skyHorizon,
      side: THREE.BackSide,
    });
    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.skyDome);

    // Reflective Water Plane for valleys/lakes
    const waterGeom = new THREE.PlaneGeometry(500, 500, 1, 1);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2196f3,
      roughness: 0.15,
      metalness: 0.65,
      transparent: true,
      opacity: 0.72,
      flatShading: true,
    });
    this.waterPlane = new THREE.Mesh(waterGeom, waterMat);
    this.waterPlane.rotation.x = -Math.PI / 2;
    this.waterPlane.position.y = -0.35;
    this.waterPlane.receiveShadow = true;
    this.scene.add(this.waterPlane);

    // Starfield for night and twilight
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 400;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 15;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: this.activeTimeOfDay === 'night' || this.activeBiomeId === 'twilight' ? 0.9 : 0.05,
    });
    this.starsPoints = new THREE.Points(starGeom, starMat);
    this.scene.add(this.starsPoints);
  }

  // --------------------------------------------------------------------------
  // STYLIZED LOW-POLY CHARACTER CONTROLLER
  // --------------------------------------------------------------------------
  private initCharacter(): void {
    this.characterGroup = new THREE.Group();

    // Low-poly Adventurer Explorer Rig
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      flatShading: true,
      roughness: 0.7,
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      flatShading: true,
      roughness: 0.6,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      flatShading: true,
      roughness: 0.8,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      flatShading: true,
      roughness: 0.9,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      flatShading: true,
    });

    // Torso & Backpack
    this.charTorso = new THREE.Group();
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), vestMat);
    torsoMesh.castShadow = true;
    this.charTorso.add(torsoMesh);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), bodyMat);
    backpack.position.set(0, 0, -0.22);
    backpack.castShadow = true;
    this.charTorso.add(backpack);

    this.charTorso.position.y = 1.05;
    this.characterGroup.add(this.charTorso);

    // Head & Hat
    this.charHead = new THREE.Group();
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
    headMesh.castShadow = true;
    this.charHead.add(headMesh);

    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), hairMat);
    hairMesh.position.y = 0.18;
    this.charHead.add(hairMesh);

    this.charHead.position.y = 1.65;
    this.characterGroup.add(this.charHead);

    // Limbs (Arms & Legs with pivot joints)
    this.charLeftArm = new THREE.Group();
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), skinMat);
    armL.position.y = -0.25;
    armL.castShadow = true;
    this.charLeftArm.add(armL);
    this.charLeftArm.position.set(-0.38, 1.35, 0);
    this.characterGroup.add(this.charLeftArm);

    this.charRightArm = new THREE.Group();
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), skinMat);
    armR.position.y = -0.25;
    armR.castShadow = true;
    this.charRightArm.add(armR);
    this.charRightArm.position.set(0.38, 1.35, 0);
    this.characterGroup.add(this.charRightArm);

    this.charLeftLeg = new THREE.Group();
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
    legL.position.y = -0.35;
    legL.castShadow = true;
    this.charLeftLeg.add(legL);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), bootMat);
    bootL.position.set(0, -0.65, 0.04);
    bootL.castShadow = true;
    this.charLeftLeg.add(bootL);
    this.charLeftLeg.position.set(-0.16, 0.7, 0);
    this.characterGroup.add(this.charLeftLeg);

    this.charRightLeg = new THREE.Group();
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), bodyMat);
    legR.position.y = -0.35;
    legR.castShadow = true;
    this.charRightLeg.add(legR);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), bootMat);
    bootR.position.set(0, -0.65, 0.04);
    bootR.castShadow = true;
    this.charRightLeg.add(bootR);
    this.charRightLeg.position.set(0.16, 0.7, 0);
    this.characterGroup.add(this.charRightLeg);

    // Adventurer Lantern Light (illuminates surroundings at dusk/night)
    this.charLanternLight = new THREE.PointLight(0xffbe5c, 1.2, 14);
    this.charLanternLight.position.set(0, 1.2, 0.4);
    this.characterGroup.add(this.charLanternLight);

    this.scene.add(this.characterGroup);
  }

  // --------------------------------------------------------------------------
  // PROCEDURAL TERRAIN & HEIGHT EVALUATION
  // --------------------------------------------------------------------------
  getTerrainHeight(x: number, z: number): number {
    const scale = 0.022;
    // Layered fbm noise
    const baseElevation = this.noise.fbm(x * scale, z * scale, 4, 0.52, 2.08);

    // Mountain ridges factor
    const ridgeNoise = Math.abs(this.noise.noise2D(x * 0.008 + 100, z * 0.008 + 100));
    const mountainSpur = Math.pow(ridgeNoise, 2.2) * 22;

    // Gentle dunes / rolling hills
    const rolling = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 1.8;

    let height = baseElevation * 9.0 + mountainSpur + rolling;

    // Apply Biome-specific height multiplier
    if (this.activeBiomeId === 'canyon') {
      // Steeper plateaus & mesas
      const stepped = Math.floor(height * 0.6) * 1.6;
      height = THREE.MathUtils.lerp(height, stepped, 0.55);
    }

    return height;
  }

  // --------------------------------------------------------------------------
  // PROCEDURAL CHUNK MANAGEMENT & STREAMING
  // --------------------------------------------------------------------------
  private updateChunks(forceRebuild = false): void {
    const playerChunkX = Math.floor(
      (this.charPos.x + this.CHUNK_SIZE / 2) / this.CHUNK_SIZE
    );
    const playerChunkZ = Math.floor(
      (this.charPos.z + this.CHUNK_SIZE / 2) / this.CHUNK_SIZE
    );

    if (
      !forceRebuild &&
      playerChunkX === this.currentChunkCoord.x &&
      playerChunkZ === this.currentChunkCoord.z
    ) {
      return;
    }

    this.currentChunkCoord = { x: playerChunkX, z: playerChunkZ };

    const neededKeys = new Set<string>();
    for (let dx = -this.VIEW_RADIUS; dx <= this.VIEW_RADIUS; dx++) {
      for (let dz = -this.VIEW_RADIUS; dz <= this.VIEW_RADIUS; dz++) {
        const cx = playerChunkX + dx;
        const cz = playerChunkZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.loadedChunks.has(key)) {
          const chunk = this.createChunk(cx, cz);
          this.loadedChunks.set(key, chunk);
          this.scene.add(chunk.mesh);
          this.scene.add(chunk.propsGroup);
        }
      }
    }

    // Unload out-of-range chunks
    for (const [key, chunk] of this.loadedChunks.entries()) {
      if (!neededKeys.has(key)) {
        this.scene.remove(chunk.mesh);
        this.scene.remove(chunk.propsGroup);
        chunk.mesh.geometry.dispose();
        this.loadedChunks.delete(key);
      }
    }

    this.playerStats.activeChunks = this.loadedChunks.size;
  }

  private createChunk(cx: number, cz: number): ChunkRecord {
    const chunkOriginX = cx * this.CHUNK_SIZE;
    const chunkOriginZ = cz * this.CHUNK_SIZE;
    const biome = this.currentBiome;

    // 1. Procedural Low-Poly Terrain Geometry
    const segs = this.CHUNK_SEGMENTS;
    const geom = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, segs, segs);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes['position'];
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const vx = pos.getX(i) + chunkOriginX;
      const vz = pos.getZ(i) + chunkOriginZ;
      const vy = this.getTerrainHeight(vx, vz);
      pos.setY(i, vy);
    }

    // Convert to Non-Indexed geometry for true faceted low-poly triangle faces!
    const nonIndexedGeom = geom.toNonIndexed();
    nonIndexedGeom.computeVertexNormals();

    // Vertex colors based on elevation and slope
    const niCount = nonIndexedGeom.attributes['position'].count;
    const colors = new Float32Array(niCount * 3);
    const posAttr = nonIndexedGeom.attributes['position'];
    const normAttr = nonIndexedGeom.attributes['normal'];

    const groundCol = new THREE.Color(biome.groundColor);
    const cliffCol = new THREE.Color(biome.cliffColor);
    const peakCol = new THREE.Color(biome.peakColor);

    for (let i = 0; i < niCount; i++) {
      const y = posAttr.getY(i);
      const ny = normAttr.getY(i); // slope indicator (1 = flat ground, 0 = vertical cliff)

      const col = new THREE.Color();
      if (ny < 0.65) {
        col.copy(cliffCol);
      } else if (y > 14) {
        col.copy(peakCol);
      } else {
        col.copy(groundCol);
      }

      // Add subtle noise tint to ground triangles for organic richness
      const hash = Math.sin(posAttr.getX(i) * 12.9898 + posAttr.getZ(i) * 78.233) * 43758.5453;
      const variation = (hash - Math.floor(hash)) * 0.12 - 0.06;
      col.r = Math.min(Math.max(col.r + variation, 0), 1);
      col.g = Math.min(Math.max(col.g + variation, 0), 1);
      col.b = Math.min(Math.max(col.b + variation, 0), 1);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    nonIndexedGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.9,
      metalness: 0.05,
    });

    const mesh = new THREE.Mesh(nonIndexedGeom, terrainMat);
    mesh.position.set(chunkOriginX, 0, chunkOriginZ);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // 2. Procedural FBX Props Group for this Chunk
    const propsGroup = new THREE.Group();
    propsGroup.position.set(chunkOriginX, 0, chunkOriginZ);

    this.populateChunkProps(cx, cz, propsGroup);

    return {
      mesh,
      propsGroup,
      chunkX: cx,
      chunkZ: cz,
    };
  }

  /**
   * Deterministically populate chunk with FBX assets (Mountains, Trees, Rocks, Bushes, Flora)
   */
  private populateChunkProps(cx: number, cz: number, group: THREE.Group): void {
    // Seeded random for deterministic prop placement
    let seed = Math.abs(Math.sin(cx * 374761393 + cz * 668265263) * 1000000);
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const half = this.CHUNK_SIZE / 2;
    const worldChunkX = cx * this.CHUNK_SIZE;
    const worldChunkZ = cz * this.CHUNK_SIZE;

    // A. Massive Mountains on higher ridges & borders
    const isPerimeter = Math.abs(cx) >= 2 || Math.abs(cz) >= 2;
    const distFromOrigin = Math.hypot(worldChunkX, worldChunkZ);
    // Don't spawn mountains immediately near player start (0, 0)
    const mountainChance = isPerimeter ? 0.75 : (distFromOrigin < 25 ? 0 : 0.35);
    if (distFromOrigin >= 18 && rng() < mountainChance) {
      const mountVariants = ['Mounting_1', 'Mounting_2', 'Mounting_3'];
      const mName = mountVariants[Math.floor(rng() * mountVariants.length)];
      const template = this.assetTemplates.get(mName);
      if (template) {
        const mount = template.clone(true);
        const lx = (rng() - 0.5) * half * 1.5;
        const lz = (rng() - 0.5) * half * 1.5;
        const wy = this.getTerrainHeight(worldChunkX + lx, worldChunkZ + lz);
        const scale = 0.2;

        mount.position.set(lx, wy, lz);
        mount.rotation.y = rng() * Math.PI * 2;
        mount.scale.set(scale, scale, scale);
        group.add(mount);
        this.totalAssetsCount++;
      }
    }

    // B. Low-Poly Trees (Density depends on biome)
    const treeCount =
      this.activeBiomeId === 'forest'
        ? Math.floor(6 + rng() * 8)
        : this.activeBiomeId === 'canyon'
        ? Math.floor(1 + rng() * 3)
        : Math.floor(4 + rng() * 5);

    const treeVariants = ['Tree_1', 'Tree_2', 'Tree_3'];

    for (let i = 0; i < treeCount; i++) {
      const lx = (rng() - 0.5) * (this.CHUNK_SIZE - 4);
      const lz = (rng() - 0.5) * (this.CHUNK_SIZE - 4);
      const wx = worldChunkX + lx;
      const wz = worldChunkZ + lz;

      // Keep clear radius around player initial spawn
      if (Math.hypot(wx, wz) < 3.5) continue;

      const wy = this.getTerrainHeight(wx, wz);

      // Do not plant underwater or on sheer vertical cliffs
      if (wy > 0.4 && wy < 22) {
        const tName = treeVariants[Math.floor(rng() * treeVariants.length)];
        const template = this.assetTemplates.get(tName);
        if (template) {
          const tree = template.clone(true);
          const scale = 0.45 + rng() * 0.35;
          tree.position.set(lx, wy, lz);
          tree.rotation.y = rng() * Math.PI * 2;
          tree.scale.set(scale, scale, scale);
          group.add(tree);
          this.totalAssetsCount++;
        }
      }
    }

    // C. Rocks & Boulders
    const rockVariants = [
      'Rock_1',
      'Rock_2',
      'Rock_3',
      'Rock_4',
      'Rock_5',
      'Rock_6',
      'Stone_1',
    ];
    const rockCount = Math.floor(4 + rng() * 6);
    for (let i = 0; i < rockCount; i++) {
      const lx = (rng() - 0.5) * (this.CHUNK_SIZE - 2);
      const lz = (rng() - 0.5) * (this.CHUNK_SIZE - 2);
      const wx = worldChunkX + lx;
      const wz = worldChunkZ + lz;
      const wy = this.getTerrainHeight(wx, wz);

      const rName = rockVariants[Math.floor(rng() * rockVariants.length)];
      const template = this.assetTemplates.get(rName);
      if (template) {
        const rock = template.clone(true);
        const scale = 0.6 + rng() * 1.2;
        rock.position.set(lx, wy, lz);
        rock.rotation.set(rng() * 0.2, rng() * Math.PI * 2, rng() * 0.2);
        rock.scale.set(scale, scale, scale);
        group.add(rock);
        this.totalAssetsCount++;
      }
    }

    // D. Bushes & Shrubs
    const bushVariants = ['Bush_1', 'Bush_2', 'Bush_3'];
    const bushCount =
      this.activeBiomeId === 'forest' ? Math.floor(5 + rng() * 7) : Math.floor(2 + rng() * 4);
    for (let i = 0; i < bushCount; i++) {
      const lx = (rng() - 0.5) * (this.CHUNK_SIZE - 3);
      const lz = (rng() - 0.5) * (this.CHUNK_SIZE - 3);
      const wx = worldChunkX + lx;
      const wz = worldChunkZ + lz;
      const wy = this.getTerrainHeight(wx, wz);

      if (wy > 0.2) {
        const bName = bushVariants[Math.floor(rng() * bushVariants.length)];
        const template = this.assetTemplates.get(bName);
        if (template) {
          const bush = template.clone(true);
          const scale = 0.7 + rng() * 0.6;
          bush.position.set(lx, wy, lz);
          bush.rotation.y = rng() * Math.PI * 2;
          bush.scale.set(scale, scale, scale);
          group.add(bush);
          this.totalAssetsCount++;
        }
      }
    }

    // E. Flowering Plants & Succulents
    const plantVariants = [
      'Plant_1',
      'Plant_2',
      'Plant_3',
      'Plant_4',
      'Plant_5',
      'Plant_6',
      'Plant_7',
    ];
    const plantCount = Math.floor(4 + rng() * 6);
    for (let i = 0; i < plantCount; i++) {
      const lx = (rng() - 0.5) * (this.CHUNK_SIZE - 3);
      const lz = (rng() - 0.5) * (this.CHUNK_SIZE - 3);
      const wx = worldChunkX + lx;
      const wz = worldChunkZ + lz;
      const wy = this.getTerrainHeight(wx, wz);

      if (wy > 0.2) {
        const pName = plantVariants[Math.floor(rng() * plantVariants.length)];
        const template = this.assetTemplates.get(pName);
        if (template) {
          const plant = template.clone(true);
          const scale = 0.75 + rng() * 0.5;
          plant.position.set(lx, wy, lz);
          plant.rotation.y = rng() * Math.PI * 2;
          plant.scale.set(scale, scale, scale);
          group.add(plant);
          this.totalAssetsCount++;
        }
      }
    }

    // F. Fallen Timber & Logs
    if (rng() < 0.65) {
      const logVariants = ['Log_1', 'Log_2', 'Log_3'];
      const lName = logVariants[Math.floor(rng() * logVariants.length)];
      const template = this.assetTemplates.get(lName);
      if (template) {
        const log = template.clone(true);
        const lx = (rng() - 0.5) * (this.CHUNK_SIZE - 4);
        const lz = (rng() - 0.5) * (this.CHUNK_SIZE - 4);
        const wx = worldChunkX + lx;
        const wz = worldChunkZ + lz;
        const wy = this.getTerrainHeight(wx, wz);

        log.position.set(lx, wy, lz);
        log.rotation.y = rng() * Math.PI * 2;
        log.rotation.z = (rng() - 0.5) * 0.15;
        const scale = 0.8 + rng() * 0.5;
        log.scale.set(scale, scale, scale);
        group.add(log);
        this.totalAssetsCount++;
      }
    }

    // G. Grass Tufts
    const grassVariants = ['Grass_1', 'Grass_2'];
    const grassCount = Math.floor(6 + rng() * 8);
    for (let i = 0; i < grassCount; i++) {
      const lx = (rng() - 0.5) * (this.CHUNK_SIZE - 2);
      const lz = (rng() - 0.5) * (this.CHUNK_SIZE - 2);
      const wx = worldChunkX + lx;
      const wz = worldChunkZ + lz;
      const wy = this.getTerrainHeight(wx, wz);

      if (wy > 0.1) {
        const gName = grassVariants[Math.floor(rng() * grassVariants.length)];
        const template = this.assetTemplates.get(gName);
        if (template) {
          const grass = template.clone(true);
          const scale = 0.8 + rng() * 0.5;
          grass.position.set(lx, wy, lz);
          grass.rotation.y = rng() * Math.PI * 2;
          grass.scale.set(scale, scale, scale);
          group.add(grass);
          this.totalAssetsCount++;
        }
      }
    }

    this.playerStats.assetsRendered = this.totalAssetsCount;
  }

  // --------------------------------------------------------------------------
  // INPUT & USER INTERACTIONS
  // --------------------------------------------------------------------------
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.keys[event.code] = true;

    if (event.code === 'KeyC') {
      this.cycleCamera();
    } else if (event.code === 'KeyB') {
      this.cycleBiome();
    } else if (event.code === 'KeyT') {
      this.cycleTime();
    } else if (event.code === 'KeyR') {
      this.resetPosition();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.keys[event.code] = false;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  onPointerDown(e: PointerEvent): void {
    this.isPointerDown = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isPointerDown) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.cameraYaw -= dx * 0.0055;
    this.cameraPitch = Math.max(0.08, Math.min(Math.PI / 2.3, this.cameraPitch + dy * 0.004));
  }

  onPointerUp(): void {
    this.isPointerDown = false;
  }

  onPointerLeave(): void {
    this.isPointerDown = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.cameraDistance = Math.max(3.5, Math.min(24.0, this.cameraDistance + e.deltaY * 0.01));
  }

  // Virtual Touch Joystick Handlers
  onTouchJoyStart(e: TouchEvent): void {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      this.touchJoystick.active = true;
      this.touchJoystick.startX = t.clientX;
      this.touchJoystick.startY = t.clientY;
      this.touchJoystick.currX = t.clientX;
      this.touchJoystick.currY = t.clientY;
    }
  }

  onTouchJoyMove(e: TouchEvent): void {
    if (!this.touchJoystick.active || e.touches.length === 0) return;
    const t = e.touches[0];
    this.touchJoystick.currX = t.clientX;
    this.touchJoystick.currY = t.clientY;

    const dx = t.clientX - this.touchJoystick.startX;
    const dy = t.clientY - this.touchJoystick.startY;
    const maxDist = 45;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    this.touchJoystick.moveX = (Math.cos(angle) * clampedDist) / maxDist;
    this.touchJoystick.moveZ = (Math.sin(angle) * clampedDist) / maxDist;
  }

  onTouchJoyEnd(): void {
    this.touchJoystick.active = false;
    this.touchJoystick.moveX = 0;
    this.touchJoystick.moveZ = 0;
  }

  onSprintToggle(): void {
    this.isSprinting = !this.isSprinting;
  }

  onJumpBtn(): void {
    if (this.isGrounded) {
      this.charVelocity.y = 8.5;
      this.isGrounded = false;
    }
  }

  // --------------------------------------------------------------------------
  // GAMEPLAY LOOP & ANIMATIONS
  // --------------------------------------------------------------------------
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // FPS Meter
    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.playerStats.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (!this.isLoadingAssets) {
      this.updateMovement(dt);
      this.updateChunks();
      this.updateCameraTransform();
      this.updateAtmosphere(dt);
      this.updateCharacterLimbs(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateMovement(dt: number): void {
    let moveForward = 0;
    let moveRight = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;

    // Add touch joystick input
    if (this.touchJoystick.active) {
      moveRight += this.touchJoystick.moveX;
      moveForward -= this.touchJoystick.moveZ;
    }

    const isMoving = Math.abs(moveForward) > 0.05 || Math.abs(moveRight) > 0.05;
    this.isMoving = isMoving;
    const isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.isSprinting;

    const baseSpeed = isSprinting ? 12.0 : 6.5;

    if (isMoving) {
      // Calculate movement direction relative to camera angle
      const forward = new THREE.Vector3(
        -Math.sin(this.cameraYaw),
        0,
        -Math.cos(this.cameraYaw)
      ).normalize();
      const right = new THREE.Vector3(
        Math.cos(this.cameraYaw),
        0,
        -Math.sin(this.cameraYaw)
      ).normalize();

      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, moveForward)
        .addScaledVector(right, moveRight)
        .normalize();

      this.charVelocity.x = moveDir.x * baseSpeed;
      this.charVelocity.z = moveDir.z * baseSpeed;

      this.targetRotation = Math.atan2(moveDir.x, moveDir.z);
    } else {
      this.charVelocity.x *= 0.75;
      this.charVelocity.z *= 0.75;
    }

    // Jump
    if (this.keys['Space'] && this.isGrounded) {
      this.charVelocity.y = 8.5;
      this.isGrounded = false;
    }

    // Gravity
    this.charVelocity.y -= 22.0 * dt;

    // Apply movement
    this.charPos.x += this.charVelocity.x * dt;
    this.charPos.z += this.charVelocity.z * dt;
    this.charPos.y += this.charVelocity.y * dt;

    // Ground collision
    const groundY = this.getTerrainHeight(this.charPos.x, this.charPos.z);
    if (this.charPos.y <= groundY) {
      this.charPos.y = groundY;
      this.charVelocity.y = 0;
      this.isGrounded = true;
    }

    // Smooth character rotation
    let angleDiff = this.targetRotation - this.charRotation;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.charRotation += angleDiff * 14.0 * dt;

    this.characterGroup.position.copy(this.charPos);
    this.characterGroup.rotation.y = this.charRotation;

    // Update HUD Stats
    const horizSpeed = Math.sqrt(
      this.charVelocity.x * this.charVelocity.x + this.charVelocity.z * this.charVelocity.z
    );
    this.playerStats.posX = this.charPos.x.toFixed(1);
    this.playerStats.posY = this.charPos.y.toFixed(1);
    this.playerStats.posZ = this.charPos.z.toFixed(1);
    this.playerStats.speed = (horizSpeed * 3.6).toFixed(1);
    this.playerStats.state = !this.isGrounded
      ? 'Jumping'
      : isMoving
      ? isSprinting
        ? 'Sprinting'
        : 'Running'
      : 'Idle';

    this.miniMapAngle = this.charRotation;
  }

  private updateCharacterLimbs(dt: number): void {
    if (this.isMoving && this.isGrounded) {
      this.animTimer += dt * (this.isSprinting ? 14 : 9);
      const swing = Math.sin(this.animTimer) * 0.65;

      this.charLeftArm.rotation.x = -swing;
      this.charRightArm.rotation.x = swing;
      this.charLeftLeg.rotation.x = swing;
      this.charRightLeg.rotation.x = -swing;
      this.charTorso.position.y = 1.05 + Math.abs(Math.sin(this.animTimer * 2)) * 0.08;
    } else {
      // Smooth return to idle breath
      this.animTimer += dt * 2.5;
      const breathe = Math.sin(this.animTimer) * 0.03;
      this.charLeftArm.rotation.x *= 0.85;
      this.charRightArm.rotation.x *= 0.85;
      this.charLeftLeg.rotation.x *= 0.85;
      this.charRightLeg.rotation.x *= 0.85;
      this.charTorso.position.y = 1.05 + breathe;
    }
  }

  private updateCameraTransform(): void {
    if (this.activeCameraMode === 'cinematic') {
      // Cinematic slow revolving drone
      this.cinematicOrbitAngle += 0.004;
      const r = 16.0;
      this.camera.position.set(
        this.charPos.x + Math.sin(this.cinematicOrbitAngle) * r,
        this.charPos.y + 7.5,
        this.charPos.z + Math.cos(this.cinematicOrbitAngle) * r
      );
      this.camera.lookAt(this.charPos.x, this.charPos.y + 1.5, this.charPos.z);
      return;
    }

    const dist =
      this.activeCameraMode === 'close'
        ? 4.5
        : this.activeCameraMode === 'panoramic'
        ? 14.5
        : this.cameraDistance;

    const cx =
      this.charPos.x + dist * Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
    const cy = this.charPos.y + dist * Math.sin(this.cameraPitch) + 1.4;
    const cz =
      this.charPos.z + dist * Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);

    const terrainUnderCam = this.getTerrainHeight(cx, cz);
    this.camera.position.set(cx, Math.max(cy, terrainUnderCam + 0.8, this.charPos.y + 0.5), cz);
    this.camera.lookAt(this.charPos.x, this.charPos.y + 1.3, this.charPos.z);

    // Keep skydome centered on camera
    if (this.skyDome) {
      this.skyDome.position.copy(this.camera.position);
    }
    // Update directional light to follow player
    if (this.dirLight) {
      this.dirLight.position.set(this.charPos.x + 50, 85, this.charPos.z + 45);
      this.dirLight.target.position.copy(this.charPos);
    }
  }

  private updateAtmosphere(dt: number): void {
    if (this.waterPlane) {
      this.waterPlane.position.x = this.charPos.x;
      this.waterPlane.position.z = this.charPos.z;
    }
    if (this.starsPoints) {
      this.starsPoints.rotation.y += dt * 0.003;
    }
  }

  // --------------------------------------------------------------------------
  // CONTROLS & HUD ACTIONS
  // --------------------------------------------------------------------------
  selectBiome(biomeId: BiomeId): void {
    this.activeBiomeId = biomeId;
    const biome = this.currentBiome;

    // Update scene fog & ambient colors
    this.scene.background = new THREE.Color(biome.skyHorizon);
    (this.scene.fog as THREE.FogExp2).color.setHex(biome.fogColor);
    this.ambientLight.color.setHex(biome.ambientColor);
    this.hemiLight.color.setHex(biome.skyZenith);
    this.hemiLight.groundColor.setHex(biome.groundColor);
    this.dirLight.color.setHex(biome.sunColor);
    this.skyDome.material = new THREE.MeshBasicMaterial({
      color: biome.skyHorizon,
      side: THREE.BackSide,
    });

    // Rebuild world chunks with new biome palette
    for (const [key, chunk] of this.loadedChunks.entries()) {
      this.scene.remove(chunk.mesh);
      this.scene.remove(chunk.propsGroup);
      chunk.mesh.geometry.dispose();
    }
    this.loadedChunks.clear();
    this.totalAssetsCount = 0;
    this.updateChunks(true);
  }

  setTimeOfDay(time: TimeOfDay): void {
    this.activeTimeOfDay = time;
    const biome = this.currentBiome;

    let sunIntensity = biome.sunIntensity;
    let sunColor = biome.sunColor;
    let ambientIntensity = 0.7;

    if (time === 'dawn') {
      sunColor = 0xffa07a;
      sunIntensity = 1.2;
      ambientIntensity = 0.55;
    } else if (time === 'noon') {
      sunColor = biome.sunColor;
      sunIntensity = biome.sunIntensity;
      ambientIntensity = 0.75;
    } else if (time === 'sunset') {
      sunColor = 0xff6f00;
      sunIntensity = 1.35;
      ambientIntensity = 0.5;
    } else if (time === 'night') {
      sunColor = 0x5c6bc0;
      sunIntensity = 0.35;
      ambientIntensity = 0.25;
    }

    this.dirLight.color.setHex(sunColor);
    this.dirLight.intensity = sunIntensity;
    this.ambientLight.intensity = ambientIntensity;

    if (this.starsPoints) {
      (this.starsPoints.material as THREE.PointsMaterial).opacity =
        time === 'night' || this.activeBiomeId === 'twilight' ? 0.9 : 0.05;
    }
  }

  cycleBiome(): void {
    const list: BiomeId[] = ['forest', 'canyon', 'autumn', 'twilight'];
    const idx = list.indexOf(this.activeBiomeId);
    this.selectBiome(list[(idx + 1) % list.length]);
  }

  cycleTime(): void {
    const times: TimeOfDay[] = ['dawn', 'noon', 'sunset', 'night'];
    const idx = times.indexOf(this.activeTimeOfDay);
    this.setTimeOfDay(times[(idx + 1) % times.length]);
  }

  cycleCamera(): void {
    const modes: CameraMode[] = ['close', 'medium', 'panoramic', 'cinematic'];
    const idx = modes.indexOf(this.activeCameraMode);
    this.activeCameraMode = modes[(idx + 1) % modes.length];
  }

  resetPosition(): void {
    const startGroundY = this.getTerrainHeight(0, 0);
    this.charPos.set(0, startGroundY + 0.1, 0);
    this.charVelocity.set(0, 0, 0);
    this.characterGroup.position.copy(this.charPos);
    this.updateChunks(true);
  }

  toggleHelp(): void {
    this.isHelpOpen = !this.isHelpOpen;
  }
}
