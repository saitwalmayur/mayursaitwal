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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface BlockCoord {
  x: number;
  y: number;
  z: number;
}

export interface TetrisPieceDef {
  type: string;
  name: string;
  color: number;
  glowColor: string;
  blocks: [number, number, number][];
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const PIECE_DEFS: TetrisPieceDef[] = [
  {
    type: 'I',
    name: 'I-Piece',
    color: 0x00f2fe,
    glowColor: '#00f2fe',
    blocks: [[0, 1, 0], [1, 1, 0], [2, 1, 0], [3, 1, 0]],
  },
  {
    type: 'O',
    name: 'O-Piece',
    color: 0xffd200,
    glowColor: '#ffd200',
    blocks: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  },
  {
    type: 'T',
    name: 'T-Piece',
    color: 0xa855f7,
    glowColor: '#a855f7',
    blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]],
  },
  {
    type: 'L',
    name: 'L-Piece',
    color: 0xf97316,
    glowColor: '#f97316',
    blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]],
  },
  {
    type: 'J',
    name: 'J-Piece',
    color: 0x3b82f6,
    glowColor: '#3b82f6',
    blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]],
  },
  {
    type: 'S',
    name: 'S-Piece',
    color: 0x10b981,
    glowColor: '#10b981',
    blocks: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]],
  },
  {
    type: 'Z',
    name: 'Z-Piece',
    color: 0xef4444,
    glowColor: '#ef4444',
    blocks: [[1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0]],
  },
];

