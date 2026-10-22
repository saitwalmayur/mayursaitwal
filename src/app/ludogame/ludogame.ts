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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
  PlayerColor,
  PlayerType,
  BotDifficulty,
  LudoPlayer,
  LudoPawn,
  LudoPlayerConfig,
  LogEntry,
  MoveAction,
} from './ludo.models';
import {
  TILE_SIZE,
  TRACK_STEPS,
  SAFE_TRACK_INDEXES,
  PLAYER_START_INDEX,
  HOME_PATHS,
  GOAL_COORDS,
  YARD_COORDS,
  gridToWorld,
  getPawnWorldPosition,
  getTrackIndex,
} from './ludo-board.data';
import { LudoAudioService } from './ludo-audio.service';

interface PipDef {
  pos: [number, number, number];
}

const PLAYER_METAS: Record<
  PlayerColor,
  { name: string; hex: number; css: string; darkHex: number; avatar: string }
> = {
  red: {
    name: 'Red Champion',
    hex: 0xef4444,
    css: '#ef4444',
    darkHex: 0x991b1b,
    avatar: '🔴',
  },
  green: {
    name: 'Emerald Fox',
    hex: 0x10b981,
    css: '#10b981',
    darkHex: 0x065f46,
    avatar: '🟢',
  },
  yellow: {
    name: 'Solar King',
    hex: 0xf59e0b,
    css: '#f59e0b',
    darkHex: 0x92400e,
    avatar: '🟡',
  },
  blue: {
    name: 'Azure Titan',
    hex: 0x3b82f6,
    css: '#3b82f6',
    darkHex: 0x1e40af,
    avatar: '🔵',
  },
};

const DICE_RESTING_Y = 1.69;

