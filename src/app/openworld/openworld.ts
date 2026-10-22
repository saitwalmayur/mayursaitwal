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

export type BiomeId = 'meadow' | 'autumn' | 'cyber' | 'tundra';
export type TimeOfDay = 'dawn' | 'noon' | 'sunset' | 'night';
export type CameraMode = 'close' | 'medium' | 'panoramic';

interface BiomeConfig {
  id: BiomeId;
  name: string;
  icon: string;
  heightScale: number;
  skyColor: number;
  fogColor: number;
  sunColor: number;
  ambientColor: number;
  sunIntensity: number;
  groundColor: number;
  cliffColor: number;
  peakColor: number;
  treeTrunkColor: number;
  treeFoliageColors: number[];
  rockColor: number;
  accentColor: number;
}

// 2D Perlin Noise implementation for deterministic procedural terrain
class SimpleNoise {
  private perm: number[] = new Array(512);

  constructor(seed = 4242) {
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

interface FireflyCluster {
  points: THREE.Points;
  positions: Float32Array;
  origins: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  radii: Float32Array;
  colors: Float32Array;
  light?: THREE.PointLight;
  count: number;
  centerX: number;
  centerZ: number;
}

interface ChunkData {
  mesh: THREE.Mesh;
  propsGroup: THREE.Group;
  chunkX: number;
  chunkZ: number;
  fireflyCluster?: FireflyCluster;
}

@Component({
  selector: 'app-openworld',
  imports: [CommonModule, RouterLink],
  templateUrl: './openworld.html',
  styleUrl: './openworld.scss',
  host: {
    ngSkipHydration: 'true',
  },
})
export class Openworld implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly biomes: BiomeConfig[] = [
    {
      id: 'meadow',
      name: 'Emerald Meadow',
      icon: '🌿',
      heightScale: 7.5,
      skyColor: 0x64b5f6,
      fogColor: 0xb3e5fc,
      sunColor: 0xfff3e0,
      ambientColor: 0x4a6572,
      sunIntensity: 1.4,
      groundColor: 0x43a047,
      cliffColor: 0x546e7a,
      peakColor: 0xf5f5f5,
      treeTrunkColor: 0x5d4037,
      treeFoliageColors: [0x2e7d32, 0x388e3c, 0x43a047, 0x1b5e20],
      rockColor: 0x78909c,
      accentColor: 0x00e676,
    },
    {
      id: 'autumn',
      name: 'Autumn Highlands',
      icon: '🍂',
      heightScale: 9.0,
      skyColor: 0xffb74d,
      fogColor: 0xffe0b2,
      sunColor: 0xffab40,
      ambientColor: 0x5d4037,
      sunIntensity: 1.3,
      groundColor: 0xd84315,
      cliffColor: 0x4e342e,
      peakColor: 0xfff8e1,
      treeTrunkColor: 0x3e2723,
      treeFoliageColors: [0xe65100, 0xf57c00, 0xff8f00, 0xbf360c],
      rockColor: 0x6d4c41,
      accentColor: 0xff9100,
    },
    {
      id: 'cyber',
      name: 'Cyber Neon Oasis',
      icon: '⚡',
      heightScale: 8.5,
      skyColor: 0x12002b,
      fogColor: 0x240046,
      sunColor: 0x00f2fe,
      ambientColor: 0x3c096c,
      sunIntensity: 1.1,
      groundColor: 0x3a0ca3,
      cliffColor: 0x10002b,
      peakColor: 0x7209b7,
      treeTrunkColor: 0x240046,
      treeFoliageColors: [0x4cc9f0, 0x4895ef, 0xf72585, 0x7209b7],
      rockColor: 0x560bad,
      accentColor: 0x4cc9f0,
    },
    {
      id: 'tundra',
      name: 'Winter Tundra',
      icon: '❄️',
      heightScale: 10.0,
      skyColor: 0x90caf9,
      fogColor: 0xe1f5fe,
      sunColor: 0xffffff,
      ambientColor: 0x607d8b,
      sunIntensity: 1.2,
      groundColor: 0xe0f7fa,
      cliffColor: 0x455a64,
      peakColor: 0xffffff,
      treeTrunkColor: 0x37474f,
      treeFoliageColors: [0x80deea, 0xb2ebf2, 0x26a69a, 0x00838f],
      rockColor: 0x90a4ae,
      accentColor: 0x00e5ff,
    },
  ];

  activeBiomeId: BiomeId = 'meadow';
  activeTimeOfDay: TimeOfDay = 'noon';
  activeCameraMode: CameraMode = 'medium';

  // HUD & UI States
  playerStats = {
    posX: '0.0',
    posY: '0.0',
    posZ: '0.0',
    speed: '0',
    state: 'Idle',
    activeChunks: 0,
    fps: 60,
  };

  isHelpOpen = true;
  isControlsCollapsed = false;
  miniMapAngle = 0;
  isNearFireflies = false;
  private fireflyTexture: THREE.Texture | null = null;

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
  private noise = new SimpleNoise(1337);

  // Three.js Core
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private waterPlane!: THREE.Mesh;
  private starsGroup!: THREE.Points;

  // Character
  private characterGroup!: THREE.Group;
  private charTorso!: THREE.Group;
  private charHead!: THREE.Group;
  private charLeftArm!: THREE.Group;
  private charRightArm!: THREE.Group;
  private charLeftLeg!: THREE.Group;
  private charRightLeg!: THREE.Group;
  private charVisorMat!: THREE.MeshStandardMaterial;
  private charCoreMat!: THREE.MeshStandardMaterial;
  private charFlashlight!: THREE.SpotLight;
  private dustParticles!: THREE.Points;
  private dustPositions!: Float32Array;
  private dustLife!: Float32Array;

  // Movement & Physics
  private charPos = new THREE.Vector3(0, 0, 0);
  private charVelocity = new THREE.Vector3(0, 0, 0);
  private charRotation = 0;
  private targetRotation = 0;
  private isGrounded = true;
  private animTimer = 0;
  private idleTimer = 0;

  // Camera Orbit
  private cameraYaw = 0;
  private cameraPitch = 0.35;
  private cameraDistance = 6.5;
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // World Chunks
  private readonly CHUNK_SIZE = 36;
  private readonly CHUNK_SEGMENTS = 18;
  private readonly VIEW_RADIUS = 3; // 7x7 chunks grid around player
  private loadedChunks = new Map<string, ChunkData>();
  private currentChunkCoord = { x: 0, z: 0 };

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
      this.updateChunks(true);

      // Snap character to ground at start
      const startGroundY = this.getTerrainHeight(0, 0);
      this.charPos.set(0, startGroundY + 0.1, 0);
      this.characterGroup.position.copy(this.charPos);

      this.lastTime = performance.now();
      this.lastFpsTime = performance.now();
      this.animate();
    }
  }

  ngOnDestroy() {
    if (this.animationId !== null && this.isBrowser) {
      cancelAnimationFrame(this.animationId);
    }
    this.disposeScene();
  }

  // ==========================================
  // SCENE INITIALIZATION
  // ==========================================
  private initScene() {
    const canvas = this.canvasRef.nativeElement;
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    const biome = this.currentBiome;
    this.scene.background = new THREE.Color(biome.skyColor);
    this.scene.fog = new THREE.FogExp2(biome.fogColor, 0.012);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 400);

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
    this.renderer.toneMappingExposure = 1.1;

    // Lighting
    this.ambientLight = new THREE.AmbientLight(biome.ambientColor, 0.9);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(biome.skyColor, biome.groundColor, 0.6);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(biome.sunColor, biome.sunIntensity);
    this.dirLight.position.set(60, 90, 50);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 250;
    const d = 45;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Stars for night time
    this.initStars();
  }

  private initStars() {
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 250 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      transparent: true,
      opacity: 0,
      sizeAttenuation: false,
    });
    this.starsGroup = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsGroup);
  }

  // ==========================================
  // PROCEDURAL THIRD-PERSON CHARACTER
  // ==========================================
  private initCharacter() {
    this.characterGroup = new THREE.Group();

    // Stylized materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.35,
      metalness: 0.8,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.6,
      metalness: 0.5,
    });
    const secondaryMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.4,
      metalness: 0.7,
    });

    this.charVisorMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });

    this.charCoreMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    });

    // 1. Torso Group
    this.charTorso = new THREE.Group();
    this.charTorso.position.y = 0.85;

    // Main chest armor
    const chestGeo = new THREE.BoxGeometry(0.52, 0.55, 0.32);
    const chestMesh = new THREE.Mesh(chestGeo, armorMat);
    chestMesh.castShadow = true;
    this.charTorso.add(chestMesh);

    // Glowing chest power core
    const coreGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, this.charCoreMat);
    coreMesh.position.set(0, 0.08, 0.16);
    this.charTorso.add(coreMesh);

    // Jetpack thrusters on back
    const jetpackGeo = new THREE.BoxGeometry(0.32, 0.42, 0.14);
    const jetpackMesh = new THREE.Mesh(jetpackGeo, secondaryMat);
    jetpackMesh.position.set(0, 0.05, -0.21);
    jetpackMesh.castShadow = true;
    this.charTorso.add(jetpackMesh);

    const thrusterGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.18, 12);
    const leftThruster = new THREE.Mesh(thrusterGeo, secondaryMat);
    leftThruster.position.set(-0.1, -0.2, -0.21);
    const rightThruster = new THREE.Mesh(thrusterGeo, secondaryMat);
    rightThruster.position.set(0.1, -0.2, -0.21);
    this.charTorso.add(leftThruster);
    this.charTorso.add(rightThruster);

    // 2. Head Group
    this.charHead = new THREE.Group();
    this.charHead.position.set(0, 0.42, 0);

    const helmetGeo = new THREE.BoxGeometry(0.32, 0.34, 0.32);
    const helmetMesh = new THREE.Mesh(helmetGeo, armorMat);
    helmetMesh.castShadow = true;
    this.charHead.add(helmetMesh);

    const visorGeo = new THREE.BoxGeometry(0.28, 0.1, 0.08);
    const visorMesh = new THREE.Mesh(visorGeo, this.charVisorMat);
    visorMesh.position.set(0, 0.02, 0.15);
    this.charHead.add(visorMesh);

    const crestGeo = new THREE.BoxGeometry(0.06, 0.1, 0.28);
    const crestMesh = new THREE.Mesh(crestGeo, secondaryMat);
    crestMesh.position.set(0, 0.2, -0.02);
    this.charHead.add(crestMesh);

    this.charTorso.add(this.charHead);

    // 3. Arms (Pivoted at shoulders)
    this.charLeftArm = this.createLimb(true, armorMat, jointMat);
    this.charLeftArm.position.set(-0.35, 0.2, 0);
    this.charTorso.add(this.charLeftArm);

    this.charRightArm = this.createLimb(true, armorMat, jointMat);
    this.charRightArm.position.set(0.35, 0.2, 0);
    this.charTorso.add(this.charRightArm);

    this.characterGroup.add(this.charTorso);

    // 4. Legs (Pivoted at hips)
    this.charLeftLeg = this.createLimb(false, armorMat, jointMat);
    this.charLeftLeg.position.set(-0.16, 0.85, 0);
    this.characterGroup.add(this.charLeftLeg);

    this.charRightLeg = this.createLimb(false, armorMat, jointMat);
    this.charRightLeg.position.set(0.16, 0.85, 0);
    this.characterGroup.add(this.charRightLeg);

    // 5. Headlight / Flashlight attached to character
    this.charFlashlight = new THREE.SpotLight(0xffffff, 2.0, 35, Math.PI / 4, 0.4, 1.2);
    this.charFlashlight.position.set(0, 1.3, 0.2);
    this.charFlashlight.target.position.set(0, 0.8, 10);
    this.characterGroup.add(this.charFlashlight);
    this.characterGroup.add(this.charFlashlight.target);
    this.charFlashlight.visible = false; // enabled during night

    // 6. Dust particle system for footstep & landing bursts
    this.initDustParticles();

    this.scene.add(this.characterGroup);
  }

  private createLimb(isArm: boolean, armorMat: THREE.Material, jointMat: THREE.Material): THREE.Group {
    const limbGroup = new THREE.Group();

    if (isArm) {
      // Shoulder joint
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), jointMat);
      limbGroup.add(shoulder);

      // Arm segment
      const armGeo = new THREE.BoxGeometry(0.15, 0.45, 0.15);
      armGeo.translate(0, -0.22, 0);
      const armMesh = new THREE.Mesh(armGeo, armorMat);
      armMesh.castShadow = true;
      limbGroup.add(armMesh);

      // Hand
      const handGeo = new THREE.BoxGeometry(0.1, 0.12, 0.12);
      handGeo.translate(0, -0.48, 0);
      const handMesh = new THREE.Mesh(handGeo, jointMat);
      handMesh.castShadow = true;
      limbGroup.add(handMesh);
    } else {
      // Hip joint
      const hip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), jointMat);
      limbGroup.add(hip);

      // Thigh & Calf
      const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
      legGeo.translate(0, -0.35, 0);
      const legMesh = new THREE.Mesh(legGeo, armorMat);
      legMesh.castShadow = true;
      limbGroup.add(legMesh);

      // Boot
      const bootGeo = new THREE.BoxGeometry(0.19, 0.16, 0.3);
      bootGeo.translate(0, -0.72, 0.05);
      const bootMesh = new THREE.Mesh(bootGeo, jointMat);
      bootMesh.castShadow = true;
      limbGroup.add(bootMesh);
    }

    return limbGroup;
  }

  private initDustParticles() {
    const count = 60;
    const dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(count * 3);
    this.dustLife = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.dustPositions[i * 3] = 0;
      this.dustPositions[i * 3 + 1] = -100;
      this.dustPositions[i * 3 + 2] = 0;
      this.dustLife[i] = 0;
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd7ccc8,
      size: 0.18,
      transparent: true,
      opacity: 0.6,
    });

    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustParticles);
  }

  private spawnDust(x: number, y: number, z: number) {
    if (!this.dustPositions) return;
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * 60);
      this.dustPositions[idx * 3] = x + (Math.random() - 0.5) * 0.4;
      this.dustPositions[idx * 3 + 1] = y + 0.05;
      this.dustPositions[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
      this.dustLife[idx] = 1.0;
    }
  }

  // ==========================================
  // PROCEDURAL TERRAIN & CHUNKS
  // ==========================================
  getTerrainHeight(x: number, z: number): number {
    const biome = this.currentBiome;
    const scale = 0.012;

    // Broad rolling topography
    let h = this.noise.fbm(x * scale, z * scale, 4, 0.48, 2.05) * biome.heightScale;

    // Secondary hill formations
    h += this.noise.fbm((x + 500) * 0.035, (z + 500) * 0.035, 2, 0.4, 2.0) * (biome.heightScale * 0.22);

    // Gentle river valleys & lake basins
    const valleyNoise = this.noise.noise2D(x * 0.006, z * 0.006);
    if (valleyNoise < -0.15) {
      h *= 0.5;
    }

    return h;
  }

  private initEnvironment() {
    // Water surface plane at y = -0.4
    const waterGeo = new THREE.PlaneGeometry(600, 600, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0077b6,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.72,
    });
    this.waterPlane = new THREE.Mesh(waterGeo, waterMat);
    this.waterPlane.position.y = -0.4;
    this.scene.add(this.waterPlane);
  }

  private updateChunks(force = false) {
    const chunkX = Math.floor((this.charPos.x + this.CHUNK_SIZE / 2) / this.CHUNK_SIZE);
    const chunkZ = Math.floor((this.charPos.z + this.CHUNK_SIZE / 2) / this.CHUNK_SIZE);

    if (!force && chunkX === this.currentChunkCoord.x && chunkZ === this.currentChunkCoord.z) {
      return;
    }

    this.currentChunkCoord = { x: chunkX, z: chunkZ };
    const requiredKeys = new Set<string>();

    for (let dx = -this.VIEW_RADIUS; dx <= this.VIEW_RADIUS; dx++) {
      for (let dz = -this.VIEW_RADIUS; dz <= this.VIEW_RADIUS; dz++) {
        const cx = chunkX + dx;
        const cz = chunkZ + dz;
        const key = `${cx}_${cz}`;
        requiredKeys.add(key);

        if (!this.loadedChunks.has(key)) {
          const chunkData = this.buildChunk(cx, cz);
          this.loadedChunks.set(key, chunkData);
          this.scene.add(chunkData.mesh);
          this.scene.add(chunkData.propsGroup);
        }
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.loadedChunks.entries()) {
      if (!requiredKeys.has(key)) {
        this.scene.remove(chunk.mesh);
        this.scene.remove(chunk.propsGroup);
        chunk.mesh.geometry.dispose();
        (chunk.mesh.material as THREE.Material).dispose();

        // Dispose props in chunk
        chunk.propsGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.geometry?.dispose();
          }
        });

        this.loadedChunks.delete(key);
      }
    }

    this.playerStats.activeChunks = this.loadedChunks.size;
  }

  private buildChunk(cx: number, cz: number): ChunkData {
    const biome = this.currentBiome;
    const size = this.CHUNK_SIZE;
    const segs = this.CHUNK_SEGMENTS;

    const geometry = new THREE.PlaneGeometry(size, size, segs, segs);
    geometry.rotateX(-Math.PI / 2);

    const worldOriginX = cx * size;
    const worldOriginZ = cz * size;

    const pos = geometry.attributes['position'];
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    const colorShore = new THREE.Color(0xd7ccc8);
    const colorGround = new THREE.Color(biome.groundColor);
    const colorCliff = new THREE.Color(biome.cliffColor);
    const colorPeak = new THREE.Color(biome.peakColor);

    // Apply procedural height and vertex colors
    for (let i = 0; i < count; i++) {
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);
      const worldX = worldOriginX + localX;
      const worldZ = worldOriginZ + localZ;

      const y = this.getTerrainHeight(worldX, worldZ);
      pos.setY(i, y);

      // Vertex color blending based on elevation & slope
      const normHeight = THREE.MathUtils.clamp((y + 1) / (biome.heightScale * 1.2), 0, 1);
      const vertexColor = new THREE.Color();

      if (y < 0.2) {
        vertexColor.copy(colorShore).lerp(colorGround, THREE.MathUtils.clamp((y + 0.4) / 0.6, 0, 1));
      } else if (normHeight < 0.6) {
        vertexColor.copy(colorGround);
      } else if (normHeight < 0.85) {
        const factor = (normHeight - 0.6) / 0.25;
        vertexColor.copy(colorGround).lerp(colorCliff, factor);
      } else {
        const factor = (normHeight - 0.85) / 0.15;
        vertexColor.copy(colorCliff).lerp(colorPeak, factor);
      }

      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, terrainMat);
    mesh.position.set(worldOriginX, 0, worldOriginZ);
    mesh.receiveShadow = true;

    // Generate vegetation, trees & rocks on this chunk
    const propsGroup = new THREE.Group();
    this.populateChunkProps(propsGroup, worldOriginX, worldOriginZ, size);

    return { mesh, propsGroup, chunkX: cx, chunkZ: cz };
  }

  private populateChunkProps(group: THREE.Group, originX: number, originZ: number, size: number) {
    const biome = this.currentBiome;
    const halfSize = size / 2;
    const treeCount = 12 + Math.floor(Math.random() * 8);
    const rockCount = 6 + Math.floor(Math.random() * 6);
    const crystalCount = biome.id === 'cyber' ? 10 : 4;

    // 1. Trees
    const trunkMat = new THREE.MeshStandardMaterial({
      color: biome.treeTrunkColor,
      roughness: 0.8,
    });

    for (let i = 0; i < treeCount; i++) {
      const rx = (Math.random() - 0.5) * (size - 4);
      const rz = (Math.random() - 0.5) * (size - 4);
      const worldX = originX + rx;
      const worldZ = originZ + rz;
      const groundY = this.getTerrainHeight(worldX, worldZ);

      // Don't spawn trees underwater or on high peaks
      if (groundY > 0.4 && groundY < biome.heightScale * 0.75) {
        const tree = this.createProceduralTree(biome, trunkMat);
        const scale = 0.8 + Math.random() * 0.5;
        tree.scale.set(scale, scale, scale);
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.position.set(worldX, groundY, worldZ);
        group.add(tree);
      }
    }

    // 2. Boulders / Rocks
    const rockMat = new THREE.MeshStandardMaterial({
      color: biome.rockColor,
      roughness: 0.9,
      flatShading: true,
    });

    for (let i = 0; i < rockCount; i++) {
      const rx = (Math.random() - 0.5) * size;
      const rz = (Math.random() - 0.5) * size;
      const worldX = originX + rx;
      const worldZ = originZ + rz;
      const groundY = this.getTerrainHeight(worldX, worldZ);

      if (groundY > 0.1) {
        const rockGeo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.8, 1);
        const rockMesh = new THREE.Mesh(rockGeo, rockMat);
        rockMesh.castShadow = true;
        rockMesh.receiveShadow = true;
        rockMesh.scale.set(1.0, 0.6 + Math.random() * 0.6, 1.0);
        rockMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rockMesh.position.set(worldX, groundY + 0.1, worldZ);
        group.add(rockMesh);
      }
    }

    // 3. Glowing flora / Crystals
    for (let i = 0; i < crystalCount; i++) {
      const rx = (Math.random() - 0.5) * size;
      const rz = (Math.random() - 0.5) * size;
      const worldX = originX + rx;
      const worldZ = originZ + rz;
      const groundY = this.getTerrainHeight(worldX, worldZ);

      if (groundY > 0.2) {
        const crystalGeo = new THREE.ConeGeometry(0.2, 0.8, 5);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: biome.accentColor,
          emissive: biome.accentColor,
          emissiveIntensity: biome.id === 'cyber' ? 1.5 : 0.6,
          roughness: 0.2,
        });
        const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
        crystalMesh.position.set(worldX, groundY + 0.35, worldZ);
        crystalMesh.rotation.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.4
        );
        group.add(crystalMesh);
      }
    }
  }

  private createProceduralTree(biome: BiomeConfig, trunkMat: THREE.Material): THREE.Group {
    const tree = new THREE.Group();

    // Trunk
    const trunkHeight = 1.8 + Math.random() * 0.8;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, trunkHeight, 6);
    trunkGeo.translate(0, trunkHeight / 2, 0);
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.castShadow = true;
    tree.add(trunkMesh);

    // Multi-tier foliage canopies
    const foliageColor =
      biome.treeFoliageColors[Math.floor(Math.random() * biome.treeFoliageColors.length)];
    const foliageMat = new THREE.MeshStandardMaterial({
      color: foliageColor,
      roughness: 0.7,
      flatShading: true,
    });

    const isPine = Math.random() > 0.4;
    if (isPine) {
      // Pine cone tiers
      for (let t = 0; t < 3; t++) {
        const radius = 1.2 - t * 0.28;
        const height = 1.4;
        const coneGeo = new THREE.ConeGeometry(radius, height, 7);
        coneGeo.translate(0, trunkHeight + t * 0.75, 0);
        const coneMesh = new THREE.Mesh(coneGeo, foliageMat);
        coneMesh.castShadow = true;
        coneMesh.receiveShadow = true;
        tree.add(coneMesh);
      }
    } else {
      // Rounded spherical low-poly canopy
      const canopyGeo = new THREE.IcosahedronGeometry(1.3, 1);
      canopyGeo.translate(0, trunkHeight + 0.9, 0);
      const canopyMesh = new THREE.Mesh(canopyGeo, foliageMat);
      canopyMesh.castShadow = true;
      canopyMesh.receiveShadow = true;
      tree.add(canopyMesh);
    }

    return tree;
  }

  // ==========================================
  // INPUT & CONTROLS
  // ==========================================
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    this.keys[event.code] = true;

    // Hotkeys
    if (event.code === 'KeyC') {
      this.cycleCamera();
    } else if (event.code === 'KeyB') {
      this.cycleBiome();
    } else if (event.code === 'KeyT') {
      this.cycleTimeOfDay();
    } else if (event.code === 'KeyR') {
      this.resetPosition();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.keys[event.code] = false;
  }

  onPointerDown(event: PointerEvent) {
    this.isPointerDown = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  }

  onPointerMove(event: PointerEvent) {
    const isMouse = event.pointerType === 'mouse';

    // Touch devices require finger touch down; mouse moves camera horizontally freely without clicking
    if (!isMouse && !this.isPointerDown) {
      return;
    }

    // Do not rotate camera when hovering or clicking HUD buttons/modals
    const target = event.target as HTMLElement;
    if (target && target.closest('.glass-panel, button, input, a, .dock-section, .modal-backdrop')) {
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      return;
    }

    if (this.lastPointerX === 0 && this.lastPointerY === 0) {
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      return;
    }

    // Calculate mouse delta
    let dx = 0;
    let dy = 0;
    if (event.movementX !== undefined && Math.abs(event.movementX) < 100) {
      dx = event.movementX;
      dy = event.movementY;
    } else {
      dx = event.clientX - this.lastPointerX;
      dy = event.clientY - this.lastPointerY;
    }

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    // Horizontal axis rotates freely with mouse movement (no click needed)
    this.cameraYaw -= dx * 0.0035;

    // Vertical pitch adjusts with mouse movement
    const pitchFactor = this.isPointerDown ? 0.0035 : 0.002;
    this.cameraPitch += dy * pitchFactor;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch, 0.05, 1.4);
  }

  onPointerUp() {
    this.isPointerDown = false;
  }

  onPointerLeave() {
    this.isPointerDown = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    this.cameraDistance += event.deltaY * 0.005;
    this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance, 2.5, 18);
  }

  // Mobile virtual joystick handlers
  onTouchJoyStart(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    this.touchJoystick.active = true;
    this.touchJoystick.startX = touch.clientX;
    this.touchJoystick.startY = touch.clientY;
    this.touchJoystick.currX = touch.clientX;
    this.touchJoystick.currY = touch.clientY;
  }

  onTouchJoyMove(event: TouchEvent) {
    if (!this.touchJoystick.active) return;
    const touch = event.touches[0];
    const dx = touch.clientX - this.touchJoystick.startX;
    const dy = touch.clientY - this.touchJoystick.startY;
    const maxRadius = 45;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxRadius);
    const angle = Math.atan2(dy, dx);

    this.touchJoystick.currX = this.touchJoystick.startX + Math.cos(angle) * dist;
    this.touchJoystick.currY = this.touchJoystick.startY + Math.sin(angle) * dist;

    this.touchJoystick.moveX = (Math.cos(angle) * dist) / maxRadius;
    this.touchJoystick.moveZ = (Math.sin(angle) * dist) / maxRadius;
  }

  onTouchJoyEnd() {
    this.touchJoystick.active = false;
    this.touchJoystick.moveX = 0;
    this.touchJoystick.moveZ = 0;
  }

  onJumpBtn() {
    if (this.isGrounded) {
      this.charVelocity.y = 11.5;
      this.isGrounded = false;
      this.spawnDust(this.charPos.x, this.charPos.y, this.charPos.z);
    }
  }

  onSprintToggle() {
    this.keys['ShiftLeft'] = !this.keys['ShiftLeft'];
  }

  // ==========================================
  // GAME LOOP & PHYSICS
  // ==========================================
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // FPS Counter
    this.frameCount++;
    if (now - this.lastFpsTime >= 500) {
      this.playerStats.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    this.updateCharacter(dt);
    this.updateCamera(dt);
    this.updateDustParticles(dt);
    this.updateChunks();

    // Render
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updateCharacter(dt: number) {
    // 1. Gather directional input
    let forwardInput = 0;
    let strafeInput = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardInput += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardInput -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafeInput -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafeInput += 1;

    // Merge mobile touch joystick (dragging up gives negative moveZ, which maps to forward)
    if (this.touchJoystick.active) {
      strafeInput += this.touchJoystick.moveX;
      forwardInput -= this.touchJoystick.moveZ;
    }

    const hasInput = Math.abs(forwardInput) > 0.05 || Math.abs(strafeInput) > 0.05;
    const isSprinting = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && hasInput;
    const moveSpeed = isSprinting ? 14.5 : 8.0;

    // 2. Project input relative to camera heading
    let worldMoveDir = new THREE.Vector3(0, 0, 0);
    if (hasInput) {
      const length = Math.sqrt(forwardInput * forwardInput + strafeInput * strafeInput);
      const nf = forwardInput / length;
      const ns = strafeInput / length;

      // Camera forward vector on XZ plane
      const fwdX = Math.sin(this.cameraYaw);
      const fwdZ = Math.cos(this.cameraYaw);

      // Camera right vector on XZ plane
      const rightX = -Math.cos(this.cameraYaw);
      const rightZ = Math.sin(this.cameraYaw);

      worldMoveDir.x = fwdX * nf + rightX * ns;
      worldMoveDir.z = fwdZ * nf + rightZ * ns;

      this.targetRotation = Math.atan2(worldMoveDir.x, worldMoveDir.z);
    }

    // Smoothly rotate character to face target
    let angleDiff = this.targetRotation - this.charRotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.charRotation += angleDiff * Math.min(dt * 14, 1);
    this.characterGroup.rotation.y = this.charRotation;

    // 3. Horizontal velocity lerping
    const targetVelX = worldMoveDir.x * moveSpeed;
    const targetVelZ = worldMoveDir.z * moveSpeed;
    const accelRate = hasInput ? 12 : 16;
    this.charVelocity.x = THREE.MathUtils.lerp(this.charVelocity.x, targetVelX, dt * accelRate);
    this.charVelocity.z = THREE.MathUtils.lerp(this.charVelocity.z, targetVelZ, dt * accelRate);

    // 4. Vertical physics & Ground collision
    const gravity = 28;
    this.charVelocity.y -= gravity * dt;

    if (this.isGrounded && this.keys['Space']) {
      this.charVelocity.y = 11.5;
      this.isGrounded = false;
      this.spawnDust(this.charPos.x, this.charPos.y, this.charPos.z);
    }

    // Apply translation
    this.charPos.x += this.charVelocity.x * dt;
    this.charPos.y += this.charVelocity.y * dt;
    this.charPos.z += this.charVelocity.z * dt;

    // Terrain ground check
    const groundY = this.getTerrainHeight(this.charPos.x, this.charPos.z);
    if (this.charPos.y <= groundY) {
      if (!this.isGrounded && Math.abs(this.charVelocity.y) > 4) {
        this.spawnDust(this.charPos.x, groundY, this.charPos.z);
      }
      this.charPos.y = groundY;
      this.charVelocity.y = 0;
      this.isGrounded = true;
    }

    this.characterGroup.position.copy(this.charPos);

    // 5. Procedural Limb Animation
    const horizontalSpeed = Math.sqrt(
      this.charVelocity.x * this.charVelocity.x + this.charVelocity.z * this.charVelocity.z
    );

    if (this.isGrounded && horizontalSpeed > 0.5) {
      const stepFreq = isSprinting ? 15 : 9.5;
      this.animTimer += dt * stepFreq;

      const legSwing = Math.sin(this.animTimer) * (isSprinting ? 0.75 : 0.55);
      const armSwing = Math.sin(this.animTimer) * (isSprinting ? 0.65 : 0.45);
      const bob = Math.abs(Math.sin(this.animTimer)) * 0.08;

      this.charLeftLeg.rotation.x = legSwing;
      this.charRightLeg.rotation.x = -legSwing;
      this.charLeftArm.rotation.x = -armSwing;
      this.charRightArm.rotation.x = armSwing;
      this.charTorso.position.y = 0.85 + bob;

      // Footstep dust
      if (Math.abs(Math.cos(this.animTimer)) > 0.95 && Math.random() > 0.6) {
        this.spawnDust(this.charPos.x, this.charPos.y, this.charPos.z);
      }
    } else if (!this.isGrounded) {
      // In-air jump posture
      this.charLeftLeg.rotation.x = THREE.MathUtils.lerp(this.charLeftLeg.rotation.x, 0.4, dt * 8);
      this.charRightLeg.rotation.x = THREE.MathUtils.lerp(this.charRightLeg.rotation.x, -0.3, dt * 8);
      this.charLeftArm.rotation.x = THREE.MathUtils.lerp(this.charLeftArm.rotation.x, -0.7, dt * 8);
      this.charRightArm.rotation.x = THREE.MathUtils.lerp(this.charRightArm.rotation.x, -0.7, dt * 8);
      this.charTorso.position.y = 0.85;
    } else {
      // Idle breathing
      this.idleTimer += dt * 2.5;
      const breathe = Math.sin(this.idleTimer) * 0.025;

      this.charLeftLeg.rotation.x = THREE.MathUtils.lerp(this.charLeftLeg.rotation.x, 0, dt * 10);
      this.charRightLeg.rotation.x = THREE.MathUtils.lerp(this.charRightLeg.rotation.x, 0, dt * 10);
      this.charLeftArm.rotation.x = THREE.MathUtils.lerp(this.charLeftArm.rotation.x, 0, dt * 10);
      this.charRightArm.rotation.x = THREE.MathUtils.lerp(this.charRightArm.rotation.x, 0, dt * 10);
      this.charTorso.position.y = 0.85 + breathe;
    }

    // 6. Update HUD Stats
    this.playerStats.posX = this.charPos.x.toFixed(1);
    this.playerStats.posY = this.charPos.y.toFixed(1);
    this.playerStats.posZ = this.charPos.z.toFixed(1);
    this.playerStats.speed = Math.round(horizontalSpeed * 2).toString();
    this.playerStats.state = !this.isGrounded
      ? 'Jumping'
      : horizontalSpeed > 9
      ? 'Sprinting'
      : horizontalSpeed > 0.5
      ? 'Walking'
      : 'Idle';
    this.miniMapAngle = this.charRotation;
  }

  private updateCamera(dt: number) {
    const targetY = this.charPos.y + 1.35;
    const target = new THREE.Vector3(this.charPos.x, targetY, this.charPos.z);

    // Spherical orbit calculation
    const camX = target.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    let camY = target.y + Math.sin(this.cameraPitch) * this.cameraDistance;
    const camZ = target.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    // Prevent camera dipping below terrain surface
    const terrainUnderCam = this.getTerrainHeight(camX, camZ);
    if (camY < terrainUnderCam + 0.8) {
      camY = terrainUnderCam + 0.8;
    }

    const desiredPos = new THREE.Vector3(camX, camY, camZ);
    this.camera.position.lerp(desiredPos, Math.min(dt * 12, 1));
    this.camera.lookAt(target);

    // Keep directional sunlight centered around character for shadow resolution
    if (this.dirLight) {
      this.dirLight.position.set(this.charPos.x + 60, this.charPos.y + 90, this.charPos.z + 50);
      this.dirLight.target.position.copy(this.charPos);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  private updateDustParticles(dt: number) {
    if (!this.dustPositions || !this.dustLife) return;
    const attr = this.dustParticles.geometry.attributes['position'] as THREE.BufferAttribute;

    for (let i = 0; i < 60; i++) {
      if (this.dustLife[i] > 0) {
        this.dustLife[i] -= dt * 2.2;
        this.dustPositions[i * 3 + 1] += dt * 0.4;
        if (this.dustLife[i] <= 0) {
          this.dustPositions[i * 3 + 1] = -100;
        }
      }
    }
    attr.needsUpdate = true;
  }

  // ==========================================
  // CONFIGURATION & BIOMES
  // ==========================================
  selectBiome(biomeId: BiomeId) {
    if (this.activeBiomeId === biomeId) return;
    this.activeBiomeId = biomeId;
    this.applyBiomeSettings();
    this.rebuildAllChunks();
    this.cdr.detectChanges();
  }

  private applyBiomeSettings() {
    const biome = this.currentBiome;
    if (!this.scene) return;

    this.scene.background = new THREE.Color(biome.skyColor);
    this.scene.fog = new THREE.FogExp2(biome.fogColor, 0.012);
    this.ambientLight.color.setHex(biome.ambientColor);
    this.hemiLight.color.setHex(biome.skyColor);
    this.hemiLight.groundColor.setHex(biome.groundColor);
    this.dirLight.color.setHex(biome.sunColor);
    this.dirLight.intensity = biome.sunIntensity;

    // Visor color updates
    this.charVisorMat.color.setHex(biome.accentColor);
    this.charVisorMat.emissive.setHex(biome.accentColor);
    this.charCoreMat.color.setHex(biome.accentColor);
    this.charCoreMat.emissive.setHex(biome.accentColor);
  }

  private rebuildAllChunks() {
    for (const [, chunk] of this.loadedChunks.entries()) {
      this.scene.remove(chunk.mesh);
      this.scene.remove(chunk.propsGroup);
      chunk.mesh.geometry.dispose();
      (chunk.mesh.material as THREE.Material).dispose();
      chunk.propsGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).geometry?.dispose();
        }
      });
    }
    this.loadedChunks.clear();
    this.updateChunks(true);
  }

  setTimeOfDay(time: TimeOfDay) {
    this.activeTimeOfDay = time;
    if (!this.scene) return;

    const biome = this.currentBiome;
    let sky = biome.skyColor;
    let sun = biome.sunColor;
    let ambient = biome.ambientColor;
    let intensity = biome.sunIntensity;
    let starOpacity = 0;
    let flashlight = false;

    switch (time) {
      case 'dawn':
        sky = 0xffa07a;
        sun = 0xffb347;
        ambient = 0x5c3d2e;
        intensity = 0.9;
        starOpacity = 0.1;
        break;
      case 'sunset':
        sky = 0xff6b6b;
        sun = 0xfdcb6e;
        ambient = 0x4a2e35;
        intensity = 0.85;
        starOpacity = 0.2;
        break;
      case 'night':
        sky = 0x070b19;
        sun = 0x6c7a89;
        ambient = 0x0d1527;
        intensity = 0.35;
        starOpacity = 0.95;
        flashlight = true;
        break;
      case 'noon':
      default:
        sky = biome.skyColor;
        sun = biome.sunColor;
        ambient = biome.ambientColor;
        intensity = biome.sunIntensity;
        starOpacity = 0;
        break;
    }

    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.FogExp2(sky, 0.012);
    this.ambientLight.color.setHex(ambient);
    this.dirLight.color.setHex(sun);
    this.dirLight.intensity = intensity;
    this.charFlashlight.visible = flashlight;

    if (this.starsGroup) {
      (this.starsGroup.material as THREE.PointsMaterial).opacity = starOpacity;
    }

    this.cdr.detectChanges();
  }

  setCameraMode(mode: CameraMode) {
    this.activeCameraMode = mode;
    switch (mode) {
      case 'close':
        this.cameraDistance = 3.6;
        this.cameraPitch = 0.25;
        break;
      case 'panoramic':
        this.cameraDistance = 12.0;
        this.cameraPitch = 0.45;
        break;
      case 'medium':
      default:
        this.cameraDistance = 6.5;
        this.cameraPitch = 0.35;
        break;
    }
  }

  cycleCamera() {
    const modes: CameraMode[] = ['close', 'medium', 'panoramic'];
    const idx = (modes.indexOf(this.activeCameraMode) + 1) % modes.length;
    this.setCameraMode(modes[idx]);
  }

  cycleBiome() {
    const list: BiomeId[] = ['meadow', 'autumn', 'cyber', 'tundra'];
    const idx = (list.indexOf(this.activeBiomeId) + 1) % list.length;
    this.selectBiome(list[idx]);
  }

  cycleTimeOfDay() {
    const list: TimeOfDay[] = ['noon', 'sunset', 'night', 'dawn'];
    const idx = (list.indexOf(this.activeTimeOfDay) + 1) % list.length;
    this.setTimeOfDay(list[idx]);
  }

  resetPosition() {
    const groundY = this.getTerrainHeight(0, 0);
    this.charPos.set(0, groundY + 0.1, 0);
    this.charVelocity.set(0, 0, 0);
    this.characterGroup.position.copy(this.charPos);
    this.cameraYaw = 0;
    this.cameraPitch = 0.35;
    this.updateChunks(true);
  }

  toggleHelp() {
    this.isHelpOpen = !this.isHelpOpen;
  }

  toggleControls() {
    this.isControlsCollapsed = !this.isControlsCollapsed;
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.containerRef || !this.renderer || !this.camera) return;
    const width = this.containerRef.nativeElement.clientWidth || window.innerWidth;
    const height = this.containerRef.nativeElement.clientHeight || window.innerHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  private disposeScene() {
    this.rebuildAllChunks();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