@Component({
  selector: 'app-threejstetris',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './threejstetris.html',
  styleUrl: './threejstetris.scss',
})
export class Threejstetris implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer', { static: false })
  viewportContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rendererCanvas', { static: false })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;

  // Grid dimensions: Classic 10 wide x 20 high x 1 deep
  public readonly GRID_W = 10;
  public readonly GRID_H = 20;
  public readonly GRID_D = 1;
  public readonly BLOCK_SIZE = 1.0;
  public readonly GAP = 0.05;

  // Game state
  public score = 0;
  public highScore = 0;
  public level = 1;
  public linesCleared = 0;
  public isGameOver = false;
  public isPaused = false;
  public isSoundMuted = false;
  public canHold = true;
  public currentPieceDef: TetrisPieceDef | null = null;
  public nextPieceDef: TetrisPieceDef | null = null;
  public holdPieceDef: TetrisPieceDef | null = null;
  public rowFillPercentages: number[] = Array(20).fill(0);
  public lastComboText: string | null = null;
  public activeCamPreset: 'iso' | 'top' | 'front' | 'free' = 'iso';
  public uiSide: 'right' | 'left' = 'right';
  public isControlsCollapsed = false;

  public toggleUiSide(): void {
    this.uiSide = this.uiSide === 'right' ? 'left' : 'right';
    this.cdr.detectChanges();
  }

  public toggleControlsCollapsed(): void {
    this.isControlsCollapsed = !this.isControlsCollapsed;
    this.cdr.detectChanges();
  }

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animFrameId: number | null = null;
  private clock = new THREE.Clock();

  // Grid Matrix: [y][x][z] -> Mesh | null
  private gridMatrix: (THREE.Mesh | null)[][][] = [];

  // Active Piece
  private activePieceGroup: THREE.Group | null = null;
  private activePieceCoords: BlockCoord[] = [];
  private activePiecePosition: BlockCoord = { x: 0, y: 0, z: 0 };
  private activePieceDefInternal: TetrisPieceDef | null = null;

  // Ghost Piece
  private ghostGroup: THREE.Group | null = null;

  // Hologram Previews in 3D Scene
  private nextPreviewGroup: THREE.Group | null = null;
  private holdPreviewGroup: THREE.Group | null = null;

  // Visuals & Effects
  private cageGroup!: THREE.Group;
  private particles: Particle[] = [];
  private sharedBoxGeo!: THREE.BoxGeometry;
  private sharedEdgesGeo!: THREE.EdgesGeometry;
  private materialCache = new Map<number, THREE.Material>();

  // Timing
  private dropTimer = 0;
  private dropInterval = 1.0; // seconds per drop tick

  // Web Audio Context
  private audioCtx: AudioContext | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.loadHighScore();
    this.initThree();
    this.initGridMatrix();
    this.buildCage();
    this.buildHologramPedestals();
    this.startNewGame();
    this.animate();
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.sharedBoxGeo) {
      this.sharedBoxGeo.dispose();
    }

    if (this.sharedEdgesGeo) {
      this.sharedEdgesGeo.dispose();
    }

    this.materialCache.forEach((mat) => mat.dispose());
    this.materialCache.clear();

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
    }
  }

  // --- INITIALIZATION ---
  private initThree(): void {
    const container = this.viewportContainer.nativeElement;
    const canvas = this.rendererCanvas.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070913);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // OrbitControls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 60;
    this.controls.minDistance = 8;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.target.set(
      (this.GRID_W * this.BLOCK_SIZE) / 2,
      (this.GRID_H * this.BLOCK_SIZE) / 2,
      0.5
    );

    this.setCameraPreset('iso');

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f2fe, 1.8);
    dirLight1.position.set(15, 25, 20);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff0077, 1.4);
    dirLight2.position.set(-15, 20, 15);
    this.scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 1.2, 35);
    pointLight.position.set(5, 12, 10);
    this.scene.add(pointLight);

    // Shared Geometry for 3D cubes
    this.sharedBoxGeo = new THREE.BoxGeometry(
      this.BLOCK_SIZE - this.GAP,
      this.BLOCK_SIZE - this.GAP,
      this.BLOCK_SIZE - this.GAP
    );
    this.sharedEdgesGeo = new THREE.EdgesGeometry(this.sharedBoxGeo);
  }

  private initGridMatrix(): void {
    this.gridMatrix = [];
    for (let y = 0; y < this.GRID_H; y++) {
      const row: (THREE.Mesh | null)[][] = [];
      for (let x = 0; x < this.GRID_W; x++) {
        row.push(new Array(this.GRID_D).fill(null));
      }
      this.gridMatrix.push(row);
    }
  }

  // --- CAGE / WELL VISUALS FOR 10x20 3D ARENA ---
  private buildCage(): void {
    this.cageGroup = new THREE.Group();

    const w = this.GRID_W * this.BLOCK_SIZE; // 10
    const h = this.GRID_H * this.BLOCK_SIZE; // 20

    // 1. Backing Plate for 3D Depth (Z = -0.06)
    const backGeo = new THREE.PlaneGeometry(w + 0.4, h + 0.4);
    const backMat = new THREE.MeshBasicMaterial({
      color: 0x0b1329,
    });
    const backPanel = new THREE.Mesh(backGeo, backMat);
    backPanel.position.set(w / 2, h / 2, -0.06);
    this.cageGroup.add(backPanel);

    // 2. Subtle 2D Grid Matrix Lines (10 columns, 20 rows)
    const gridLineMat = new THREE.LineBasicMaterial({
      color: 0x1e3a5f,
    });

    for (let x = 0; x <= this.GRID_W; x++) {
      const pts = [
        new THREE.Vector3(x * this.BLOCK_SIZE, 0, 0.01),
        new THREE.Vector3(x * this.BLOCK_SIZE, h, 0.01),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      this.cageGroup.add(new THREE.Line(lineGeo, gridLineMat));
    }

    for (let y = 0; y <= this.GRID_H; y++) {
      const pts = [
        new THREE.Vector3(0, y * this.BLOCK_SIZE, 0.01),
        new THREE.Vector3(w, y * this.BLOCK_SIZE, 0.01),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      this.cageGroup.add(new THREE.Line(lineGeo, gridLineMat));
    }

    // 3. Glowing 3D Neon Border Frame (Left, Right, Bottom)
    const neonMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
    });

    // Left neon pillar
    const leftPillarGeo = new THREE.BoxGeometry(0.24, h + 0.4, 1.2);
    const leftPillar = new THREE.Mesh(leftPillarGeo, neonMat);
    leftPillar.position.set(-0.12, h / 2, 0.5);
    this.cageGroup.add(leftPillar);

    // Right neon pillar
    const rightPillarGeo = new THREE.BoxGeometry(0.24, h + 0.4, 1.2);
    const rightPillar = new THREE.Mesh(rightPillarGeo, neonMat);
    rightPillar.position.set(w + 0.12, h / 2, 0.5);
    this.cageGroup.add(rightPillar);

    // Bottom base pedestal
    const bottomBaseGeo = new THREE.BoxGeometry(w + 1.2, 0.5, 2.2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
    });
    const bottomBase = new THREE.Mesh(bottomBaseGeo, baseMat);
    bottomBase.position.set(w / 2, -0.25, 0.5);
    this.cageGroup.add(bottomBase);

    // Neon trim along bottom rail
    const bottomTrimGeo = new THREE.BoxGeometry(w + 0.48, 0.08, 1.2);
    const bottomTrim = new THREE.Mesh(bottomTrimGeo, neonMat);
    bottomTrim.position.set(w / 2, 0, 0.5);
    this.cageGroup.add(bottomTrim);

    this.scene.add(this.cageGroup);
  }

  private buildHologramPedestals(): void {
    // Next Piece Pedestal (Right side)
    this.nextPreviewGroup = new THREE.Group();
    this.nextPreviewGroup.position.set(
      this.GRID_W * this.BLOCK_SIZE + 3.2,
      (this.GRID_H * this.BLOCK_SIZE) * 0.72,
      0.5
    );
    this.buildPedestalBase(this.nextPreviewGroup, 0x00f2fe);
    this.scene.add(this.nextPreviewGroup);

    // Hold Piece Pedestal (Left side)
    this.holdPreviewGroup = new THREE.Group();
    this.holdPreviewGroup.position.set(
      -3.2,
      (this.GRID_H * this.BLOCK_SIZE) * 0.72,
      0.5
    );
    this.buildPedestalBase(this.holdPreviewGroup, 0xf59e0b);
    this.scene.add(this.holdPreviewGroup);
  }

  private buildPedestalBase(group: THREE.Group, ringColor: number): void {
    const ringGeo = new THREE.RingGeometry(0.8, 1.05, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.2;
    group.add(ring);

    // Glowing column
    const cylGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.12, 32);
    const cylMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.y = -1.25;
    group.add(cyl);
  }

  // --- GAME FLOW ---
  public startNewGame(): void {
    this.clearGrid();
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.canHold = true;
    this.holdPieceDef = null;
    this.lastComboText = null;
    this.updateDropInterval();
    this.updateLayerFillIndicators();

    this.nextPieceDef = this.getRandomPieceDef();
    this.spawnPiece();
    this.renderPreviews();
    this.cdr.detectChanges();
  }

  private clearGrid(): void {
    for (let y = 0; y < this.GRID_H; y++) {
      for (let x = 0; x < this.GRID_W; x++) {
        for (let z = 0; z < this.GRID_D; z++) {
          const mesh = this.gridMatrix[y][x][z];
          if (mesh) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
          }
          this.gridMatrix[y][x][z] = null;
        }
      }
    }

    if (this.activePieceGroup) {
      this.scene.remove(this.activePieceGroup);
      this.activePieceGroup = null;
    }

    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }
  }

  private getRandomPieceDef(): TetrisPieceDef {
    const idx = Math.floor(Math.random() * PIECE_DEFS.length);
    return PIECE_DEFS[idx];
  }

  private spawnPiece(): void {
    this.currentPieceDef = this.nextPieceDef || this.getRandomPieceDef();
    this.nextPieceDef = this.getRandomPieceDef();
    this.canHold = true;

    this.activePieceDefInternal = this.currentPieceDef;
    this.activePieceCoords = this.currentPieceDef.blocks.map(([x, y, z]) => ({
      x,
      y,
      z,
    }));

    // Center piece at top of grid
    const minX = Math.min(...this.activePieceCoords.map((c) => c.x));
    const maxX = Math.max(...this.activePieceCoords.map((c) => c.x));
    const minZ = Math.min(...this.activePieceCoords.map((c) => c.z));
    const maxZ = Math.max(...this.activePieceCoords.map((c) => c.z));
    const pieceW = maxX - minX + 1;
    const pieceD = maxZ - minZ + 1;

    const startX = Math.floor((this.GRID_W - pieceW) / 2) - minX;
    const startZ = Math.floor((this.GRID_D - pieceD) / 2) - minZ;
    const startY = this.GRID_H - 1 - Math.max(...this.activePieceCoords.map((c) => c.y));

    this.activePiecePosition = { x: startX, y: startY, z: startZ };

    // Check if spawn position collides (Game Over!)
    if (this.checkCollision(this.activePieceCoords, this.activePiecePosition)) {
      this.triggerGameOver();
      return;
    }

    this.buildActivePieceMesh();
    this.updateGhostPiece();
    this.renderPreviews();
    this.dropTimer = 0;
  }

  // --- MESH BUILDERS ---
  private getOrCreateMaterial(color: number): THREE.Material {
    if (!this.materialCache.has(color)) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.4,
        emissive: color,
        emissiveIntensity: 0.25,
      });
      this.materialCache.set(color, mat);
    }
    return this.materialCache.get(color)!;
  }

  private createBlockMesh(color: number): THREE.Mesh {
    const mat = this.getOrCreateMaterial(color);
    const mesh = new THREE.Mesh(this.sharedBoxGeo, mat);

    // Neon edges
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });
    const edge = new THREE.LineSegments(this.sharedEdgesGeo, edgeMat);
    mesh.add(edge);

    return mesh;
  }

  private buildActivePieceMesh(): void {
    if (this.activePieceGroup) {
      this.scene.remove(this.activePieceGroup);
    }

    this.activePieceGroup = new THREE.Group();
    const color = this.activePieceDefInternal?.color || 0x00f2fe;

    for (const b of this.activePieceCoords) {
      const cube = this.createBlockMesh(color);
      cube.position.set(
        b.x * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
        b.y * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
        b.z * this.BLOCK_SIZE + this.BLOCK_SIZE / 2
      );
      this.activePieceGroup.add(cube);
    }

    this.updateActivePieceMeshPosition();
    this.scene.add(this.activePieceGroup);
  }

  private updateActivePieceMeshPosition(): void {
    if (!this.activePieceGroup) return;
    this.activePieceGroup.position.set(
      this.activePiecePosition.x * this.BLOCK_SIZE,
      this.activePiecePosition.y * this.BLOCK_SIZE,
      this.activePiecePosition.z * this.BLOCK_SIZE
    );
  }

  // --- GHOST PIECE ---
  private updateGhostPiece(): void {
    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }

    if (!this.activePieceDefInternal || this.isGameOver) return;

    // Calculate drop distance
    let dropDist = 0;
    while (
      !this.checkCollision(this.activePieceCoords, {
        x: this.activePiecePosition.x,
        y: this.activePiecePosition.y - (dropDist + 1),
        z: this.activePiecePosition.z,
      })
    ) {
      dropDist++;
    }

    // Ghost position
    const ghostY = this.activePiecePosition.y - dropDist;

    this.ghostGroup = new THREE.Group();
    this.ghostGroup.position.set(
      this.activePiecePosition.x * this.BLOCK_SIZE,
      ghostY * this.BLOCK_SIZE,
      this.activePiecePosition.z * this.BLOCK_SIZE
    );

    const ghostMat = new THREE.MeshBasicMaterial({
      color: this.activePieceDefInternal.color,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    for (const b of this.activePieceCoords) {
      const ghostMesh = new THREE.Mesh(this.sharedBoxGeo, ghostMat);
      ghostMesh.position.set(
        b.x * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
        b.y * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
        b.z * this.BLOCK_SIZE + this.BLOCK_SIZE / 2
      );
      this.ghostGroup.add(ghostMesh);
    }

    this.scene.add(this.ghostGroup);
  }

  // --- PREVIEWS (NEXT & HOLD 3D HOLOGRAMS) ---
  private renderPreviews(): void {
    // Render Next
    if (this.nextPreviewGroup && this.nextPieceDef) {
      this.populatePreviewGroup(this.nextPreviewGroup, this.nextPieceDef);
    }

    // Render Hold
    if (this.holdPreviewGroup) {
      this.populatePreviewGroup(this.holdPreviewGroup, this.holdPieceDef);
    }
  }

  private populatePreviewGroup(group: THREE.Group, def: TetrisPieceDef | null): void {
    // Keep the pedestal (first 2 children), remove previous preview blocks
    while (group.children.length > 2) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
    }

    if (!def) return;

    const previewContainer = new THREE.Group();
    previewContainer.name = 'previewBlocks';

    const minX = Math.min(...def.blocks.map((b) => b[0]));
    const maxX = Math.max(...def.blocks.map((b) => b[0]));
    const minY = Math.min(...def.blocks.map((b) => b[1]));
    const maxY = Math.max(...def.blocks.map((b) => b[1]));
    const minZ = Math.min(...def.blocks.map((b) => b[2]));
    const maxZ = Math.max(...def.blocks.map((b) => b[2]));

    const offsetX = (maxX - minX) / 2 + minX;
    const offsetY = (maxY - minY) / 2 + minY;
    const offsetZ = (maxZ - minZ) / 2 + minZ;

    for (const b of def.blocks) {
      const cube = this.createBlockMesh(def.color);
      cube.scale.set(0.65, 0.65, 0.65);
      cube.position.set(
        (b[0] - offsetX) * 0.7,
        (b[1] - offsetY) * 0.7,
        (b[2] - offsetZ) * 0.7
      );
      previewContainer.add(cube);
    }

    group.add(previewContainer);
  }

  // --- COLLISION DETECTION ---
  private checkCollision(coords: BlockCoord[], offset: BlockCoord): boolean {
    for (const b of coords) {
      const gx = b.x + offset.x;
      const gy = b.y + offset.y;
      const gz = b.z + offset.z;

      // Bound checks
      if (gx < 0 || gx >= this.GRID_W) return true;
      if (gz < 0 || gz >= this.GRID_D) return true;
      if (gy < 0) return true; // hit floor
      if (gy >= this.GRID_H) continue; // above ceiling is okay while falling

      // Matrix check
      if (this.gridMatrix[gy][gx][gz] !== null) {
        return true;
      }
    }
    return false;
  }

  // --- ACTIONS & MOVEMENT ---
  // --- ACTIONS & MOVEMENT (CLASSIC 2D GAMEPLAY) ---
  public move(dx: number, dz: number = 0): boolean {
    if (this.isGameOver || this.isPaused) return false;

    const newPos = {
      x: this.activePiecePosition.x + dx,
      y: this.activePiecePosition.y,
      z: 0,
    };

    if (!this.checkCollision(this.activePieceCoords, newPos)) {
      this.activePiecePosition = newPos;
      this.updateActivePieceMeshPosition();
      this.updateGhostPiece();
      this.playSynthSound(440, 'triangle', 0.05);
      return true;
    }
    return false;
  }

  public softDrop(): boolean {
    if (this.isGameOver || this.isPaused) return false;

    const newPos = {
      x: this.activePiecePosition.x,
      y: this.activePiecePosition.y - 1,
      z: 0,
    };

    if (!this.checkCollision(this.activePieceCoords, newPos)) {
      this.activePiecePosition = newPos;
      this.updateActivePieceMeshPosition();
      this.score += 1;
      this.dropTimer = 0;
      return true;
    } else {
      this.lockPiece();
      return false;
    }
  }

  public hardDrop(): void {
    if (this.isGameOver || this.isPaused) return;

    let dropDist = 0;
    while (
      !this.checkCollision(this.activePieceCoords, {
        x: this.activePiecePosition.x,
        y: this.activePiecePosition.y - (dropDist + 1),
        z: 0,
      })
    ) {
      dropDist++;
    }

    this.activePiecePosition.y -= dropDist;
    this.score += dropDist * 2;
    this.updateActivePieceMeshPosition();
    this.spawnDropSparkles();
    this.playHardDropSound();
    this.lockPiece();
  }

  public hold(): void {
    if (this.isGameOver || this.isPaused || !this.canHold || !this.currentPieceDef) return;

    this.playHoldSound();

    const temp = this.currentPieceDef;
    if (this.holdPieceDef === null) {
      this.holdPieceDef = temp;
      this.spawnPiece();
    } else {
      this.currentPieceDef = this.holdPieceDef;
      this.holdPieceDef = temp;
      this.activePieceDefInternal = this.currentPieceDef;
      this.activePieceCoords = this.currentPieceDef.blocks.map(([x, y, z]) => ({
        x,
        y,
        z: 0,
      }));

      const minX = Math.min(...this.activePieceCoords.map((c) => c.x));
      const maxX = Math.max(...this.activePieceCoords.map((c) => c.x));
      const pieceW = maxX - minX + 1;

      this.activePiecePosition = {
        x: Math.floor((this.GRID_W - pieceW) / 2) - minX,
        y: this.GRID_H - 1 - Math.max(...this.activePieceCoords.map((c) => c.y)),
        z: 0,
      };

      this.buildActivePieceMesh();
      this.updateGhostPiece();
      this.renderPreviews();
    }

    this.canHold = false;
    this.cdr.detectChanges();
  }

  // --- 2D ROTATION WITH WALL KICKS ---
  public rotate(clockwise: boolean = true): boolean {
    if (this.isGameOver || this.isPaused) return false;

    // O-Piece needs no rotation
    if (this.currentPieceDef?.type === 'O') {
      this.playRotateSound();
      return true;
    }

    // Centroid in 2D
    let sumX = 0, sumY = 0;
    const n = this.activePieceCoords.length;
    for (const b of this.activePieceCoords) {
      sumX += b.x;
      sumY += b.y;
    }
    const cx = Math.round(sumX / n);
    const cy = Math.round(sumY / n);

    const rotatedCoords: BlockCoord[] = this.activePieceCoords.map((b) => {
      const dx = b.x - cx;
      const dy = b.y - cy;
      const rx = clockwise ? dy : -dy;
      const ry = clockwise ? -dx : dx;
      return { x: cx + rx, y: cy + ry, z: 0 };
    });

    // Wall Kicks offsets to test
    const kickOffsets: { x: number; y: number }[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 2, y: 0 },
      { x: -2, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (const kick of kickOffsets) {
      const testPos = {
        x: this.activePiecePosition.x + kick.x,
        y: this.activePiecePosition.y + kick.y,
        z: 0,
      };

      if (!this.checkCollision(rotatedCoords, testPos)) {
        this.activePieceCoords = rotatedCoords;
        this.activePiecePosition = testPos;
        this.buildActivePieceMesh();
        this.updateGhostPiece();
        this.playRotateSound();
        return true;
      }
    }

    // Buzz sound if rotation is blocked
    this.playSynthSound(150, 'sawtooth', 0.08);
    return false;
  }

  // --- LOCKING & ROW CLEARING ---
  private lockPiece(): void {
    if (!this.activePieceDefInternal) return;

    const color = this.activePieceDefInternal.color;

    for (const b of this.activePieceCoords) {
      const gx = b.x + this.activePiecePosition.x;
      const gy = b.y + this.activePiecePosition.y;

      if (gy >= this.GRID_H) {
        // Exceeded top!
        this.triggerGameOver();
        return;
      }

      const blockMesh = this.createBlockMesh(color);
      blockMesh.position.set(
        gx * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
        gy * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
        0.5
      );
      this.scene.add(blockMesh);
      this.gridMatrix[gy][gx][0] = blockMesh;
    }

    if (this.activePieceGroup) {
      this.scene.remove(this.activePieceGroup);
      this.activePieceGroup = null;
    }

    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }

    this.checkClearedLayers();
  }

  private checkClearedLayers(): void {
    const fullRows: number[] = [];

    for (let y = 0; y < this.GRID_H; y++) {
      let isFull = true;
      for (let x = 0; x < this.GRID_W; x++) {
        if (this.gridMatrix[y][x][0] === null) {
          isFull = false;
          break;
        }
      }

      if (isFull) {
        fullRows.push(y);
      }
    }

    if (fullRows.length > 0) {
      this.clearLayers(fullRows);
    } else {
      this.updateLayerFillIndicators();
      this.spawnPiece();
    }
  }

  private clearLayers(rowsToClear: number[]): void {
    const rowCount = rowsToClear.length;

    // Classic 2D Tetris scoring
    let points = 100 * this.level;
    if (rowCount === 2) points = 300 * this.level;
    if (rowCount === 3) points = 500 * this.level;
    if (rowCount >= 4) {
      points = 800 * this.level;
      this.lastComboText = '🔥 TETRIS! (4 LINES) 🔥';
    } else if (rowCount > 1) {
      this.lastComboText = `✨ ${rowCount} LINES CLEARED! ✨`;
    } else {
      this.lastComboText = null;
    }

    this.score += points;
    this.linesCleared += rowCount;
    this.updateHighScore();

    // Level up every 10 cleared lines
    const newLevel = Math.floor(this.linesCleared / 10) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      this.updateDropInterval();
      this.playLevelUpSound();
    }

    this.playClearSound(rowCount);

    // Remove meshes & trigger explosion particles
    for (const y of rowsToClear) {
      for (let x = 0; x < this.GRID_W; x++) {
        const mesh = this.gridMatrix[y][x][0];
        if (mesh) {
          this.spawnExplosionParticles(mesh.position);
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.gridMatrix[y][x][0] = null;
        }
      }
    }

    // Collapse upper rows down
    rowsToClear.sort((a, b) => b - a); // highest to lowest
    for (const clearedY of rowsToClear) {
      for (let y = clearedY; y < this.GRID_H - 1; y++) {
        for (let x = 0; x < this.GRID_W; x++) {
          const blockAbove = this.gridMatrix[y + 1][x][0];
          this.gridMatrix[y][x][0] = blockAbove;
          if (blockAbove) {
            blockAbove.position.y -= this.BLOCK_SIZE;
          }
          this.gridMatrix[y + 1][x][0] = null;
        }
      }
    }

    this.updateLayerFillIndicators();
    this.cdr.detectChanges();

    // Brief pause after clear before next spawn
    setTimeout(() => {
      this.lastComboText = null;
      this.spawnPiece();
      this.cdr.detectChanges();
    }, 200);
  }

  private updateLayerFillIndicators(): void {
    const totalPerRow = this.GRID_W;
    const percentages: number[] = [];

    for (let y = 0; y < this.GRID_H; y++) {
      let count = 0;
      for (let x = 0; x < this.GRID_W; x++) {
        if (this.gridMatrix[y][x][0] !== null) count++;
      }
      percentages.push(Math.round((count / totalPerRow) * 100));
    }

    this.rowFillPercentages = percentages;
  }

  private updateDropInterval(): void {
    // Starts at 1.0s, speeds up with level (min 0.15s)
    this.dropInterval = Math.max(0.15, 1.0 - (this.level - 1) * 0.08);
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.playGameOverSound();
    this.updateHighScore();
    this.cdr.detectChanges();
  }

  public togglePause(): void {
    this.isPaused = !this.isPaused;
    this.cdr.detectChanges();
  }

  // --- PARTICLE SYSTEMS ---
  private spawnDropSparkles(): void {
    if (!this.activePieceGroup) return;
    const pos = this.activePieceGroup.position;
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.SphereGeometry(0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(
        pos.x + (Math.random() - 0.5) * 2,
        pos.y + 0.1,
        pos.z + (Math.random() - 0.5) * 2
      );
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        ),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  private spawnExplosionParticles(centerPos: THREE.Vector3): void {
    const colors = [0x00f2fe, 0xff007f, 0xffd200, 0x10b981];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(centerPos);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.2) * 6,
          (Math.random() - 0.5) * 6
        ),
        rotVel: new THREE.Vector3(
          Math.random() * 10,
          Math.random() * 10,
          Math.random() * 10
        ),
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.vel, delta);
        p.vel.y -= 9.8 * delta; // gravity
        p.mesh.rotation.x += p.rotVel.x * delta;
        p.mesh.rotation.y += p.rotVel.y * delta;
        const scale = 1 - p.life / p.maxLife;
        p.mesh.scale.set(scale, scale, scale);
      }
    }
  }

  // --- CAMERA PRESETS ---
  public setCameraPreset(preset: 'iso' | 'top' | 'front' | 'free'): void {
    this.activeCamPreset = preset;
    const cx = (this.GRID_W * this.BLOCK_SIZE) / 2; // 5
    const cy = (this.GRID_H * this.BLOCK_SIZE) / 2; // 10
    const cz = 0.5;

    if (preset === 'iso') {
      // 3D Angled view: reveals depth, beveled blocks, and glowing edges
      this.camera.position.set(cx + 6.5, cy + 2.5, 23);
    } else if (preset === 'top') {
      // Opposite angle
      this.camera.position.set(cx - 5.5, cy + 3.0, 22);
    } else if (preset === 'front') {
      // Direct front 3D perspective
      this.camera.position.set(cx, cy, 25);
    }

    if (this.controls) {
      this.controls.target.set(cx, cy, cz);
      this.controls.update();
    }
  }

  // --- RENDER & GAME LOOP ---
  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    // Game drop tick
    if (!this.isPaused && !this.isGameOver) {
      this.dropTimer += delta;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer = 0;
        this.softDrop();
      }
    }

    // Rotate hologram previews gently
    if (this.nextPreviewGroup) {
      const b = this.nextPreviewGroup.getObjectByName('previewBlocks');
      if (b) b.rotation.y += delta * 1.2;
    }
    if (this.holdPreviewGroup) {
      const b = this.holdPreviewGroup.getObjectByName('previewBlocks');
      if (b) b.rotation.y += delta * 1.2;
    }

    // Update particles
    this.updateParticles(delta);

    // OrbitControls & Render
    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  // --- AUDIO SYNTHESIZER ---
  private getAudioContext(): AudioContext | null {
    if (this.isSoundMuted || typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public toggleMute(): void {
    this.isSoundMuted = !this.isSoundMuted;
  }

  private playSynthSound(freq: number, type: OscillatorType, duration: number): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  private playRotateSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  private playHardDropSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  private playHoldSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  private playClearSound(combos: number): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const baseFreqs = combos >= 4 ? [440, 554, 659, 880] : [523, 659, 784];
    baseFreqs.forEach((f, idx) => {
      setTimeout(() => {
        this.playSynthSound(f, 'square', 0.15);
      }, idx * 60);
    });
  }

  private playLevelUpSound(): void {
    const notes = [440, 554, 659, 880, 1108];
    notes.forEach((f, idx) => {
      setTimeout(() => {
        this.playSynthSound(f, 'sine', 0.14);
      }, idx * 50);
    });
  }

  private playGameOverSound(): void {
    const freqs = [350, 300, 250, 180, 120];
    freqs.forEach((f, idx) => {
      setTimeout(() => {
        this.playSynthSound(f, 'sawtooth', 0.18);
      }, idx * 100);
    });
  }

  // --- LOCAL STORAGE HIGH SCORE ---
  private loadHighScore(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('mayur_3d_tetris_highscore');
      if (saved) {
        this.highScore = parseInt(saved, 10) || 0;
      }
    }
  }

  private updateHighScore(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mayur_3d_tetris_highscore', this.highScore.toString());
      }
    }
  }

  // --- KEYBOARD CONTROLS ---
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Avoid interfering if typing in an input
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    switch (event.code) {
      // Classic 2D Movement
      case 'ArrowLeft':
      case 'KeyA':
        event.preventDefault();
        this.move(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
        event.preventDefault();
        this.rotate(true);
        break;
      case 'KeyZ':
        event.preventDefault();
        this.rotate(false);
        break;
      case 'ArrowDown':
      case 'KeyS':
        event.preventDefault();
        this.softDrop();
        break;

      // Soft & Hard Drop
      case 'Space':
        event.preventDefault();
        this.hardDrop();
        break;

      // Hold & Pause
      case 'KeyC':
      case 'KeyH':
      case 'ShiftLeft':
      case 'ShiftRight':
        event.preventDefault();
        this.hold();
        break;
      case 'KeyP':
      case 'Escape':
        event.preventDefault();
        this.togglePause();
        break;
    }
  }

  // --- WINDOW RESIZE ---
  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.viewportContainer || !this.renderer || !this.camera) return;
    const container = this.viewportContainer.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
