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
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopPanel } from '../../top-panel/top-panel';

import {
  Engine,
  Scene,
  ArcRotateCamera,
  UniversalCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  PBRMaterial,
  VertexBuffer,
  VertexData,
  ParticleSystem,
  Texture,
  DynamicTexture,
  GlowLayer,
  AbstractMesh,
  Animation,
} from '@babylonjs/core';

export type BiomeType = 'alpine' | 'canyon' | 'twilight' | 'tundra';
export type TimeOfDayType = 'day' | 'sunset' | 'night' | 'dawn';
export type CameraModeType = 'orbit' | 'fly' | 'walk';

interface BiomePalette {
  name: string;
  icon: string;
  skyZenith: Color3;
  skyHorizon: Color3;
  fogColor: Color3;
  sunColor: Color3;
  sunIntensity: number;
  hemiColor: Color3;
  waterColor: Color3;
  waterAlpha: number;
  sandColor: Color3;
  grassColor: Color3;
  forestColor: Color3;
  rockColor: Color3;
  snowColor: Color3;
  treeLeavesColor: Color3[];
  trunkColor: Color3;
  rockObjColor: Color3;
  accentGlow: Color3;
}

// Procedural Simplex-like Perlin Noise Generator
class FastNoise {
  private p: number[] = [];

  constructor(seed = 1337) {
    this.reseed(seed);
  }