@Component({
  selector: 'app-ludogame',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ludogame.html',
  styleUrl: './ludogame.scss',
})
export class Ludogame implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer', { static: false })
  viewportContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rendererCanvas', { static: false })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;

  // Game Configuration State
  public playerCount: 2 | 3 | 4 = 4;
  public showSetupModal: boolean = false;
  public showRulesModal: boolean = false;
  public isHistoryOpen: boolean = false;
  public isSoundMuted: boolean = false;
  public gameSpeed: 'normal' | 'fast' = 'normal';
  public cameraView: 'orbit' | 'top' | 'player' = 'orbit';

  public playerConfigs: LudoPlayerConfig[] = [
    { color: 'red', name: 'Player 1', type: 'human', difficulty: 'medium', active: true },
    { color: 'green', name: 'AlphaBot', type: 'bot', difficulty: 'medium', active: true },
    { color: 'yellow', name: 'NovaBot', type: 'bot', difficulty: 'medium', active: true },
    { color: 'blue', name: 'CyberBot', type: 'bot', difficulty: 'medium', active: true },
  ];

  // In-Game State
  public players: LudoPlayer[] = [];
  public currentTurnIndex: number = 0;
  public diceValue: number = 6;
  public isDiceRolling: boolean = false;
  public canRoll: boolean = true;
  public waitingForPawnSelect: boolean = false;
  public selectablePawnIndices: number[] = [];
  public consecutiveSixes: number = 0;
  public isAnimatingMove: boolean = false;
  public isGameOver: boolean = false;
  public winners: LudoPlayer[] = [];
  public statusMessage: string = 'Roll the dice to start!';
  public statusBadge: string = 'Waiting';
  public gameLogs: LogEntry[] = [];

  // Three.js Scene Members
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationFrameId: number | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // 3D Meshes
  private boardGroup = new THREE.Group();
  private diceMesh!: THREE.Group;
  private diceTargetRotation = new THREE.Euler(0, 0, 0);
  private diceRollingAnim: {
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    peakY: number;
    endPos: THREE.Vector3;
    startRot: THREE.Euler;
    rotSpins: THREE.Vector3;
  } | null = null;

  // Particle systems
  private confettiParticles: THREE.Points | null = null;
  private pulseIndicators: THREE.Mesh[] = [];

  // Active pawn hopping animation
  private activeHopAnimation: {
    pawn: LudoPawn;
    steps: { x: number; y: number; z: number }[];
    currentStepIdx: number;
    startTime: number;
    durationPerStep: number;
    isCapture: boolean;
    capturedPawn?: LudoPawn;
    reachesGoal: boolean;
    onComplete: () => void;
  } | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    public audio: LudoAudioService,
    private cdr: ChangeDetectorRef
  ) {}

  public get currentPlayer(): LudoPlayer | null {
    if (!this.players.length || this.currentTurnIndex >= this.players.length) return null;
    return this.players[this.currentTurnIndex];
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.initGameData();
    this.initThreeScene();
    this.buildLudoBoard();
    this.createDice();
    this.createPawns();
    this.animate();

    // Start with Red turn
    this.statusMessage = `${this.currentPlayer?.name}'s turn. Roll the dice!`;
    this.statusBadge = 'Ready to Roll';
    this.logAction(
      this.currentPlayer!.color,
      this.currentPlayer!.name,
      'Game started! Best of luck!',
      'start',
      '🎲'
    );

    // If starting player is a bot, trigger auto roll
    this.checkBotTurn();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.viewportContainer || !this.camera || !this.renderer) return;
    const width = this.viewportContainer.nativeElement.clientWidth;
    const height = this.viewportContainer.nativeElement.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ==========================================
  // GAME INITIALIZATION & PLAYER SETUP
  // ==========================================

  public setPlayerCount(count: 2 | 3 | 4): void {
    this.playerCount = count;
    if (count === 2) {
      // 2 Players: Red & Yellow (classic opposing corners)
      this.playerConfigs[0].active = true;
      this.playerConfigs[1].active = false;
      this.playerConfigs[2].active = true;
      this.playerConfigs[3].active = false;
    } else if (count === 3) {
      this.playerConfigs[0].active = true;
      this.playerConfigs[1].active = true;
      this.playerConfigs[2].active = true;
      this.playerConfigs[3].active = false;
    } else {
      this.playerConfigs.forEach((c) => (c.active = true));
    }
  }

  public openSetupModal(): void {
    this.showSetupModal = true;
  }

  public applySetupAndRestart(): void {
    this.showSetupModal = false;
    this.startNewMatch();
  }

  public startNewMatch(): void {
    this.isGameOver = false;
    this.winners = [];
    this.consecutiveSixes = 0;
    this.canRoll = true;
    this.waitingForPawnSelect = false;
    this.selectablePawnIndices = [];
    this.gameLogs = [];

    // Clear pawns from scene
    this.players.forEach((p) => {
      p.pawns.forEach((pawn) => {
        if (pawn.mesh) this.scene.remove(pawn.mesh);
      });
    });

    this.initGameData();
    this.createPawns();

    this.currentTurnIndex = 0;
    this.diceValue = 6;
    this.positionDiceForPlayer(this.currentPlayer?.color || 'red');

    this.statusMessage = `${this.currentPlayer?.name}'s turn. Roll the dice!`;
    this.statusBadge = 'Ready to Roll';
    this.logAction(
      this.currentPlayer!.color,
      this.currentPlayer!.name,
      'New match initiated!',
      'start',
      '🎲'
    );

    this.updateCameraForPlayer();
    this.cdr.detectChanges();
    this.checkBotTurn();
  }

  private initGameData(): void {
    this.players = [];
    const activeConfigs = this.playerConfigs.filter((c) => c.active);

    activeConfigs.forEach((cfg) => {
      const meta = PLAYER_METAS[cfg.color];
      const pawns: LudoPawn[] = [];

      for (let i = 0; i < 4; i++) {
        pawns.push({
          id: i,
          color: cfg.color,
          state: 'yard',
          stepCount: -1,
        });
      }

      this.players.push({
        color: cfg.color,
        name: cfg.name.trim() || meta.name,
        type: cfg.type,
        difficulty: cfg.difficulty,
        active: true,
        pawns: pawns,
        rank: 0,
        homeColorHex: meta.hex,
        homeColorCss: meta.css,
        avatar: cfg.type === 'bot' ? '🤖' : meta.avatar,
      });
    });

    this.currentTurnIndex = 0;
  }

  // ==========================================
  // THREE.JS SCENE CREATION
  // ==========================================

  private initThreeScene(): void {
    const container = this.viewportContainer.nativeElement;
    const canvas = this.rendererCanvas.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f1d);
    this.scene.fog = new THREE.FogExp2(0x0c0f1d, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 26, 25);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera under floor
    this.controls.minDistance = 12;
    this.controls.maxDistance = 55;
    this.controls.target.set(0, 0, 0);

    // Lighting
    this.setupLighting();

    // Table pedestal and ambient ground grid
    this.setupEnvironment();
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Main directional sun shadow light
    const dirLight = new THREE.DirectionalLight(0xfff6e8, 1.6);
    dirLight.position.set(16, 32, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 70;
    const d = 16;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Soft colored fill light from opposite angle
    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.55);
    fillLight.position.set(-18, 15, -18);
    this.scene.add(fillLight);

    // Warm center accent point light
    const centerGlow = new THREE.PointLight(0xffedd5, 0.9, 30);
    centerGlow.position.set(0, 4.5, 0);
    this.scene.add(centerGlow);
  }

  private setupEnvironment(): void {
    // Ground floor shadow receiver
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x070913,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Aesthetic concentric glow rings on floor
    const ringGeo = new THREE.RingGeometry(16, 16.3, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.01;
    this.scene.add(ringMesh);
  }

  // ==========================================
  // 3D LUDO BOARD CONSTRUCTION
  // ==========================================

  private buildLudoBoard(): void {
    this.scene.add(this.boardGroup);

    const boardWidth = 15 * TILE_SIZE + 1.2;
    const boardHeight = 0.8;

    // 1. Heavy Wooden Luxury Table Slab
    const slabGeo = new THREE.BoxGeometry(boardWidth, boardHeight, boardWidth);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x181e2e,
      roughness: 0.35,
      metalness: 0.25,
    });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.position.y = boardHeight / 2;
    slabMesh.receiveShadow = true;
    slabMesh.castShadow = true;
    this.boardGroup.add(slabMesh);

    // 2. Beveled Golden Brass Border Trim
    const trimThick = 0.4;
    const trimHeight = 0.9;
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.2,
      metalness: 0.85,
    });

    const createBorderBar = (w: number, d: number, px: number, pz: number) => {
      const g = new THREE.BoxGeometry(w, trimHeight, d);
      const m = new THREE.Mesh(g, borderMat);
      m.position.set(px, trimHeight / 2, pz);
      m.castShadow = true;
      this.boardGroup.add(m);
    };

    createBorderBar(boardWidth + 0.4, trimThick, 0, (boardWidth + trimThick) / 2);
    createBorderBar(boardWidth + 0.4, trimThick, 0, -(boardWidth + trimThick) / 2);
    createBorderBar(trimThick, boardWidth, (boardWidth + trimThick) / 2, 0);
    createBorderBar(trimThick, boardWidth, -(boardWidth + trimThick) / 2, 0);

    // 3. 4 Corner Home Bases (Quadrants)
    this.buildHomeBases();

    // 4. Perimeter Track Tiles (52 cells)
    this.buildTrackTiles();

    // 5. 4 Home Lanes & Center Triangle Finish
    this.buildHomeLanes();
    this.buildCenterFinish();

    // 6. 4 Dedicated Player Corner Dice Trays / Coasters
    this.buildDiceCoasters();
  }

  private buildDiceCoasters(): void {
    const diceLocations = [
      { x: -8.8, z: -8.8, color: 0xef4444 },
      { x: 8.8, z: -8.8, color: 0x10b981 },
      { x: 8.8, z: 8.8, color: 0xf59e0b },
      { x: -8.8, z: 8.8, color: 0x3b82f6 },
    ];

    diceLocations.forEach((loc) => {
      // Golden outer coaster rim
      const rimGeo = new THREE.CylinderGeometry(1.22, 1.28, 0.08, 32);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.2,
        metalness: 0.85,
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(loc.x, 0.99, loc.z);
      rim.receiveShadow = true;
      this.boardGroup.add(rim);

      // Velvet felt coaster pad
      const feltGeo = new THREE.CylinderGeometry(1.12, 1.12, 0.09, 32);
      const feltMat = new THREE.MeshStandardMaterial({
        color: loc.color,
        roughness: 0.8,
        metalness: 0.1,
      });
      const felt = new THREE.Mesh(feltGeo, feltMat);
      felt.position.set(loc.x, 0.995, loc.z);
      felt.receiveShadow = true;
      this.boardGroup.add(felt);
    });
  }

  private buildHomeBases(): void {
    const quadSize = 6 * TILE_SIZE;
    const quadHeight = 0.15;
    const baseY = 0.8 + quadHeight / 2;

    const basePositions: { color: PlayerColor; col: number; row: number }[] = [
      { color: 'red', col: 2.5, row: 2.5 },
      { color: 'green', col: 11.5, row: 2.5 },
      { color: 'yellow', col: 11.5, row: 11.5 },
      { color: 'blue', col: 2.5, row: 11.5 },
    ];

    basePositions.forEach(({ color, col, row }) => {
      const meta = PLAYER_METAS[color];
      const pos = gridToWorld(col, row, baseY);

      // Base quadrant platform
      const quadGeo = new THREE.BoxGeometry(quadSize - 0.1, quadHeight, quadSize - 0.1);
      const quadMat = new THREE.MeshStandardMaterial({
        color: meta.hex,
        roughness: 0.25,
        metalness: 0.15,
      });
      const quadMesh = new THREE.Mesh(quadGeo, quadMat);
      quadMesh.position.set(pos.x, baseY, pos.z);
      quadMesh.receiveShadow = true;
      this.boardGroup.add(quadMesh);

      // Inner white decorative card
      const innerSize = quadSize * 0.72;
      const innerGeo = new THREE.BoxGeometry(innerSize, 0.04, innerSize);
      const innerMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.4,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.position.set(pos.x, baseY + 0.08, pos.z);
      innerMesh.receiveShadow = true;
      this.boardGroup.add(innerMesh);

      // 4 Circular Token Nests inside each yard
      const yardPots = YARD_COORDS[color];
      yardPots.forEach((potCoord) => {
        const potPos = gridToWorld(potCoord.col, potCoord.row, baseY + 0.1);

        // Circular socket rim
        const socketGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.06, 24);
        const socketMat = new THREE.MeshStandardMaterial({
          color: meta.hex,
          roughness: 0.3,
          metalness: 0.3,
        });
        const socket = new THREE.Mesh(socketGeo, socketMat);
        socket.position.set(potPos.x, baseY + 0.1, potPos.z);
        socket.receiveShadow = true;
        this.boardGroup.add(socket);

        // Inner golden socket pad
        const padGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.07, 24);
        const padMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.6,
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(potPos.x, baseY + 0.11, potPos.z);
        pad.receiveShadow = true;
        this.boardGroup.add(pad);
      });
    });
  }

  private buildTrackTiles(): void {
    const tileH = 0.08;
    const tileY = 0.8 + tileH / 2;

    const normalTileMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.1,
    });

    const starTileMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.2,
      metalness: 0.35,
    });

    TRACK_STEPS.forEach((step, idx) => {
      const pos = gridToWorld(step.col, step.row, tileY);
      const isSafe = SAFE_TRACK_INDEXES.has(idx);

      // Check if this step is a player's entry tile
      let tileColorHex: number | null = null;
      if (idx === PLAYER_START_INDEX.red) tileColorHex = PLAYER_METAS.red.hex;
      else if (idx === PLAYER_START_INDEX.green) tileColorHex = PLAYER_METAS.green.hex;
      else if (idx === PLAYER_START_INDEX.yellow) tileColorHex = PLAYER_METAS.yellow.hex;
      else if (idx === PLAYER_START_INDEX.blue) tileColorHex = PLAYER_METAS.blue.hex;

      const tileGeo = new THREE.BoxGeometry(TILE_SIZE - 0.08, tileH, TILE_SIZE - 0.08);
      const tileMesh = new THREE.Mesh(
        tileGeo,
        tileColorHex
          ? new THREE.MeshStandardMaterial({ color: tileColorHex, roughness: 0.25 })
          : isSafe
            ? starTileMat
            : normalTileMat
      );
      tileMesh.position.set(pos.x, tileY, pos.z);
      tileMesh.receiveShadow = true;
      this.boardGroup.add(tileMesh);

      // If safe star tile, add golden 3D star marker
      if (isSafe) {
        const starMesh = this.createStarMesh();
        starMesh.position.set(pos.x, tileY + 0.05, pos.z);
        this.boardGroup.add(starMesh);
      }
    });
  }

  private createStarMesh(): THREE.Group {
    const starGroup = new THREE.Group();
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.15,
      metalness: 0.9,
    });

    // 5-point star constructed using overlapping triangles/quads
    for (let i = 0; i < 5; i++) {
      const angle = (i * (Math.PI * 2)) / 5;
      const rayGeo = new THREE.ConeGeometry(0.12, 0.38, 4);
      const ray = new THREE.Mesh(rayGeo, starMat);
      ray.rotation.x = Math.PI / 2;
      ray.rotation.z = -angle;
      ray.position.set(Math.sin(angle) * 0.15, 0.02, Math.cos(angle) * 0.15);
      starGroup.add(ray);
    }

    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12), starMat);
    centerCap.position.y = 0.02;
    starGroup.add(centerCap);

    return starGroup;
  }

  private buildHomeLanes(): void {
    const tileH = 0.1;
    const tileY = 0.8 + tileH / 2;

    const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    colors.forEach((col) => {
      const meta = PLAYER_METAS[col];
      const laneCoords = HOME_PATHS[col];
      const laneMat = new THREE.MeshStandardMaterial({
        color: meta.hex,
        roughness: 0.25,
        metalness: 0.2,
      });

      laneCoords.forEach((coord, i) => {
        const pos = gridToWorld(coord.col, coord.row, tileY);
        const tileGeo = new THREE.BoxGeometry(TILE_SIZE - 0.08, tileH + i * 0.01, TILE_SIZE - 0.08);
        const tileMesh = new THREE.Mesh(tileGeo, laneMat);
        tileMesh.position.set(pos.x, tileY, pos.z);
        tileMesh.receiveShadow = true;
        this.boardGroup.add(tileMesh);
      });
    });
  }

  private buildCenterFinish(): void {
    const centerSize = 3 * TILE_SIZE;
    const centerY = 0.8 + 0.14;

    // Center base block
    const centerGeo = new THREE.BoxGeometry(centerSize - 0.08, 0.2, centerSize - 0.08);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.5,
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.position.set(0, centerY, 0);
    centerMesh.receiveShadow = true;
    this.boardGroup.add(centerMesh);

    // 4 Finished goal colored triangular zones
    const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    colors.forEach((col) => {
      const goalCoord = GOAL_COORDS[col];
      const meta = PLAYER_METAS[col];
      const pos = gridToWorld(goalCoord.col, goalCoord.row, centerY + 0.08);

      const markerGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16);
      const markerMat = new THREE.MeshStandardMaterial({
        color: meta.hex,
        roughness: 0.2,
        metalness: 0.4,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(pos.x, centerY + 0.08, pos.z);
      this.boardGroup.add(marker);
    });

    // Central victory trophy crystal obelisk in center!
    const crystalGeo = new THREE.OctahedronGeometry(0.85, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x78350f,
      emissiveIntensity: 0.4,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, centerY + 1.1, 0);
    crystal.castShadow = true;
    this.boardGroup.add(crystal);
  }

  // ==========================================
  // 3D PAWN CREATION & POSITIONING
  // ==========================================

  private createPawns(): void {
    this.players.forEach((player) => {
      player.pawns.forEach((pawn) => {
        const pawnMesh = this.buildPawnModel(player.color);
        pawn.mesh = pawnMesh;

        // Interactive metadata for raycasting
        pawnMesh.userData = {
          pawn: pawn,
          player: player,
        };

        // Position in yard initially - sits directly on yard socket pad
        const yardPos = getPawnWorldPosition(player.color, pawn.id, -1);
        pawnMesh.position.set(yardPos.x, yardPos.y, yardPos.z);
        this.scene.add(pawnMesh);
      });
    });
  }

  private buildPawnModel(color: PlayerColor): THREE.Group {
    const group = new THREE.Group();
    const meta = PLAYER_METAS[color];

    const pawnMat = new THREE.MeshStandardMaterial({
      color: meta.hex,
      roughness: 0.2,
      metalness: 0.25,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.2,
      metalness: 0.85,
    });

    // 1. Pawn Base Disc
    const baseGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.18, 20);
    const baseMesh = new THREE.Mesh(baseGeo, pawnMat);
    baseMesh.position.y = 0.09;
    baseMesh.castShadow = true;
    group.add(baseMesh);

    // 2. Base Ring Trim (Gold accent)
    const ringGeo = new THREE.TorusGeometry(0.35, 0.04, 12, 24);
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.16;
    group.add(ringMesh);

    // 3. Torso
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.32, 0.55, 20);
    const bodyMesh = new THREE.Mesh(bodyGeo, pawnMat);
    bodyMesh.position.y = 0.44;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // 4. Collar Neck Ring
    const collarGeo = new THREE.TorusGeometry(0.2, 0.035, 12, 24);
    const collarMesh = new THREE.Mesh(collarGeo, goldMat);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.y = 0.72;
    group.add(collarMesh);

    // 5. Spherical Head
    const headGeo = new THREE.SphereGeometry(0.28, 20, 20);
    const headMesh = new THREE.Mesh(headGeo, pawnMat);
    headMesh.position.y = 0.98;
    headMesh.castShadow = true;
    group.add(headMesh);

    // 6. Glowing Selection Halo (Hidden until valid move)
    const haloGeo = new THREE.RingGeometry(0.42, 0.62, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.y = 0.03;
    group.add(haloMesh);

    // Keep reference in userData for easy toggling
    group.userData['halo'] = haloMesh;

    return group;
  }

  // ==========================================
  // 3D DICE CREATION & ANIMATION
  // ==========================================

  private createDice(): void {
    this.diceMesh = new THREE.Group();
    const diceSize = 1.3;

    // Rounded die cube body
    const cubeGeo = new THREE.BoxGeometry(diceSize, diceSize, diceSize);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.1,
    });
    const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
    cubeMesh.castShadow = true;
    cubeMesh.receiveShadow = true;
    this.diceMesh.add(cubeMesh);

    // Dice Pips (1 to 6) on the 6 faces
    this.addDicePips(diceSize);

    // Click trigger box on the dice
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(diceSize * 1.3, diceSize * 1.3, diceSize * 1.3),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.userData = { isDice: true };
    this.diceMesh.add(hitBox);

    this.positionDiceForPlayer('red');
    this.scene.add(this.diceMesh);
  }

  private addDicePips(size: number): void {
    const half = size / 2 + 0.01;
    const pipRadius = 0.1;
    const pipGeo = new THREE.CylinderGeometry(pipRadius, pipRadius, 0.03, 16);
    const pipMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
    });
    const redPipMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
    });

    const createPip = (
      pos: [number, number, number],
      rot: [number, number, number],
      isRed: boolean = false
    ) => {
      const pip = new THREE.Mesh(pipGeo, isRed ? redPipMat : pipMat);
      pip.position.set(pos[0], pos[1], pos[2]);
      pip.rotation.set(rot[0], rot[1], rot[2]);
      this.diceMesh.add(pip);
    };

    const d = 0.34;

    // Face 1: Top (+Y)
    createPip([0, half, 0], [0, 0, 0], true);

    // Face 6: Bottom (-Y)
    const face6: [number, number, number][] = [
      [-d, -half, -d],
      [-d, -half, 0],
      [-d, -half, d],
      [d, -half, -d],
      [d, -half, 0],
      [d, -half, d],
    ];
    face6.forEach((p) => createPip(p, [Math.PI, 0, 0]));

    // Face 2: Right (+X)
    createPip([half, -d, -d], [0, 0, -Math.PI / 2]);
    createPip([half, d, d], [0, 0, -Math.PI / 2]);

    // Face 5: Left (-X)
    createPip([-half, 0, 0], [0, 0, Math.PI / 2]);
    createPip([-half, -d, -d], [0, 0, Math.PI / 2]);
    createPip([-half, d, d], [0, 0, Math.PI / 2]);
    createPip([-half, -d, d], [0, 0, Math.PI / 2]);
    createPip([-half, d, -d], [0, 0, Math.PI / 2]);

    // Face 3: Front (+Z)
    createPip([0, 0, half], [Math.PI / 2, 0, 0]);
    createPip([-d, -d, half], [Math.PI / 2, 0, 0]);
    createPip([d, d, half], [Math.PI / 2, 0, 0]);

    // Face 4: Back (-Z)
    createPip([-d, -d, -half], [-Math.PI / 2, 0, 0]);
    createPip([-d, d, -half], [-Math.PI / 2, 0, 0]);
    createPip([d, -d, -half], [-Math.PI / 2, 0, 0]);
    createPip([d, d, -half], [-Math.PI / 2, 0, 0]);
  }

  // Rotate dice to face upward for numbers 1 to 6
  private getEulerForDiceFace(num: number): THREE.Euler {
    switch (num) {
      case 1:
        return new THREE.Euler(0, 0, 0);
      case 6:
        return new THREE.Euler(Math.PI, 0, 0);
      case 2:
        return new THREE.Euler(0, 0, -Math.PI / 2);
      case 5:
        return new THREE.Euler(0, 0, Math.PI / 2);
      case 3:
        return new THREE.Euler(Math.PI / 2, 0, 0);
      case 4:
        return new THREE.Euler(-Math.PI / 2, 0, 0);
      default:
        return new THREE.Euler(0, 0, 0);
    }
  }

  private positionDiceForPlayer(color: PlayerColor): void {
    const diceOffsets: Record<PlayerColor, { x: number; z: number }> = {
      red: { x: -8.8, z: -8.8 },
      green: { x: 8.8, z: -8.8 },
      yellow: { x: 8.8, z: 8.8 },
      blue: { x: -8.8, z: 8.8 },
    };
    const offset = diceOffsets[color];
    this.diceMesh.position.set(offset.x, DICE_RESTING_Y, offset.z);
  }

  // ==========================================
  // DICE ROLL & TURN FLOW
  // ==========================================

  public onRollDiceClick(): void {
    if (!this.canRoll || this.isDiceRolling || this.isAnimatingMove || this.isGameOver) {
      return;
    }
    if (this.currentPlayer?.type === 'bot') {
      return; // Humans can only roll on human turns
    }

    this.executeDiceRoll();
  }

  private executeDiceRoll(): void {
    this.canRoll = false;
    this.isDiceRolling = true;
    this.waitingForPawnSelect = false;
    this.clearPawnHighlights();

    // Roll random 1..6
    const roll = Math.floor(Math.random() * 6) + 1;
    this.diceValue = roll;

    this.audio.playDiceRoll();

    // Trigger 3D dice rolling animation
    const curPos = this.diceMesh.position.clone();
    const targetRot = this.getEulerForDiceFace(roll);

    this.diceRollingAnim = {
      startTime: performance.now(),
      duration: this.gameSpeed === 'fast' ? 550 : 850,
      startPos: curPos,
      peakY: curPos.y + 3.2,
      endPos: curPos.clone(),
      startRot: this.diceMesh.rotation.clone(),
      rotSpins: new THREE.Vector3(
        (Math.PI * 4 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1),
        (Math.PI * 4 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1),
        (Math.PI * 4 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1)
      ),
    };
    this.diceTargetRotation = targetRot;

    setTimeout(() => {
      this.isDiceRolling = false;
      this.diceRollingAnim = null;
      this.diceMesh.position.y = DICE_RESTING_Y;
      this.diceMesh.rotation.copy(targetRot);

      this.onDiceRollFinished(roll);
    }, this.diceRollingAnim.duration);
  }

  private onDiceRollFinished(roll: number): void {
    const player = this.currentPlayer;
    if (!player) return;

    // Consecutive sixes check
    if (roll === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes >= 3) {
        this.statusMessage = `${player.name} rolled three 6s in a row! Turn cancelled!`;
        this.statusBadge = 'Turn Cancelled';
        this.audio.playNoMoves();
        this.logAction(player.color, player.name, 'Rolled three 6s in a row (Turn voided)', 'pass', '⚠️');
        this.consecutiveSixes = 0;
        setTimeout(() => this.passTurnToNextPlayer(), 1200);
        return;
      }
    } else {
      this.consecutiveSixes = 0;
    }

    // Evaluate valid pawn moves
    const validMoves = this.getValidMovesForPlayer(player, roll);
    this.selectablePawnIndices = validMoves.map((m) => m.pawnIndex);

    this.logAction(
      player.color,
      player.name,
      `Rolled a ${roll}! ${roll === 6 ? 'Bonus roll unlocked!' : ''}`,
      'roll',
      '🎲'
    );

    if (validMoves.length === 0) {
      this.statusMessage = `No moves available for ${player.name}. Turn passed!`;
      this.statusBadge = 'No Moves';
      this.audio.playNoMoves();
      this.logAction(player.color, player.name, 'No legal moves available. Turn passed.', 'pass', '⏭️');
      setTimeout(() => this.passTurnToNextPlayer(), 1100);
      return;
    }

    // Handle bot decision or wait for human click
    if (player.type === 'bot') {
      this.statusMessage = `${player.name} (Bot) is calculating best move...`;
      this.statusBadge = 'AI Thinking';
      const delay = this.gameSpeed === 'fast' ? 400 : 800;
      setTimeout(() => {
        const chosenMove = this.chooseBestBotMove(player, validMoves);
        this.executeMove(chosenMove);
      }, delay);
    } else {
      // Human turn
      this.statusMessage = `Select a glowing pawn to move ${roll} step${roll > 1 ? 's' : ''}!`;
      this.statusBadge = 'Select Pawn';
      this.waitingForPawnSelect = true;
      this.highlightSelectablePawns(this.selectablePawnIndices);

      // Auto-move single option if only 1 valid move exists
      if (validMoves.length === 1 && this.gameSpeed === 'fast') {
        setTimeout(() => {
          if (this.waitingForPawnSelect) {
            this.executeMove(validMoves[0]);
          }
        }, 350);
      }
    }
  }

  // ==========================================
  // MOVE VALIDATION & CALCULATIONS
  // ==========================================

  private getValidMovesForPlayer(player: LudoPlayer, roll: number): MoveAction[] {
    const validMoves: MoveAction[] = [];

    player.pawns.forEach((pawn, idx) => {
      // 1. Pawn in Yard
      if (pawn.state === 'yard') {
        if (roll === 6) {
          // Can exit yard to start tile
          const targetStep = 0;
          const captureTarget = this.findOpponentPawnAtStep(player.color, targetStep);
          validMoves.push({
            pawnIndex: idx,
            pawn: pawn,
            fromStep: -1,
            toStep: 0,
            isCapture: captureTarget !== undefined,
            targetPawnToCapture: captureTarget,
            entersHome: false,
            reachesGoal: false,
          });
        }
        return;
      }

      // 2. Pawn on Track or Home Path
      if (pawn.state === 'track' || pawn.state === 'home') {
        const targetStep = pawn.stepCount + roll;

        // Exactly reaching Goal (step 56)
        if (targetStep === 56) {
          validMoves.push({
            pawnIndex: idx,
            pawn: pawn,
            fromStep: pawn.stepCount,
            toStep: 56,
            isCapture: false,
            entersHome: true,
            reachesGoal: true,
          });
          return;
        }

        // Inside Home Path (step 51..55)
        if (targetStep > 50 && targetStep < 56) {
          validMoves.push({
            pawnIndex: idx,
            pawn: pawn,
            fromStep: pawn.stepCount,
            toStep: targetStep,
            isCapture: false,
            entersHome: true,
            reachesGoal: false,
          });
          return;
        }

        // On Main Track (step 0..50)
        if (targetStep <= 50) {
          const captureTarget = this.findOpponentPawnAtStep(player.color, targetStep);
          validMoves.push({
            pawnIndex: idx,
            pawn: pawn,
            fromStep: pawn.stepCount,
            toStep: targetStep,
            isCapture: captureTarget !== undefined,
            targetPawnToCapture: captureTarget,
            entersHome: false,
            reachesGoal: false,
          });
          return;
        }

        // targetStep > 56 means overshoot! Cannot move.
      }
    });

    return validMoves;
  }

  private findOpponentPawnAtStep(myColor: PlayerColor, stepCount: number): LudoPawn | undefined {
    // Pawns in home lane or goal cannot be captured
    if (stepCount < 0 || stepCount > 50) return undefined;

    const myTrackIdx = getTrackIndex(myColor, stepCount);

    // If safe tile (star or start), pawns CANNOT be captured
    if (SAFE_TRACK_INDEXES.has(myTrackIdx)) {
      return undefined;
    }

    // Check all active players
    for (const otherPlayer of this.players) {
      if (otherPlayer.color === myColor || otherPlayer.rank > 0) continue;

      for (const otherPawn of otherPlayer.pawns) {
        if (otherPawn.state === 'track') {
          const otherTrackIdx = getTrackIndex(otherPlayer.color, otherPawn.stepCount);
          if (otherTrackIdx === myTrackIdx) {
            return otherPawn;
          }
        }
      }
    }

    return undefined;
  }

  // ==========================================
  // AI BOT INTELLIGENCE
  // ==========================================

  private chooseBestBotMove(player: LudoPlayer, validMoves: MoveAction[]): MoveAction {
    if (validMoves.length === 1) return validMoves[0];

    let bestScore = -Infinity;
    let bestMove = validMoves[0];

    validMoves.forEach((move) => {
      let score = 0;

      // 1. Reaching Goal is top priority
      if (move.reachesGoal) {
        score += 300;
      }

      // 2. Capturing an opponent pawn
      if (move.isCapture) {
        score += 200;
      }

      // 3. Exiting yard onto board when 6 is rolled
      if (move.fromStep === -1) {
        score += 150;
      }

      // 4. Entering home path (safety + progress)
      if (move.entersHome && move.fromStep <= 50) {
        score += 120;
      }

      // 5. Landing on a safe star tile
      const targetTrack = getTrackIndex(player.color, move.toStep);
      if (SAFE_TRACK_INDEXES.has(targetTrack)) {
        score += 80;
      }

      // 6. Escaping an enemy threat behind us within 6 steps
      const currentTrack = getTrackIndex(player.color, move.fromStep);
      if (currentTrack !== -1 && !SAFE_TRACK_INDEXES.has(currentTrack)) {
        let isThreatened = false;
        for (const other of this.players) {
          if (other.color === player.color || other.rank > 0) continue;
          for (const oppPawn of other.pawns) {
            if (oppPawn.state === 'track') {
              const oppTrack = getTrackIndex(other.color, oppPawn.stepCount);
              const dist = (currentTrack - oppTrack + 52) % 52;
              if (dist >= 1 && dist <= 6) {
                isThreatened = true;
                break;
              }
            }
          }
          if (isThreatened) break;
        }
        if (isThreatened) score += 60;
      }

      // 7. General progress bonus (advance pawns further)
      score += move.toStep * 1.5;

      // Easy bots introduce slight randomness
      if (player.difficulty === 'easy') {
        score += Math.random() * 80;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });

    return bestMove;
  }

  // ==========================================
  // MOVE EXECUTION & 3D HOP ANIMATION
  // ==========================================

  public onPawnClick(pawnIndex: number): void {
    if (!this.waitingForPawnSelect || this.isAnimatingMove) return;

    if (!this.selectablePawnIndices.includes(pawnIndex)) return;

    const player = this.currentPlayer;
    if (!player) return;

    const validMoves = this.getValidMovesForPlayer(player, this.diceValue);
    const move = validMoves.find((m) => m.pawnIndex === pawnIndex);

    if (move) {
      this.executeMove(move);
    }
  }

  private executeMove(move: MoveAction): void {
    this.waitingForPawnSelect = false;
    this.clearPawnHighlights();
    this.isAnimatingMove = true;

    const pawn = move.pawn;
    const player = this.currentPlayer!;

    // Generate path waypoints for hopping animation
    const waypoints: { x: number; y: number; z: number }[] = [];

    if (move.fromStep === -1) {
      // Exiting Yard: Hop directly to start tile
      const dest = getPawnWorldPosition(player.color, pawn.id, 0);
      waypoints.push(dest);
    } else {
      // Step-by-step track hopping
      for (let s = move.fromStep + 1; s <= move.toStep; s++) {
        const dest = getPawnWorldPosition(player.color, pawn.id, s);
        waypoints.push(dest);
      }
    }

    const durationPerStep = this.gameSpeed === 'fast' ? 110 : 170;

    this.activeHopAnimation = {
      pawn: pawn,
      steps: waypoints,
      currentStepIdx: 0,
      startTime: performance.now(),
      durationPerStep: durationPerStep,
      isCapture: move.isCapture,
      capturedPawn: move.targetPawnToCapture,
      reachesGoal: move.reachesGoal,
      onComplete: () => {
        const finalPos = waypoints[waypoints.length - 1];
        if (pawn.mesh && finalPos) {
          pawn.mesh.position.set(finalPos.x, finalPos.y, finalPos.z);
        }
        this.onMoveHopComplete(move);
      },
    };

    // Play first hop sound
    this.audio.playPawnHop();
  }

  private onMoveHopComplete(move: MoveAction): void {
    this.activeHopAnimation = null;
    this.isAnimatingMove = false;

    const pawn = move.pawn;
    const player = this.currentPlayer!;

    // Update pawn state
    pawn.stepCount = move.toStep;
    if (move.toStep === 56) {
      pawn.state = 'goal';
      this.audio.playGoal();
      this.logAction(player.color, player.name, 'Pawn entered the GOAL! 🏆', 'goal', '⭐');
    } else if (move.toStep > 50) {
      pawn.state = 'home';
    } else {
      pawn.state = 'track';
    }

    // Handle Opponent Capture
    let extraRollReward = false;
    if (move.isCapture && move.targetPawnToCapture) {
      const captured = move.targetPawnToCapture;
      captured.state = 'yard';
      captured.stepCount = -1;

      // Animate captured pawn returning to yard - sits directly on yard socket pad
      const yardPos = getPawnWorldPosition(captured.color, captured.id, -1);
      if (captured.mesh) {
        captured.mesh.position.set(yardPos.x, yardPos.y, yardPos.z);
      }

      this.audio.playCapture();
      this.logAction(
        player.color,
        player.name,
        `Captured ${PLAYER_METAS[captured.color].name}'s pawn! Sent back to Yard!`,
        'capture',
        '⚔️'
      );

      extraRollReward = true;
    }

    // Check if player won the game
    const hasWon = player.pawns.every((p) => p.state === 'goal');
    if (hasWon && player.rank === 0) {
      player.rank = this.winners.length + 1;
      this.winners.push(player);

      this.audio.playVictory();
      this.logAction(
        player.color,
        player.name,
        `Finished in Rank #${player.rank}! Congratulations!`,
        'win',
        '👑'
      );

      // Check if entire game is over (only 1 player remains)
      const activeUnfinished = this.players.filter((p) => p.rank === 0);
      if (activeUnfinished.length <= 1) {
        if (activeUnfinished.length === 1) {
          activeUnfinished[0].rank = this.winners.length + 1;
          this.winners.push(activeUnfinished[0]);
        }
        this.isGameOver = true;
        this.statusMessage = `Game Over! Winner: ${this.winners[0].name}!`;
        this.statusBadge = 'Match Finished';
        this.triggerVictoryCelebration();
        this.cdr.detectChanges();
        return;
      }
    }

    // Decide if player gets an extra roll
    // Extra roll granted if:
    // 1. Rolled a 6
    // 2. Captured an opponent
    // 3. Reached goal
    const getsExtraRoll = this.diceValue === 6 || extraRollReward || move.reachesGoal;

    if (getsExtraRoll && player.rank === 0) {
      this.statusMessage = `${player.name} gets a BONUS ROLL!`;
      this.statusBadge = 'Bonus Turn';
      this.canRoll = true;
      this.cdr.detectChanges();
      this.checkBotTurn();
    } else {
      this.passTurnToNextPlayer();
    }
  }

  private passTurnToNextPlayer(): void {
    if (this.isGameOver) return;

    this.consecutiveSixes = 0;
    this.canRoll = true;
    this.waitingForPawnSelect = false;
    this.clearPawnHighlights();

    // Advance turn to next active unfinished player
    let nextIdx = (this.currentTurnIndex + 1) % this.players.length;
    let loops = 0;
    while (this.players[nextIdx].rank > 0 && loops < this.players.length) {
      nextIdx = (nextIdx + 1) % this.players.length;
      loops++;
    }

    this.currentTurnIndex = nextIdx;
    const player = this.currentPlayer!;

    this.positionDiceForPlayer(player.color);
    this.audio.playTurn();

    this.statusMessage = `${player.name}'s turn. Roll the dice!`;
    this.statusBadge = `${player.type === 'bot' ? 'Bot' : 'Human'} Turn`;

    this.updateCameraForPlayer();
    this.cdr.detectChanges();
    this.checkBotTurn();
  }

  private checkBotTurn(): void {
    if (this.isGameOver) return;
    const player = this.currentPlayer;
    if (player && player.type === 'bot') {
      const delay = this.gameSpeed === 'fast' ? 450 : 850;
      setTimeout(() => {
        if (this.canRoll && !this.isDiceRolling && !this.isGameOver) {
          this.executeDiceRoll();
        }
      }, delay);
    }
  }

  // ==========================================
  // RAYCASTING & 3D INTERACTION
  // ==========================================

  public onCanvasClick(event: MouseEvent): void {
    if (!this.viewportContainer || this.isAnimatingMove) return;

    const rect = this.rendererCanvas.nativeElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length === 0) return;

    // Check if clicked the 3D dice
    for (const hit of intersects) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData && obj.userData['isDice']) {
          if (this.canRoll && !this.isDiceRolling && this.currentPlayer?.type === 'human') {
            this.executeDiceRoll();
            return;
          }
        }
        // Check if clicked a pawn
        if (obj.userData && obj.userData['pawn'] && this.waitingForPawnSelect) {
          const pawn = obj.userData['pawn'] as LudoPawn;
          const player = obj.userData['player'] as LudoPlayer;
          if (player.color === this.currentPlayer?.color) {
            this.onPawnClick(pawn.id);
            return;
          }
        }
        obj = obj.parent;
      }
    }
  }

  private highlightSelectablePawns(pawnIndices: number[]): void {
    const player = this.currentPlayer;
    if (!player) return;

    player.pawns.forEach((pawn, idx) => {
      const halo = pawn.mesh?.userData['halo'] as THREE.Mesh;
      if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
        if (pawnIndices.includes(idx)) {
          halo.material.opacity = 0.85;
        } else {
          halo.material.opacity = 0;
        }
      }
    });
  }

  private clearPawnHighlights(): void {
    this.players.forEach((p) => {
      p.pawns.forEach((pawn) => {
        const halo = pawn.mesh?.userData['halo'] as THREE.Mesh;
        if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
          halo.material.opacity = 0;
        }
      });
    });
  }

  // ==========================================
  // CAMERA VIEW PRESETS
  // ==========================================

  public setCameraView(view: 'orbit' | 'top' | 'player'): void {
    this.cameraView = view;
    this.updateCameraForPlayer();
  }

  private updateCameraForPlayer(): void {
    if (!this.controls || !this.camera) return;

    if (this.cameraView === 'top') {
      // Orthogonal-style top down
      this.camera.position.set(0, 32, 0.01);
      this.controls.target.set(0, 0, 0);
    } else if (this.cameraView === 'player' && this.currentPlayer) {
      // Swivel camera to current player's side
      const angles: Record<PlayerColor, { x: number; z: number }> = {
        red: { x: -20, z: -20 },
        green: { x: 20, z: -20 },
        yellow: { x: 20, z: 20 },
        blue: { x: -20, z: 20 },
      };
      const pos = angles[this.currentPlayer.color];
      this.camera.position.set(pos.x, 22, pos.z);
      this.controls.target.set(0, 0, 0);
    } else {
      // Default 3D Orbit view
      this.camera.position.set(0, 24, 25);
      this.controls.target.set(0, 0, 0);
    }

    this.controls.update();
  }

  // ==========================================
  // CELEBRATION PARTICLES
  // ==========================================

  private triggerVictoryCelebration(): void {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const palette = [0xef4444, 0x10b981, 0xf59e0b, 0x3b82f6, 0xec4899];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 12 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

      const col = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    this.confettiParticles = new THREE.Points(geometry, material);
    this.scene.add(this.confettiParticles);
  }

  // ==========================================
  // RENDER LOOP & ANIMATION UPDATE
  // ==========================================

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();

    // 1. Update 3D Dice Roll Animation
    if (this.diceRollingAnim) {
      const anim = this.diceRollingAnim;
      const progress = Math.min((now - anim.startTime) / anim.duration, 1);
      const ease = Math.sin(progress * Math.PI); // Arc parabola

      // Y bounce arc
      const currentY = anim.startPos.y + ease * (anim.peakY - anim.startPos.y);
      this.diceMesh.position.y = currentY;

      // Tumbling rotation
      this.diceMesh.rotation.x = anim.startRot.x + anim.rotSpins.x * progress;
      this.diceMesh.rotation.y = anim.startRot.y + anim.rotSpins.y * progress;
      this.diceMesh.rotation.z = anim.startRot.z + anim.rotSpins.z * progress;
    }

    // 2. Update Pawn Hopping Animation
    if (this.activeHopAnimation) {
      const hop = this.activeHopAnimation;
      const stepProgress = (now - hop.startTime) / hop.durationPerStep;

      if (stepProgress >= 1) {
        // Snap directly to current waypoint
        const finishedStep = hop.steps[hop.currentStepIdx];
        if (hop.pawn.mesh && finishedStep) {
          hop.pawn.mesh.position.set(finishedStep.x, finishedStep.y, finishedStep.z);
        }

        hop.currentStepIdx++;
        if (hop.currentStepIdx >= hop.steps.length) {
          // All steps completed!
          hop.onComplete();
        } else {
          // Proceed to next step
          hop.startTime = performance.now();
          this.audio.playPawnHop();
        }
      } else {
        const curStep = hop.steps[hop.currentStepIdx];
        const prevStep =
          hop.currentStepIdx === 0
            ? hop.pawn.mesh
              ? {
                  x: hop.pawn.mesh.position.x,
                  y: hop.pawn.mesh.position.y,
                  z: hop.pawn.mesh.position.z,
                }
              : curStep
            : hop.steps[hop.currentStepIdx - 1];

        // Smooth parabolic hop
        const hopEase = Math.sin(stepProgress * Math.PI);
        const x = THREE.MathUtils.lerp(prevStep.x, curStep.x, stepProgress);
        const z = THREE.MathUtils.lerp(prevStep.z, curStep.z, stepProgress);
        const y = THREE.MathUtils.lerp(prevStep.y, curStep.y, stepProgress) + hopEase * 0.75;

        if (hop.pawn.mesh) {
          hop.pawn.mesh.position.set(x, y, z);
        }
      }
    }

    // 3. Pulse Halo Rings on Selectable Pawns
    if (this.waitingForPawnSelect && this.currentPlayer) {
      const pulseOpacity = 0.5 + Math.sin(now * 0.008) * 0.45;
      this.currentPlayer.pawns.forEach((pawn, idx) => {
        if (this.selectablePawnIndices.includes(idx)) {
          const halo = pawn.mesh?.userData['halo'] as THREE.Mesh;
          if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
            halo.material.opacity = pulseOpacity;
          }
        }
      });
    }

    // 4. Update Victory Confetti
    if (this.confettiParticles) {
      const positions = this.confettiParticles.geometry.attributes['position'].array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] -= 0.05;
        if (positions[i * 3 + 1] < 0.2) {
          positions[i * 3 + 1] = 14;
        }
      }
      this.confettiParticles.geometry.attributes['position'].needsUpdate = true;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ==========================================
  // HELPERS & UI LOGGING
  // ==========================================

  public toggleMute(): void {
    this.isSoundMuted = this.audio.toggleMute();
  }

  public toggleSpeed(): void {
    this.gameSpeed = this.gameSpeed === 'normal' ? 'fast' : 'normal';
  }

  public toggleHistory(): void {
    this.isHistoryOpen = !this.isHistoryOpen;
  }

  public logAction(
    color: PlayerColor,
    name: string,
    text: string,
    type: 'roll' | 'move' | 'capture' | 'goal' | 'pass' | 'win' | 'start',
    badge?: string
  ): void {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.gameLogs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      time: time,
      playerColor: color,
      playerName: name,
      text: text,
      badge: badge,
      type: type === 'start' ? 'roll' : type,
    });
    if (this.gameLogs.length > 50) this.gameLogs.pop();
  }

  public getPlayerColorCss(color: PlayerColor): string {
    return PLAYER_METAS[color].css;
  }

  public getPlayerGoalCount(player: LudoPlayer): number {
    return player.pawns.filter((p) => p.state === 'goal').length;
  }
}