  reseed(seed: number) {
    const perm = new Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 11) % 2147483647;
      const j = s % (i + 1);
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255];
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number) {
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

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));
    return this.lerp(v, x1, x2);
  }

  octaveNoise(x: number, y: number, octaves = 5, persistence = 0.5, lacunarity = 2.0): number {
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

@Component({
  selector: 'app-babylonopenworld',
  standalone: true,
  imports: [CommonModule, RouterLink, TopPanel],
  templateUrl: './babylonopenworld.html',
  styleUrl: './babylonopenworld.scss',
})
export class Babylonopenworld implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Reactive state signals
  readonly loading = signal(true);
  readonly currentSeed = signal(4289);
  readonly currentBiome = signal<BiomeType>('alpine');
  readonly currentTimeOfDay = signal<TimeOfDayType>('day');
  readonly currentCameraMode = signal<CameraModeType>('orbit');
  readonly autoOrbit = signal(true);
  readonly showWater = signal(true);
  readonly showVegetation = signal(true);
  readonly mountainHeight = signal(26);
  readonly soundEnabled = signal(false);
  readonly fps = signal(60);
  readonly objectCount = signal(0);
  readonly terrainTriangles = signal(0);

  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private orbitCamera: ArcRotateCamera | null = null;
  private flyCamera: UniversalCamera | null = null;

  private hemiLight: HemisphericLight | null = null;
  private sunLight: DirectionalLight | null = null;
  private shadowGen: ShadowGenerator | null = null;
  private glowLayer: GlowLayer | null = null;

  private terrainMesh: Mesh | null = null;
  private waterMesh: Mesh | null = null;
  private skyDome: Mesh | null = null;
  private sunSphere: Mesh | null = null;
  private spawnedNatureMeshes: Mesh[] = [];
  private clouds: Mesh[] = [];
  private particleSystem: ParticleSystem | null = null;

  private noise = new FastNoise(4289);
  private animTime = 0;
  private audioCtx: AudioContext | null = null;
  private audioGain: GainNode | null = null;

  // Biome color configurations
  private readonly palettes: Record<BiomeType, BiomePalette> = {
    alpine: {
      name: 'Alpine Forest',
      icon: '🌲',
      skyZenith: new Color3(0.08, 0.42, 0.88),
      skyHorizon: new Color3(0.68, 0.84, 0.96),
      fogColor: new Color3(0.65, 0.82, 0.95),
      sunColor: new Color3(1.0, 0.95, 0.85),
      sunIntensity: 1.5,
      hemiColor: new Color3(0.3, 0.45, 0.55),
      waterColor: new Color3(0.05, 0.55, 0.85),
      waterAlpha: 0.72,
      sandColor: new Color3(0.82, 0.76, 0.58),
      grassColor: new Color3(0.24, 0.58, 0.22),
      forestColor: new Color3(0.12, 0.38, 0.16),
      rockColor: new Color3(0.42, 0.44, 0.46),
      snowColor: new Color3(0.96, 0.98, 1.0),
      treeLeavesColor: [new Color3(0.1, 0.42, 0.18), new Color3(0.16, 0.52, 0.24), new Color3(0.08, 0.32, 0.14)],
      trunkColor: new Color3(0.35, 0.22, 0.12),
      rockObjColor: new Color3(0.45, 0.46, 0.48),
      accentGlow: new Color3(0.0, 0.9, 1.0),
    },
    canyon: {
      name: 'Red Rock Canyon',
      icon: '🏜️',
      skyZenith: new Color3(0.12, 0.48, 0.86),
      skyHorizon: new Color3(0.94, 0.75, 0.58),
      fogColor: new Color3(0.88, 0.68, 0.52),
      sunColor: new Color3(1.0, 0.92, 0.76),
      sunIntensity: 1.6,
      hemiColor: new Color3(0.5, 0.4, 0.35),
      waterColor: new Color3(0.1, 0.65, 0.75),
      waterAlpha: 0.78,
      sandColor: new Color3(0.88, 0.65, 0.44),
      grassColor: new Color3(0.72, 0.52, 0.32),
      forestColor: new Color3(0.62, 0.4, 0.26),
      rockColor: new Color3(0.78, 0.38, 0.22),
      snowColor: new Color3(0.95, 0.88, 0.8),
      treeLeavesColor: [new Color3(0.35, 0.48, 0.2), new Color3(0.48, 0.44, 0.18)],
      trunkColor: new Color3(0.42, 0.28, 0.18),
      rockObjColor: new Color3(0.74, 0.36, 0.22),
      accentGlow: new Color3(1.0, 0.55, 0.1),
    },
    twilight: {
      name: 'Mystic Twilight',
      icon: '✨',
      skyZenith: new Color3(0.08, 0.04, 0.22),
      skyHorizon: new Color3(0.42, 0.15, 0.48),
      fogColor: new Color3(0.22, 0.08, 0.32),
      sunColor: new Color3(0.65, 0.45, 1.0),
      sunIntensity: 1.1,
      hemiColor: new Color3(0.25, 0.15, 0.4),
      waterColor: new Color3(0.3, 0.1, 0.75),
      waterAlpha: 0.82,
      sandColor: new Color3(0.35, 0.22, 0.48),
      grassColor: new Color3(0.18, 0.42, 0.55),
      forestColor: new Color3(0.32, 0.15, 0.52),
      rockColor: new Color3(0.22, 0.18, 0.32),
      snowColor: new Color3(0.75, 0.7, 0.95),
      treeLeavesColor: [new Color3(0.2, 0.75, 0.85), new Color3(0.65, 0.2, 0.85), new Color3(0.1, 0.9, 0.7)],
      trunkColor: new Color3(0.18, 0.12, 0.28),
      rockObjColor: new Color3(0.28, 0.2, 0.38),
      accentGlow: new Color3(0.8, 0.2, 1.0),
    },
    tundra: {
      name: 'Glacial Tundra',
      icon: '❄️',
      skyZenith: new Color3(0.18, 0.38, 0.65),
      skyHorizon: new Color3(0.78, 0.86, 0.94),
      fogColor: new Color3(0.75, 0.84, 0.92),
      sunColor: new Color3(0.95, 0.98, 1.0),
      sunIntensity: 1.4,
      hemiColor: new Color3(0.4, 0.5, 0.6),
      waterColor: new Color3(0.12, 0.45, 0.7),
      waterAlpha: 0.85,
      sandColor: new Color3(0.72, 0.78, 0.82),
      grassColor: new Color3(0.55, 0.68, 0.72),
      forestColor: new Color3(0.35, 0.48, 0.52),
      rockColor: new Color3(0.45, 0.5, 0.55),
      snowColor: new Color3(0.98, 0.99, 1.0),
      treeLeavesColor: [new Color3(0.18, 0.35, 0.32), new Color3(0.65, 0.78, 0.82)],
      trunkColor: new Color3(0.25, 0.22, 0.2),
      rockObjColor: new Color3(0.42, 0.48, 0.52),
      accentGlow: new Color3(0.4, 0.8, 1.0),
    },
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdRef: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      this.initBabylon();
    }, 50);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.removeEventListener('resize', this.onResize);
    this.stopAudio();
    this.scene?.dispose();
    this.engine?.dispose();
  }

  @HostListener('window:resize')
  private onResize = () => {
    this.engine?.resize();
  };

  // -------------------------------------------------------------
  // Babylon.js Initialization
  // -------------------------------------------------------------
  private initBabylon(): void {
    const canvas = this.canvasRef.nativeElement;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.08, 0.14, 1.0);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0035;

    // Glow Layer for atmospheric sun and particles
    this.glowLayer = new GlowLayer('glow', this.scene, {
      mainTextureRatio: 0.5,
      blurKernelSize: 32,
    });
    this.glowLayer.intensity = 0.65;

    this.setupCameras(canvas);
    this.setupLights();
    this.setupSkyAndSun();
    this.buildTerrain();
    this.buildWater();
    this.buildVegetation();
    this.buildClouds();
    this.setupParticles();
    this.applyBiomeAndLighting();

    // Render loop
    const engine = this.engine;
    engine.runRenderLoop(() => {
      if (!this.scene) return;
      this.animTime += 0.016;

      // Animate auto-orbit camera
      if (this.autoOrbit() && this.currentCameraMode() === 'orbit' && this.orbitCamera) {
        this.orbitCamera.alpha += 0.002;
      }

      // Animate water gentle undulation
      if (this.waterMesh) {
        this.waterMesh.position.y = 1.8 + Math.sin(this.animTime * 1.5) * 0.15;
      }

      // Animate slow drifting clouds
      for (const cloud of this.clouds) {
        cloud.position.x += 0.04;
        if (cloud.position.x > 140) {
          cloud.position.x = -140;
        }
      }

      // Update FPS & metrics periodically
      if (this.scene.getFrameId() % 30 === 0) {
        this.fps.set(Math.round(engine.getFps()));
      }

      this.scene.render();
    });

    this.loading.set(false);
    this.cdRef.detectChanges();
  }

  // -------------------------------------------------------------
  // Cameras
  // -------------------------------------------------------------
  private setupCameras(canvas: HTMLCanvasElement): void {
    if (!this.scene) return;

    // ArcRotate Orbit Camera
    this.orbitCamera = new ArcRotateCamera(
      'orbitCam',
      -Math.PI / 3,
      Math.PI / 3.2,
      120,
      new Vector3(0, 8, 0),
      this.scene
    );
    this.orbitCamera.lowerRadiusLimit = 20;
    this.orbitCamera.upperRadiusLimit = 220;
    this.orbitCamera.lowerBetaLimit = 0.1;
    this.orbitCamera.upperBetaLimit = Math.PI / 2.05;
    this.orbitCamera.wheelDeltaPercentage = 0.015;
    this.orbitCamera.inertia = 0.85;
    this.orbitCamera.attachControl(canvas, true);

    // Universal Fly / Drone Camera
    this.flyCamera = new UniversalCamera('flyCam', new Vector3(0, 25, -60), this.scene);
    this.flyCamera.setTarget(new Vector3(0, 10, 0));
    this.flyCamera.speed = 1.2;
    this.flyCamera.angularSensibility = 2500;
  }

  setCameraMode(mode: CameraModeType): void {
    if (!this.scene || !this.orbitCamera || !this.flyCamera) return;
    this.currentCameraMode.set(mode);
    const canvas = this.canvasRef.nativeElement;

    this.orbitCamera.detachControl();
    this.flyCamera.detachControl();

    if (mode === 'orbit') {
      this.scene.activeCamera = this.orbitCamera;
      this.orbitCamera.attachControl(canvas, true);
    } else {
      this.scene.activeCamera = this.flyCamera;
      this.flyCamera.attachControl(canvas, true);
      if (mode === 'walk') {
        const h = this.getTerrainHeightAt(this.flyCamera.position.x, this.flyCamera.position.z);
        this.flyCamera.position.y = Math.max(h + 3.0, 3.5);
      }
    }
  }

  toggleAutoOrbit(): void {
    this.autoOrbit.update((val) => !val);
  }

  // -------------------------------------------------------------
  // Lighting & Shadows
  // -------------------------------------------------------------
  private setupLights(): void {
    if (!this.scene) return;

    this.hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    this.hemiLight.intensity = 0.65;

    this.sunLight = new DirectionalLight('sunLight', new Vector3(-0.6, -0.8, -0.5), this.scene);
    this.sunLight.position = new Vector3(80, 120, 80);
    this.sunLight.intensity = 1.4;

    this.shadowGen = new ShadowGenerator(1024, this.sunLight);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.blurKernel = 16;
    this.shadowGen.darkness = 0.35;
  }

  // -------------------------------------------------------------
  // Sky & Celestial Sun Orb
  // -------------------------------------------------------------
  private setupSkyAndSun(): void {
    if (!this.scene) return;

    // Sky Dome
    this.skyDome = MeshBuilder.CreateSphere('skyDome', { diameter: 450, segments: 16 }, this.scene);
    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.emissiveColor = new Color3(0.1, 0.4, 0.85);
    this.skyDome.material = skyMat;

    // Sun / Moon Orb
    this.sunSphere = MeshBuilder.CreateSphere('sunSphere', { diameter: 14, segments: 16 }, this.scene);
    this.sunSphere.position = new Vector3(-120, 140, -100);
    const sunMat = new StandardMaterial('sunMat', this.scene);
    sunMat.emissiveColor = new Color3(1.0, 0.95, 0.7);
    sunMat.disableLighting = true;
    this.sunSphere.material = sunMat;

    if (this.glowLayer) {
      this.glowLayer.addIncludedOnlyMesh(this.sunSphere);
    }
  }

  // -------------------------------------------------------------
  // Procedural Terrain Generation
  // -------------------------------------------------------------
  private getTerrainHeightAt(x: number, z: number): number {
    const scale = 0.016;
    const heightScale = this.mountainHeight();

    // Base rolling hills and broad terrain shape
    const base = this.noise.octaveNoise(x * scale, z * scale, 4, 0.52, 2.0);

    // Mountain ridges (ridged noise)
    const ridgeRaw = Math.abs(this.noise.noise2D(x * scale * 2.2 + 10, z * scale * 2.2 + 20));
    const ridge = Math.pow(1.0 - ridgeRaw, 2.5);

    // Island falloff to ensure deep water at boundary edges
    const distFromCenter = Math.sqrt(x * x + z * z);
    const maxRadius = 90;
    const falloff = Math.max(0, 1.0 - Math.pow(distFromCenter / maxRadius, 2.5));

    const totalHeight = (base * 0.7 + ridge * 0.5) * heightScale * falloff;
    return totalHeight;
  }

  private buildTerrain(): void {
    if (!this.scene) return;
    if (this.terrainMesh) {
      this.terrainMesh.dispose();
      this.terrainMesh = null;
    }

    const width = 190;
    const depth = 190;
    const subdivisions = 95;

    // Create ground mesh with custom vertex heights and colors
    this.terrainMesh = MeshBuilder.CreateGround(
      'terrain',
      { width, height: depth, subdivisions, updatable: true },
      this.scene
    );
    this.terrainMesh.receiveShadows = true;

    const positions = this.terrainMesh.getVerticesData(VertexBuffer.PositionKind);
    const colors: number[] = [];

    if (!positions) return;

    const palette = this.palettes[this.currentBiome()];

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      const y = this.getTerrainHeightAt(x, z);
      positions[i + 1] = y;

      // Color classification based on elevation
      let c: Color3;
      if (y < 2.0) {
        // Sand / shore
        c = palette.sandColor;
      } else if (y < 8.0) {
        // Lush lowland grass
        const blend = (y - 2.0) / 6.0;
        c = Color3.Lerp(palette.sandColor, palette.grassColor, blend);
      } else if (y < 16.0) {
        // Forest green
        const blend = (y - 8.0) / 8.0;
        c = Color3.Lerp(palette.grassColor, palette.forestColor, blend);
      } else if (y < 23.0) {
        // Mountain rock
        const blend = (y - 16.0) / 7.0;
        c = Color3.Lerp(palette.forestColor, palette.rockColor, blend);
      } else {
        // Snow capped summits
        const blend = Math.min(1.0, (y - 23.0) / 6.0);
        c = Color3.Lerp(palette.rockColor, palette.snowColor, blend);
      }

      colors.push(c.r, c.g, c.b, 1.0);
    }

    // Recompute normals for crisp low-poly / stylized shading
    const indices = this.terrainMesh.getIndices();
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);

    this.terrainMesh.setVerticesData(VertexBuffer.PositionKind, positions);
    this.terrainMesh.setVerticesData(VertexBuffer.NormalKind, normals);
    this.terrainMesh.setVerticesData(VertexBuffer.ColorKind, colors);

    const terrainMat = new StandardMaterial('terrainMat', this.scene);
    terrainMat.specularColor = new Color3(0.08, 0.08, 0.08);
    terrainMat.roughness = 0.9;
    this.terrainMesh.material = terrainMat;

    if (this.shadowGen) {
      this.shadowGen.addShadowCaster(this.terrainMesh);
    }

    this.terrainTriangles.set(subdivisions * subdivisions * 2);
  }

  // -------------------------------------------------------------
  // Translucent Reflective Water
  // -------------------------------------------------------------
  private buildWater(): void {
    if (!this.scene) return;
    if (this.waterMesh) {
      this.waterMesh.dispose();
      this.waterMesh = null;
    }

    this.waterMesh = MeshBuilder.CreateGround(
      'water',
      { width: 200, height: 200, subdivisions: 2 },
      this.scene
    );
    this.waterMesh.position.y = 1.8;

    const waterMat = new StandardMaterial('waterMat', this.scene);
    const palette = this.palettes[this.currentBiome()];
    waterMat.diffuseColor = palette.waterColor;
    waterMat.specularColor = new Color3(1.0, 1.0, 1.0);
    waterMat.specularPower = 64;
    waterMat.alpha = palette.waterAlpha;
    waterMat.backFaceCulling = false;

    this.waterMesh.material = waterMat;
    this.waterMesh.setEnabled(this.showWater());
  }

  // -------------------------------------------------------------
  // Procedural Vegetation (Pine Trees, Boulders, Deciduous)
  // -------------------------------------------------------------
  private buildVegetation(): void {
    if (!this.scene) return;

    // Clean existing spawned meshes
    for (const m of this.spawnedNatureMeshes) {
      m.dispose();
    }
    this.spawnedNatureMeshes = [];

    if (!this.showVegetation()) {
      this.objectCount.set(0);
      return;
    }

    const palette = this.palettes[this.currentBiome()];

    // Base Pine Tree Prototype
    const trunkMat = new StandardMaterial('trunkMat', this.scene);
    trunkMat.diffuseColor = palette.trunkColor;
    trunkMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const leafMat = new StandardMaterial('leafMat', this.scene);
    leafMat.diffuseColor = palette.treeLeavesColor[0];
    leafMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const rockMat = new StandardMaterial('rockMat', this.scene);
    rockMat.diffuseColor = palette.rockObjColor;
    rockMat.specularColor = new Color3(0.08, 0.08, 0.08);

    // Prototype Pine Tree
    const trunkProto = MeshBuilder.CreateCylinder('trunkProto', { height: 1.8, diameterTop: 0.35, diameterBottom: 0.55 }, this.scene);
    trunkProto.material = trunkMat;
    trunkProto.position.y = 0.9;

    const foliage1 = MeshBuilder.CreateCylinder('f1', { height: 2.2, diameterTop: 0.1, diameterBottom: 2.4, tessellation: 7 }, this.scene);
    foliage1.material = leafMat;
    foliage1.position.y = 2.0;

    const foliage2 = MeshBuilder.CreateCylinder('f2', { height: 1.9, diameterTop: 0.05, diameterBottom: 1.8, tessellation: 7 }, this.scene);
    foliage2.material = leafMat;
    foliage2.position.y = 3.2;

    const pineMaster = Mesh.MergeMeshes([trunkProto, foliage1, foliage2], true, true, undefined, false, true);
    if (!pineMaster) return;
    pineMaster.isVisible = false;

    // Prototype Low-Poly Boulder
    const rockProto = MeshBuilder.CreatePolyhedron('rockProto', { type: 2, size: 1.4 }, this.scene);
    rockProto.material = rockMat;
    rockProto.isVisible = false;

    const placedCount = 140;
    let successfulCount = 0;

    for (let i = 0; i < placedCount; i++) {
      const angle = (i / placedCount) * Math.PI * 2 * 6.5;
      const radius = 12 + Math.sqrt(i / placedCount) * 72;
      const jitterX = (Math.sin(i * 3.7) * 4);
      const jitterZ = (Math.cos(i * 5.1) * 4);
      const x = Math.cos(angle) * radius + jitterX;
      const z = Math.sin(angle) * radius + jitterZ;

      const y = this.getTerrainHeightAt(x, z);

      // Only place vegetation on land above water and below steep rocky summits
      if (y > 2.6 && y < 22.0) {
        if (i % 5 === 0) {
          // Spawn low-poly boulder
          const rockInstance = rockProto.createInstance('rock_' + i);
          rockInstance.position = new Vector3(x, y + 0.3, z);
          const rScale = 0.6 + (Math.sin(i) * 0.5 + 0.5) * 0.9;
          rockInstance.scaling = new Vector3(rScale, rScale * 0.75, rScale);
          rockInstance.rotation = new Vector3(i * 0.4, i * 1.2, i * 0.3);
          this.spawnedNatureMeshes.push(rockInstance as unknown as Mesh);
          if (this.shadowGen) this.shadowGen.addShadowCaster(rockInstance);
        } else {
          // Spawn Pine Tree
          const treeInstance = pineMaster.createInstance('tree_' + i);
          treeInstance.position = new Vector3(x, y, z);
          const tScale = 0.75 + (Math.cos(i * 2.3) * 0.5 + 0.5) * 0.75;
          treeInstance.scaling = new Vector3(tScale, tScale, tScale);
          treeInstance.rotation.y = (i * 1.3) % (Math.PI * 2);
          this.spawnedNatureMeshes.push(treeInstance as unknown as Mesh);
          if (this.shadowGen) this.shadowGen.addShadowCaster(treeInstance);
        }
        successfulCount++;
      }
    }

    pineMaster.dispose();
    rockProto.dispose();
    this.objectCount.set(successfulCount);
  }

  // -------------------------------------------------------------
  // Drifting Procedural Clouds
  // -------------------------------------------------------------
  private buildClouds(): void {
    if (!this.scene) return;
    for (const c of this.clouds) c.dispose();
    this.clouds = [];

    const cloudMat = new StandardMaterial('cloudMat', this.scene);
    cloudMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
    cloudMat.specularColor = new Color3(0.0, 0.0, 0.0);
    cloudMat.alpha = 0.85;

    for (let i = 0; i < 9; i++) {
      const parts: Mesh[] = [];
      const numPuffs = 4 + (i % 3);

      for (let j = 0; j < numPuffs; j++) {
        const puff = MeshBuilder.CreateSphere(`puff_${i}_${j}`, { diameter: 7 + (j % 3) * 3, segments: 6 }, this.scene);
        puff.position = new Vector3((j - numPuffs / 2) * 5, Math.sin(j) * 1.5, Math.cos(j) * 3);
        parts.push(puff);
      }

      const cloud = Mesh.MergeMeshes(parts, true, true);
      if (cloud) {
        cloud.material = cloudMat;
        cloud.position = new Vector3(-120 + i * 28, 55 + (i % 3) * 6, -80 + (i % 4) * 45);
        cloud.scaling = new Vector3(1.4, 0.65, 1.2);
        this.clouds.push(cloud);
      }
    }
  }

  // -------------------------------------------------------------
  // Bioluminescent Spore / Firefly Particle System
  // -------------------------------------------------------------
  private setupParticles(): void {
    if (!this.scene) return;
    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }

    const emitter = MeshBuilder.CreateBox('particleEmitter', { size: 0.1 }, this.scene);
    emitter.isVisible = false;
    emitter.position = new Vector3(0, 8, 0);

    this.particleSystem = new ParticleSystem('spores', 300, this.scene);
    // Create soft round dynamic texture particle
    const pTex = new DynamicTexture('pTex', 64, this.scene, false);
    const ctx = pTex.getContext();
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(0,242,254,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    pTex.update();

    this.particleSystem.particleTexture = pTex;
    this.particleSystem.emitter = emitter;
    this.particleSystem.minEmitBox = new Vector3(-60, 2, -60);
    this.particleSystem.maxEmitBox = new Vector3(60, 18, 60);

    const palette = this.palettes[this.currentBiome()];
    this.particleSystem.color1 = new Color4(palette.accentGlow.r, palette.accentGlow.g, palette.accentGlow.b, 0.8);
    this.particleSystem.color2 = new Color4(palette.accentGlow.r * 0.7, palette.accentGlow.g * 0.7, 1.0, 0.4);
    this.particleSystem.colorDead = new Color4(0, 0, 0, 0);

    this.particleSystem.minSize = 0.5;
    this.particleSystem.maxSize = 1.6;
    this.particleSystem.minLifeTime = 3.0;
    this.particleSystem.maxLifeTime = 6.5;
    this.particleSystem.emitRate = 45;
    this.particleSystem.gravity = new Vector3(0, 0.05, 0);
    this.particleSystem.direction1 = new Vector3(-0.3, 0.4, -0.3);
    this.particleSystem.direction2 = new Vector3(0.3, 0.8, 0.3);
    this.particleSystem.start();
  }

  // -------------------------------------------------------------
  // Biome & Lighting Application
  // -------------------------------------------------------------
  private applyBiomeAndLighting(): void {
    if (!this.scene || !this.hemiLight || !this.sunLight) return;

    const palette = this.palettes[this.currentBiome()];
    const tod = this.currentTimeOfDay();

    // Adjust light directions and intensity based on Time of Day
    let sunPos: Vector3;
    let sunCol: Color3;
    let sunPower: number;
    let skyCol: Color3;
    let fogCol: Color3;

    switch (tod) {
      case 'dawn':
        sunPos = new Vector3(-110, 35, -90);
        sunCol = new Color3(1.0, 0.65, 0.45);
        sunPower = 1.1;
        skyCol = new Color3(0.55, 0.42, 0.65);
        fogCol = new Color3(0.65, 0.52, 0.58);
        break;
      case 'sunset':
        sunPos = new Vector3(-130, 25, 40);
        sunCol = new Color3(1.0, 0.48, 0.22);
        sunPower = 1.25;
        skyCol = new Color3(0.72, 0.32, 0.38);
        fogCol = new Color3(0.68, 0.38, 0.35);
        break;
      case 'night':
        sunPos = new Vector3(90, 110, 80);
        sunCol = new Color3(0.45, 0.65, 1.0);
        sunPower = 0.5;
        skyCol = new Color3(0.04, 0.06, 0.16);
        fogCol = new Color3(0.06, 0.08, 0.18);
        break;
      case 'day':
      default:
        sunPos = new Vector3(80, 130, 80);
        sunCol = palette.sunColor;
        sunPower = palette.sunIntensity;
        skyCol = palette.skyZenith;
        fogCol = palette.fogColor;
        break;
    }

    this.sunLight.position = sunPos;
    this.sunLight.setDirectionToTarget(new Vector3(0, 0, 0));
    this.sunLight.diffuse = sunCol;
    this.sunLight.intensity = sunPower;

    this.hemiLight.diffuse = palette.hemiColor;
    this.scene.fogColor = fogCol;

    if (this.skyDome && this.skyDome.material) {
      (this.skyDome.material as StandardMaterial).emissiveColor = skyCol;
    }
    if (this.sunSphere) {
      this.sunSphere.position = sunPos.scale(1.2);
      if (this.sunSphere.material) {
        (this.sunSphere.material as StandardMaterial).emissiveColor = sunCol;
      }
    }
  }

  // -------------------------------------------------------------
  // Public Interactive Controls
  // -------------------------------------------------------------
  selectBiome(biome: BiomeType): void {
    this.currentBiome.set(biome);
    this.buildTerrain();
    this.buildWater();
    this.buildVegetation();
    this.setupParticles();
    this.applyBiomeAndLighting();
  }

  setTimeOfDay(tod: TimeOfDayType): void {
    this.currentTimeOfDay.set(tod);
    this.applyBiomeAndLighting();
  }

  regenerateWorld(): void {
    const newSeed = Math.floor(Math.random() * 90000) + 1000;
    this.currentSeed.set(newSeed);
    this.noise.reseed(newSeed);
    this.buildTerrain();
    this.buildWater();
    this.buildVegetation();
    this.setupParticles();
  }

  updateMountainHeight(val: number): void {
    this.mountainHeight.set(val);
    this.buildTerrain();
    this.buildVegetation();
  }

  toggleWater(): void {
    this.showWater.update((v) => !v);
    if (this.waterMesh) {
      this.waterMesh.setEnabled(this.showWater());
    }
  }

  toggleVegetation(): void {
    this.showVegetation.update((v) => !v);
    this.buildVegetation();
  }

  // -------------------------------------------------------------
  // Ambient Sound Synthesis (Breeze / Mountain Wind)
  // -------------------------------------------------------------
  toggleSound(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);

    if (next) {
      this.startAudio();
    } else {
      this.stopAudio();
    }
  }

  private startAudio(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();

      // Generate brown noise buffer for deep wind ambiance
      const bufferSize = this.audioCtx.sampleRate * 2;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      const noiseNode = this.audioCtx.createBufferSource();
      noiseNode.buffer = buffer;
      noiseNode.loop = true;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.audioCtx.currentTime);

      this.audioGain = this.audioCtx.createGain();
      this.audioGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);

      noiseNode.connect(filter);
      filter.connect(this.audioGain);
      this.audioGain.connect(this.audioCtx.destination);
      noiseNode.start();
    } catch {
      // Audio autoplay policy catch
    }
  }

  private stopAudio(): void {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  get biomesList(): { id: BiomeType; name: string; icon: string }[] {
    return [
      { id: 'alpine', name: 'Alpine Forest', icon: '🌲' },
      { id: 'canyon', name: 'Red Canyon', icon: '🏜️' },
      { id: 'twilight', name: 'Mystic Twilight', icon: '✨' },
      { id: 'tundra', name: 'Glacial Tundra', icon: '❄️' },
    ];
  }

  get timeList(): { id: TimeOfDayType; label: string; icon: string }[] {
    return [
      { id: 'day', label: 'Day', icon: '☀️' },
      { id: 'sunset', label: 'Sunset', icon: '🌅' },
      { id: 'night', label: 'Night', icon: '🌙' },
      { id: 'dawn', label: 'Dawn', icon: '🌄' },
    ];
  }
}
