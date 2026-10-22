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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { CHESS_MODELS_GLB_BASE64 } from './chess-models.data';

export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
}

export interface BoardCoord {
  x: number; // 0..7 (a..h)
  y: number; // 0..7 (1..8)
}

export interface Move {
  from: BoardCoord;
  to: BoardCoord;
  captured?: ChessPiece | null;
  piece: ChessPiece;
  promotion?: PieceType;
  san?: string;
}

export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type ChessTheme = 'normal';

// Piece-Square evaluation heatmaps for AI positioning
const PAWN_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_PST = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_PST = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_PST = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_PST = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MID_PST = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

@Component({
  selector: 'app-threejschess',
  imports: [CommonModule, RouterLink],
  templateUrl: './threejschess.html',
  styleUrl: './threejschess.scss',
  host: {
    ngSkipHydration: 'true',
  },
})
export class Threejschess implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportContainer') containerRef!: ElementRef<HTMLDivElement>;

  // Board state: 8x8 (x: 0..7 => a..h, y: 0..7 => 1..8)
  board: (ChessPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Game tracking
  turn: PieceColor = 'w';
  playerColor: PieceColor = 'w';
  aiDifficulty: AIDifficulty = 'medium';
  isThinking = false;
  isGameOver = false;
  gameStatusText = 'White to move';
  isCheck = false;
  selectedCoord: BoardCoord | null = null;
  validMoves: BoardCoord[] = [];
  moveHistory: { white: string; black?: string }[] = [];
  capturedByWhite: ChessPiece[] = [];
  capturedByBlack: ChessPiece[] = [];

  // Collapsible UI state
  isLeftCollapsed = false;
  isRightCollapsed = false;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  // Theme & Environment state
  currentTheme: ChessTheme = 'normal';
  showCloisterScene = true;
  private hdrEnvironmentTexture: THREE.DataTexture | null = null;

  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isBrowser = false;

  // 3D Objects mapping
  private squareMeshes: THREE.Mesh[][] = [];
  private frameMesh!: THREE.Mesh;
  private rimMesh!: THREE.Mesh;
  private pieceObjects: Map<string, THREE.Group> = new Map(); // key: "x,y"
  private highlightGroup = new THREE.Group();
  private boardGroup = new THREE.Group();
  private piecesGroup = new THREE.Group();
  private loadedPieceGeometries: Map<PieceType, THREE.BufferGeometry> = new Map();

  // Lights
  private hemiLight!: THREE.HemisphereLight;
  private dirKeyLight!: THREE.DirectionalLight;
  private dirFillLight!: THREE.DirectionalLight;
  private dirRimLight!: THREE.DirectionalLight;
  private centerPointLight!: THREE.PointLight;

  // Materials
  private whitePieceMaterial!: THREE.Material;
  private blackPieceMaterial!: THREE.Material;
  private lightSquareMaterial!: THREE.Material;
  private darkSquareMaterial!: THREE.Material;
  private frameMaterial!: THREE.Material;
  private rimMaterial!: THREE.Material;
  private selectedSquareMaterial!: THREE.Material;
  private targetSquareMaterial!: THREE.Material;
  private lastMoveMaterial!: THREE.Material;

  private lastMove: { from: BoardCoord; to: BoardCoord } | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initBoardState();
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.initThree();
    }
  }

  toggleLeft() {
    this.isLeftCollapsed = !this.isLeftCollapsed;
    this.cdr.detectChanges();
  }

  toggleRight() {
    this.isRightCollapsed = !this.isRightCollapsed;
    this.cdr.detectChanges();
  }

  setDifficulty(diff: AIDifficulty) {
    this.aiDifficulty = diff;
    this.cdr.detectChanges();
  }

  setTheme(theme: ChessTheme) {
    this.currentTheme = theme;
    if (!this.scene) return;
    this.applyThemeMaterials(theme);
    this.updateLightingForTheme(theme);
    this.updateBoardMaterials();
    this.rebuildAllPieces3D();
    this.updateHighlights();
    this.cdr.detectChanges();
  }

  toggleCloisterScene() {
    this.showCloisterScene = !this.showCloisterScene;
    if (!this.scene) return;

    if (this.showCloisterScene && this.hdrEnvironmentTexture) {
      this.scene.background = this.hdrEnvironmentTexture;
      this.scene.backgroundBlurriness = 0.03;
      this.scene.fog = null;
    } else {
      this.updateLightingForTheme(this.currentTheme);
    }
    this.cdr.detectChanges();
  }

  setCameraView(view: 'player' | 'opponent' | 'top' | 'isometric') {
    if (!this.camera || !this.controls) return;
    switch (view) {
      case 'player':
        this.camera.position.set(0, 7.5, 7.5);
        this.controls.target.set(0, 0, 0);
        break;
      case 'opponent':
        this.camera.position.set(0, 7.5, -7.5);
        this.controls.target.set(0, 0, 0);
        break;
      case 'top':
        this.camera.position.set(0, 10.5, 0.01);
        this.controls.target.set(0, 0, 0);
        break;
      case 'isometric':
        this.camera.position.set(6.5, 7.0, 6.5);
        this.controls.target.set(0, 0, 0);
        break;
    }
    this.controls.update();
  }

  resetGame() {
    this.initBoardState();
    this.turn = 'w';
    this.isThinking = false;
    this.isGameOver = false;
    this.isCheck = false;
    this.gameStatusText = 'White to move';
    this.selectedCoord = null;
    this.validMoves = [];
    this.moveHistory = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.lastMove = null;

    if (this.scene) {
      this.rebuildAllPieces3D();
      this.clearHighlights();
    }

    if (this.playerColor === 'b') {
      this.triggerAIMove();
    }
    this.cdr.detectChanges();
  }

  undoMove() {
    if (this.isThinking || this.moveHistory.length === 0) return;
    // For simplicity with AI, undo both the AI's move and the player's last move
    // We restart board and replay all moves except the last pair
    const targetMoveCount = (this.moveHistory.length - 1) * 2;
    // If black hadn't played yet in the current round, just undo 1 move
    const lastRound = this.moveHistory[this.moveHistory.length - 1];
    const totalHalfMoves = (this.moveHistory.length - 1) * 2 + (lastRound.black ? 2 : 1);
    const stepsToKeep = Math.max(0, totalHalfMoves - 2);

    this.replayMovesUpTo(stepsToKeep);
    this.cdr.detectChanges();
  }

  private initBoardState() {
    this.board = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null));

    // Place Pawns
    for (let x = 0; x < 8; x++) {
      this.board[x][1] = { type: 'p', color: 'w', hasMoved: false };
      this.board[x][6] = { type: 'p', color: 'b', hasMoved: false };
    }

    // Place Rooks
    this.board[0][0] = { type: 'r', color: 'w', hasMoved: false };
    this.board[7][0] = { type: 'r', color: 'w', hasMoved: false };
    this.board[0][7] = { type: 'r', color: 'b', hasMoved: false };
    this.board[7][7] = { type: 'r', color: 'b', hasMoved: false };

    // Place Knights
    this.board[1][0] = { type: 'n', color: 'w' };
    this.board[6][0] = { type: 'n', color: 'w' };
    this.board[1][7] = { type: 'n', color: 'b' };
    this.board[6][7] = { type: 'n', color: 'b' };

    // Place Bishops
    this.board[2][0] = { type: 'b', color: 'w' };
    this.board[5][0] = { type: 'b', color: 'w' };
    this.board[2][7] = { type: 'b', color: 'b' };
    this.board[5][7] = { type: 'b', color: 'b' };

    // Place Queens
    this.board[3][0] = { type: 'q', color: 'w' };
    this.board[3][7] = { type: 'q', color: 'b' };

    // Place Kings
    this.board[4][0] = { type: 'k', color: 'w', hasMoved: false };
    this.board[4][7] = { type: 'k', color: 'b', hasMoved: false };
  }

  /* ========================================================================
     THREE.JS SETUP & 3D RENDERING
     ======================================================================== */
  private initThree() {
    const canvas = this.canvasRef.nativeElement;
    const container = this.containerRef.nativeElement;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0e14);
    this.scene.fog = new THREE.FogExp2(0x0b0e14, 0.035);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 7.8, 7.8);

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

    (window as any).__CHESS_RENDERER__ = this.renderer;
    (window as any).__CHESS_CANVAS__ = canvas;

    if (typeof ResizeObserver !== 'undefined' && container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(container);
    }

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.05; // prevent going beneath board
    this.controls.minDistance = 4;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0, 0);

    this.setupLighting();
    this.initMaterials();
    this.updateLightingForTheme(this.currentTheme);
    this.buildBoard3D();
    this.rebuildAllPieces3D();
    this.loadChessModels();
    this.loadHdrEnvironment();

    this.boardGroup.renderOrder = 0;
    this.piecesGroup.renderOrder = 1;
    this.highlightGroup.renderOrder = 2;

    this.scene.add(this.highlightGroup);
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);

    this.animate();
  }

  private loadChessModels() {
    const loader = new GLTFLoader();

    // 1. Immediately parse embedded models from base64 (instant, 100% reliable, zero HTTP delay or 404 risk)
    try {
      if (typeof atob === 'function' && CHESS_MODELS_GLB_BASE64) {
        const binaryString = atob(CHESS_MODELS_GLB_BASE64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        loader.parse(
          bytes.buffer,
          '',
          (gltf) => {
            this.extractGeometriesFromScene(gltf.scene);
            if (this.loadedPieceGeometries.size > 0) {
              this.rebuildAllPieces3D();
              this.cdr.detectChanges();
            }
          },
          (err) => {
            console.warn('Could not parse embedded base64 models', err);
          }
        );
      }
    } catch (e) {
      console.warn('Error decoding base64 chess model data', e);
    }

    // 2. Also try loading from /ChessAssets/Bishop.glb as secondary source
    const assetUrls = [
      '/ChessAssets/Bishop.glb',
      'ChessAssets/Bishop.glb',
      typeof window !== 'undefined' ? `${window.location.origin}/ChessAssets/Bishop.glb` : '',
    ].filter(Boolean);

    const tryLoadBishop = (index: number) => {
      if (index >= assetUrls.length) return;
      loader.load(
        assetUrls[index],
        (gltf) => {
          this.extractGeometriesFromScene(gltf.scene);
          if (this.loadedPieceGeometries.size > 0) {
            this.rebuildAllPieces3D();
            this.cdr.detectChanges();
          }
        },
        undefined,
        () => {
          tryLoadBishop(index + 1);
        }
      );
    };

    tryLoadBishop(0);
  }

  private extractGeometriesFromScene(scene: THREE.Object3D) {
    scene.traverse((child: any) => {
      if (child.isMesh && child.geometry) {
        const name = (child.name || child.parent?.name || '').toLowerCase();
        let type: PieceType | null = null;
        if (name.includes('pawn')) type = 'p';
        else if (name.includes('rook')) type = 'r';
        else if (name.includes('knight')) type = 'n';
        else if (name.includes('bishop')) type = 'b';
        else if (name.includes('queen')) type = 'q';
        else if (name.includes('king')) type = 'k';

        if (type) {
          const geo = child.geometry.clone();
          geo.computeVertexNormals();
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
          this.loadedPieceGeometries.set(type, geo);
        }
      }
    });
  }

  private loadHdrEnvironment() {
    const hdrLoader = new HDRLoader();
    const hdrUrls = [
      '/ChessAssets/historic_cloister_passage_2k.hdr',
      'ChessAssets/historic_cloister_passage_2k.hdr',
      typeof window !== 'undefined' ? `${window.location.origin}/ChessAssets/historic_cloister_passage_2k.hdr` : '',
    ].filter(Boolean);

    const tryLoad = (idx: number) => {
      if (idx >= hdrUrls.length) return;
      hdrLoader.load(
        hdrUrls[idx],
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          this.hdrEnvironmentTexture = texture;
          this.scene.environment = texture;

          if (this.showCloisterScene) {
            this.scene.background = texture;
            this.scene.backgroundBlurriness = 0.03;
            this.scene.fog = null;
          }
          this.cdr.detectChanges();
        },
        undefined,
        () => tryLoad(idx + 1)
      );
    };

    tryLoad(0);
  }

  private setupLighting() {
    // 1. Balanced Sky/Ground Ambient Hemisphere Light
    this.hemiLight = new THREE.HemisphereLight(0xf5f8ff, 0x181e28, 0.75);
    this.scene.add(this.hemiLight);

    // 2. Main Key Directional Light with Soft Shadows
    this.dirKeyLight = new THREE.DirectionalLight(0xfff8ee, 1.6);
    this.dirKeyLight.position.set(6, 14, 7);
    this.dirKeyLight.castShadow = true;
    this.dirKeyLight.shadow.mapSize.width = 2048;
    this.dirKeyLight.shadow.mapSize.height = 2048;
    this.dirKeyLight.shadow.camera.near = 1;
    this.dirKeyLight.shadow.camera.far = 35;
    const d = 6.5;
    this.dirKeyLight.shadow.camera.left = -d;
    this.dirKeyLight.shadow.camera.right = d;
    this.dirKeyLight.shadow.camera.top = d;
    this.dirKeyLight.shadow.camera.bottom = -d;
    this.dirKeyLight.shadow.bias = -0.0004;
    this.dirKeyLight.shadow.radius = 2.0;
    this.scene.add(this.dirKeyLight);

    // 3. Soft Complementary Fill Light
    this.dirFillLight = new THREE.DirectionalLight(0x8aa8cf, 0.65);
    this.dirFillLight.position.set(-7, 9, -6);
    this.scene.add(this.dirFillLight);

    // 4. Back / Rim Light for crisp piece silhouettes
    this.dirRimLight = new THREE.DirectionalLight(0xffffff, 1.1);
    this.dirRimLight.position.set(0, 11, -9);
    this.scene.add(this.dirRimLight);

    // 5. Center Specular Accent Point Light
    this.centerPointLight = new THREE.PointLight(0xfff0dd, 0.75, 14, 2);
    this.centerPointLight.position.set(0, 5.5, 0);
    this.scene.add(this.centerPointLight);
  }

  private initMaterials() {
    this.applyThemeMaterials(this.currentTheme);
  }

  private applyThemeMaterials(theme: ChessTheme = 'normal') {
    // NORMAL / CLASSIC TOURNAMENT STUDIO THEME
    this.whitePieceMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f3ee,
      roughness: 0.16,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    this.blackPieceMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1e26,
      roughness: 0.22,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });

    this.lightSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e2d5,
      roughness: 0.32,
      metalness: 0.06,
    });

    this.darkSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0x242e3a,
      roughness: 0.38,
      metalness: 0.12,
    });

    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x12151c,
      roughness: 0.35,
      metalness: 0.2,
    });

    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      emissive: 0x443308,
      emissiveIntensity: 0.3,
      metalness: 0.85,
      roughness: 0.2,
    });

    this.selectedSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
    });

    this.targetSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.65,
    });

    this.lastMoveMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.5,
    });
  }

  private updateLightingForTheme(theme: ChessTheme = 'normal') {
    if (!this.scene || !this.hemiLight) return;

    this.scene.background = new THREE.Color(0x0e131b);
    this.scene.fog = new THREE.FogExp2(0x0e131b, 0.032);
    if (this.renderer) {
      this.renderer.toneMappingExposure = 1.15;
    }

    this.hemiLight.color.setHex(0xf5f8ff);
    this.hemiLight.groundColor.setHex(0x181e28);
    this.hemiLight.intensity = 0.75;

    this.dirKeyLight.color.setHex(0xfff8ee);
    this.dirKeyLight.intensity = 1.6;
    this.dirKeyLight.position.set(6, 14, 7);

    this.dirFillLight.color.setHex(0x8aa8cf);
    this.dirFillLight.intensity = 0.65;
    this.dirFillLight.position.set(-7, 9, -6);

    this.dirRimLight.color.setHex(0xffffff);
    this.dirRimLight.intensity = 1.1;
    this.dirRimLight.position.set(0, 11, -9);

    this.centerPointLight.color.setHex(0xfff0dd);
    this.centerPointLight.intensity = 0.75;

    if (this.showCloisterScene && this.hdrEnvironmentTexture) {
      this.scene.background = this.hdrEnvironmentTexture;
      this.scene.backgroundBlurriness = 0.03;
      this.scene.fog = null;
    }
  }

  private updateBoardMaterials() {
    if (this.frameMesh) {
      this.frameMesh.material = this.frameMaterial;
    }
    if (this.rimMesh) {
      this.rimMesh.material = this.rimMaterial;
    }
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const isLight = (x + y) % 2 !== 0;
        const sq = this.squareMeshes[x]?.[y];
        if (sq) {
          sq.material = isLight ? this.lightSquareMaterial : this.darkSquareMaterial;
        }
      }
    }
  }

  private coordToWorld(x: number, y: number): THREE.Vector3 {
    // Board is centered at (0,0,0). Each square is 1 unit.
    // x: 0..7 => -3.5 .. 3.5
    // y: 0..7 => 3.5 .. -3.5 (rank 1 is White side => +Z, rank 8 is Black side => -Z)
    return new THREE.Vector3(x - 3.5, 0, 3.5 - y);
  }

  private worldToCoord(pos: THREE.Vector3): BoardCoord | null {
    const x = Math.round(pos.x + 3.5);
    const y = Math.round(3.5 - pos.z);
    if (x >= 0 && x < 8 && y >= 0 && y < 8) {
      return { x, y };
    }
    return null;
  }

  private buildBoard3D() {
    this.boardGroup.clear();
    this.squareMeshes = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null));

    // Outer frame
    const frameGeo = new THREE.BoxGeometry(9.2, 0.4, 9.2);
    this.frameMesh = new THREE.Mesh(frameGeo, this.frameMaterial);
    this.frameMesh.position.y = -0.22;
    this.frameMesh.receiveShadow = true;
    this.boardGroup.add(this.frameMesh);

    // Bevel rim
    const rimGeo = new THREE.BoxGeometry(8.2, 0.05, 8.2);
    this.rimMesh = new THREE.Mesh(rimGeo, this.rimMaterial);
    this.rimMesh.position.y = -0.01;
    this.boardGroup.add(this.rimMesh);

    // 64 Individual Squares
    const squareGeo = new THREE.BoxGeometry(0.98, 0.15, 0.98);

    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const isLight = (x + y) % 2 !== 0; // standard chess rank/file parity
        const mat = isLight ? this.lightSquareMaterial : this.darkSquareMaterial;
        const square = new THREE.Mesh(squareGeo, mat);
        const worldPos = this.coordToWorld(x, y);
        square.position.set(worldPos.x, 0, worldPos.z);
        square.receiveShadow = true;
        square.userData = { boardX: x, boardY: y };
        this.boardGroup.add(square);
        this.squareMeshes[x][y] = square;
      }
    }
  }

  /* ========================================================================
     PROCEDURAL 3D PIECES GENERATION
     ======================================================================== */
  private createPiece3D(type: PieceType, color: PieceColor): THREE.Group {
    const group = new THREE.Group();
    const mat = color === 'w' ? this.whitePieceMaterial : this.blackPieceMaterial;

    const glbGeo = this.loadedPieceGeometries.get(type);
    if (glbGeo) {
      const mesh = new THREE.Mesh(glbGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Proportional scale to fit comfortably on 1.0 unit squares
      const scale = 0.44;
      mesh.scale.set(scale, scale, scale);

      // Orientation: White pieces face opponent (-Z), Black pieces face opponent (+Z)
      if (color === 'w') {
        mesh.rotation.y = Math.PI;
      } else {
        mesh.rotation.y = 0;
      }

      group.add(mesh);
      return group;
    }

    const baseGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.12, 24);
    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = 0.06;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    switch (type) {
      case 'p': {
        // Pawn: Base, collar, head sphere
        const stemGeo = new THREE.CylinderGeometry(0.14, 0.24, 0.45, 18);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.32;
        stem.castShadow = true;
        group.add(stem);

        const collarGeo = new THREE.TorusGeometry(0.18, 0.04, 12, 24);
        collarGeo.rotateX(Math.PI / 2);
        const collar = new THREE.Mesh(collarGeo, mat);
        collar.position.y = 0.55;
        group.add(collar);

        const headGeo = new THREE.SphereGeometry(0.18, 20, 20);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.y = 0.72;
        head.castShadow = true;
        group.add(head);
        break;
      }

      case 'r': {
        // Rook: Castle wall pillar + notched crenellated crown
        const stemGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.65, 20);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.44;
        stem.castShadow = true;
        group.add(stem);

        const topGeo = new THREE.CylinderGeometry(0.3, 0.26, 0.25, 20);
        const top = new THREE.Mesh(topGeo, mat);
        top.position.y = 0.85;
        top.castShadow = true;
        group.add(top);

        const crenelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
        const inner = new THREE.Mesh(
          crenelGeo,
          color === 'w' ? this.darkSquareMaterial : this.lightSquareMaterial
        );
        inner.position.y = 0.96;
        group.add(inner);
        break;
      }

      case 'n': {
        // Knight: Horse profile
        const stemGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.35, 18);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.28;
        stem.castShadow = true;
        group.add(stem);

        const headGeo = new THREE.BoxGeometry(0.28, 0.46, 0.38);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.62, color === 'w' ? 0.06 : -0.06);
        head.rotation.x = color === 'w' ? 0.15 : -0.15;
        head.castShadow = true;
        group.add(head);

        const snoutGeo = new THREE.BoxGeometry(0.2, 0.22, 0.28);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.54, color === 'w' ? 0.26 : -0.26);
        snout.castShadow = true;
        group.add(snout);

        const earGeo = new THREE.ConeGeometry(0.06, 0.16, 8);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.09, 0.9, color === 'w' ? -0.04 : 0.04);
        group.add(leftEar);
        const rightEar = leftEar.clone();
        rightEar.position.x = 0.09;
        group.add(rightEar);
        break;
      }

      case 'b': {
        // Bishop: Slender stem, oval mitre top with finial ball
        const stemGeo = new THREE.CylinderGeometry(0.15, 0.26, 0.65, 20);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.44;
        stem.castShadow = true;
        group.add(stem);

        const mitreGeo = new THREE.SphereGeometry(0.22, 20, 20);
        mitreGeo.scale(1, 1.45, 1);
        const mitre = new THREE.Mesh(mitreGeo, mat);
        mitre.position.y = 0.92;
        mitre.castShadow = true;
        group.add(mitre);

        const tipGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const tip = new THREE.Mesh(tipGeo, mat);
        tip.position.y = 1.25;
        group.add(tip);
        break;
      }

      case 'q': {
        // Queen: Flared coronet with jewel tip
        const stemGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.8, 22);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.52;
        stem.castShadow = true;
        group.add(stem);

        const crownGeo = new THREE.ConeGeometry(0.34, 0.35, 16);
        crownGeo.rotateX(Math.PI);
        const crown = new THREE.Mesh(crownGeo, mat);
        crown.position.y = 1.05;
        crown.castShadow = true;
        group.add(crown);

        const jewelGeo = new THREE.SphereGeometry(0.09, 16, 16);
        const jewel = new THREE.Mesh(
          jewelGeo,
          new THREE.MeshStandardMaterial({
            color: color === 'w' ? 0x00f2fe : 0xff007f,
            emissive: color === 'w' ? 0x00f2fe : 0xff007f,
            emissiveIntensity: 0.8,
            roughness: 0.1,
          })
        );
        jewel.position.y = 1.26;
        group.add(jewel);
        break;
      }

      case 'k': {
        // King: Tallest piece, regal cross finial
        const stemGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.88, 22);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.56;
        stem.castShadow = true;
        group.add(stem);

        const domeGeo = new THREE.SphereGeometry(0.28, 20, 16);
        domeGeo.scale(1, 0.8, 1);
        const dome = new THREE.Mesh(domeGeo, mat);
        dome.position.y = 1.1;
        dome.castShadow = true;
        group.add(dome);

        // Cross
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mat);
        crossV.position.y = 1.4;
        group.add(crossV);

        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), mat);
        crossH.position.y = 1.44;
        group.add(crossH);
        break;
      }
    }

    return group;
  }

  private rebuildAllPieces3D() {
    this.piecesGroup.clear();
    this.pieceObjects.clear();

    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = this.board[x][y];
        if (p) {
          const group = this.createPiece3D(p.type, p.color);
          const worldPos = this.coordToWorld(x, y);
          group.position.set(worldPos.x, 0.08, worldPos.z);
          group.userData = { boardX: x, boardY: y, piece: p };
          group.traverse((c) => {
            c.userData = { boardX: x, boardY: y, piece: p };
          });
          this.piecesGroup.add(group);
          this.pieceObjects.set(`${x},${y}`, group);
        }
      }
    }
  }

  private updateHighlights() {
    this.highlightGroup.clear();

    // Last Move marker
    if (this.lastMove) {
      const fromPos = this.coordToWorld(this.lastMove.from.x, this.lastMove.from.y);
      const toPos = this.coordToWorld(this.lastMove.to.x, this.lastMove.to.y);
      const lastGeo = new THREE.PlaneGeometry(0.96, 0.96);
      lastGeo.rotateX(-Math.PI / 2);

      const m1 = new THREE.Mesh(lastGeo, this.lastMoveMaterial);
      m1.position.set(fromPos.x, 0.08, fromPos.z);
      this.highlightGroup.add(m1);

      const m2 = new THREE.Mesh(lastGeo, this.lastMoveMaterial);
      m2.position.set(toPos.x, 0.08, toPos.z);
      this.highlightGroup.add(m2);
    }

    // Selected piece highlight
    if (this.selectedCoord) {
      const selPos = this.coordToWorld(this.selectedCoord.x, this.selectedCoord.y);
      const selRingGeo = new THREE.RingGeometry(0.28, 0.45, 32);
      selRingGeo.rotateX(-Math.PI / 2);
      const selRing = new THREE.Mesh(selRingGeo, this.selectedSquareMaterial);
      selRing.position.set(selPos.x, 0.085, selPos.z);
      this.highlightGroup.add(selRing);
    }

    // Legal move targets
    for (const move of this.validMoves) {
      const targetPos = this.coordToWorld(move.x, move.y);
      const isCapture = this.board[move.x][move.y] !== null;

      if (isCapture) {
        // Red target ring for captures
        const ringGeo = new THREE.RingGeometry(0.32, 0.44, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff3b30,
          transparent: true,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(targetPos.x, 0.085, targetPos.z);
        this.highlightGroup.add(ring);
      } else {
        // Emerald green dot for peaceful moves
        const dotGeo = new THREE.CircleGeometry(0.16, 24);
        dotGeo.rotateX(-Math.PI / 2);
        const dotMat = new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.8,
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(targetPos.x, 0.085, targetPos.z);
        this.highlightGroup.add(dot);
      }
    }
  }

  private clearHighlights() {
    this.highlightGroup.clear();
  }

  /* ========================================================================
     MOUSE INTERACTION & CLICK HANDLER
     ======================================================================== */
  onCanvasClick(event: MouseEvent) {
    if (this.isThinking || this.isGameOver || this.turn !== this.playerColor) {
      return;
    }

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 1. Raycast direct 3D piece clicks first
    const pieceIntersects = this.raycaster.intersectObjects(
      this.piecesGroup.children,
      true
    );
    if (pieceIntersects.length > 0) {
      for (const hit of pieceIntersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== this.piecesGroup) {
          if (obj.userData && obj.userData['boardX'] !== undefined) {
            this.handleSquareClick(obj.userData['boardX'], obj.userData['boardY']);
            return;
          }
          obj = obj.parent;
        }
      }
    }

    // 2. Intersect board squares
    const squareIntersects = this.raycaster.intersectObjects(
      this.boardGroup.children,
      true
    );

    if (squareIntersects.length > 0) {
      for (const hit of squareIntersects) {
        if (hit.object.userData && hit.object.userData['boardX'] !== undefined) {
          const x = hit.object.userData['boardX'];
          const y = hit.object.userData['boardY'];
          this.handleSquareClick(x, y);
          return;
        }
      }
    }
  }

  private handleSquareClick(x: number, y: number) {
    const clickedPiece = this.board[x][y];

    // If already selected a piece, check if the clicked square is a valid target move
    if (this.selectedCoord) {
      const isTarget = this.validMoves.some((m) => m.x === x && m.y === y);
      if (isTarget) {
        this.executeMove({
          from: this.selectedCoord,
          to: { x, y },
          piece: this.board[this.selectedCoord.x][this.selectedCoord.y]!,
        });
        this.selectedCoord = null;
        this.validMoves = [];
        this.updateHighlights();
        return;
      }
    }

    // Otherwise, select piece if it matches the current player's color
    if (clickedPiece && clickedPiece.color === this.turn) {
      this.selectedCoord = { x, y };
      this.validMoves = this.getLegalMoves({ x, y });
      this.updateHighlights();
    } else {
      this.selectedCoord = null;
      this.validMoves = [];
      this.updateHighlights();
    }
    this.cdr.detectChanges();
  }

  /* ========================================================================
     MOVE EXECUTION & 3D PIECE ANIMATION
     ======================================================================== */
  private executeMove(move: Move, isAIMove = false) {
    const { from, to, piece } = move;
    const captured = this.board[to.x][to.y];

    // Update board data
    this.board[to.x][to.y] = { ...piece, hasMoved: true };
    this.board[from.x][from.y] = null;

    // Promotion (Pawn reaches opposite rank)
    if (piece.type === 'p' && (to.y === 7 || to.y === 0)) {
      this.board[to.x][to.y]!.type = 'q'; // auto-queen promotion
    }

    // Record captured pieces
    if (captured) {
      if (captured.color === 'b') {
        this.capturedByWhite.push(captured);
      } else {
        this.capturedByBlack.push(captured);
      }
    }

    // Generate SAN notation (e.g. e4, Nf3, Bxe5)
    const san = this.formatMoveSAN(move, captured);
    if (piece.color === 'w') {
      this.moveHistory.push({ white: san });
    } else {
      if (this.moveHistory.length > 0 && !this.moveHistory[this.moveHistory.length - 1].black) {
        this.moveHistory[this.moveHistory.length - 1].black = san;
      } else {
        this.moveHistory.push({ white: '...', black: san });
      }
    }

    this.lastMove = { from, to };

    // Animate 3D Piece Translation
    this.animatePieceMove(from, to, () => {
      // Switch Turn
      this.turn = this.turn === 'w' ? 'b' : 'w';
      this.isCheck = this.isInCheck(this.turn);

      const hasMoves = this.hasAnyLegalMoves(this.turn);
      if (!hasMoves) {
        this.isGameOver = true;
        if (this.isCheck) {
          const winner = this.turn === 'w' ? 'Black' : 'White';
          this.gameStatusText = `Checkmate! ${winner} wins! 🏆`;
        } else {
          this.gameStatusText = 'Draw by Stalemate! 🤝';
        }
      } else {
        const turnName = this.turn === 'w' ? 'White' : 'Black';
        this.gameStatusText = `${turnName} to move${this.isCheck ? ' (Check!)' : ''}`;

        // Trigger AI if it's the AI's turn
        if (this.turn !== this.playerColor && !this.isGameOver) {
          this.triggerAIMove();
        }
      }

      this.updateHighlights();
      this.cdr.detectChanges();
    });
  }

  private animatePieceMove(from: BoardCoord, to: BoardCoord, onComplete: () => void) {
    const fromKey = `${from.x},${from.y}`;
    const toKey = `${to.x},${to.y}`;
    const mesh = this.pieceObjects.get(fromKey);

    if (!mesh) {
      this.rebuildAllPieces3D();
      onComplete();
      return;
    }

    // Remove captured mesh from 3D scene if present
    const capturedMesh = this.pieceObjects.get(toKey);
    if (capturedMesh) {
      this.piecesGroup.remove(capturedMesh);
      this.pieceObjects.delete(toKey);
    }

    this.pieceObjects.delete(fromKey);
    this.pieceObjects.set(toKey, mesh);
    mesh.userData['boardX'] = to.x;
    mesh.userData['boardY'] = to.y;

    const startPos = this.coordToWorld(from.x, from.y);
    const endPos = this.coordToWorld(to.x, to.y);

    const startTime = performance.now();
    const duration = 280; // ms

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth ease-out quad
      const ease = 1 - Math.pow(1 - progress, 2);

      mesh.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
      mesh.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
      // Small vertical leap arc while moving
      mesh.position.y = 0.07 + Math.sin(progress * Math.PI) * 0.45;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        mesh.position.set(endPos.x, 0.07, endPos.z);
        // If pawn promoted, replace 3D mesh
        const piece = this.board[to.x][to.y];
        if (piece && piece.type === 'q' && (to.y === 7 || to.y === 0)) {
          this.piecesGroup.remove(mesh);
          const queenMesh = this.createPiece3D('q', piece.color);
          queenMesh.position.set(endPos.x, 0.07, endPos.z);
          queenMesh.userData = { boardX: to.x, boardY: to.y, piece };
          this.piecesGroup.add(queenMesh);
          this.pieceObjects.set(toKey, queenMesh);
        }
        onComplete();
      }
    };

    requestAnimationFrame(step);
  }

  /* ========================================================================
     CHESS RULES & MOVE GENERATION ENGINE
     ======================================================================== */
  private getLegalMoves(coord: BoardCoord): BoardCoord[] {
    const rawMoves = this.getPseudoLegalMoves(coord, this.board);
    // Filter out moves that leave the King in check
    return rawMoves.filter((m) => {
      const simulatedBoard = this.cloneBoard(this.board);
      const piece = simulatedBoard[coord.x][coord.y]!;
      simulatedBoard[m.x][m.y] = { ...piece };
      simulatedBoard[coord.x][coord.y] = null;
      return !this.isBoardInCheck(simulatedBoard, piece.color);
    });
  }

  private getPseudoLegalMoves(coord: BoardCoord, b: (ChessPiece | null)[][]): BoardCoord[] {
    const piece = b[coord.x][coord.y];
    if (!piece) return [];
    const moves: BoardCoord[] = [];
    const color = piece.color;
    const opponent = color === 'w' ? 'b' : 'w';

    const addMove = (x: number, y: number): boolean => {
      if (x < 0 || x > 7 || y < 0 || y > 7) return false;
      const target = b[x][y];
      if (!target) {
        moves.push({ x, y });
        return true; // continue sliding
      }
      if (target.color === opponent) {
        moves.push({ x, y });
      }
      return false; // hit obstacle, stop sliding
    };

    switch (piece.type) {
      case 'p': {
        const dir = color === 'w' ? 1 : -1;
        const startRank = color === 'w' ? 1 : 6;

        // 1 square forward
        if (b[coord.x][coord.y + dir] === null) {
          moves.push({ x: coord.x, y: coord.y + dir });
          // 2 squares from start rank
          if (coord.y === startRank && b[coord.x][coord.y + 2 * dir] === null) {
            moves.push({ x: coord.x, y: coord.y + 2 * dir });
          }
        }

        // Diagonal captures
        for (const dx of [-1, 1]) {
          const cx = coord.x + dx;
          const cy = coord.y + dir;
          if (cx >= 0 && cx < 8 && cy >= 0 && cy < 8) {
            if (b[cx][cy] && b[cx][cy]!.color === opponent) {
              moves.push({ x: cx, y: cy });
            }
          }
        }
        break;
      }

      case 'n': {
        const jumps = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2],  [1, 2],  [2, -1],  [2, 1],
        ];
        for (const [dx, dy] of jumps) {
          addMove(coord.x + dx, coord.y + dy);
        }
        break;
      }

      case 'b': {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dx, dy] of dirs) {
          let cx = coord.x + dx;
          let cy = coord.y + dy;
          while (addMove(cx, cy)) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }

      case 'r': {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of dirs) {
          let cx = coord.x + dx;
          let cy = coord.y + dy;
          while (addMove(cx, cy)) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }

      case 'q': {
        const dirs = [
          [-1, -1], [-1, 1], [1, -1], [1, 1],
          [-1, 0],  [1, 0],  [0, -1], [0, 1],
        ];
        for (const [dx, dy] of dirs) {
          let cx = coord.x + dx;
          let cy = coord.y + dy;
          while (addMove(cx, cy)) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }

      case 'k': {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx !== 0 || dy !== 0) {
              addMove(coord.x + dx, coord.y + dy);
            }
          }
        }
        break;
      }
    }

    return moves;
  }

  private isBoardInCheck(b: (ChessPiece | null)[][], kingColor: PieceColor): boolean {
    // Find king position
    let kx = -1, ky = -1;
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = b[x][y];
        if (p && p.type === 'k' && p.color === kingColor) {
          kx = x;
          ky = y;
          break;
        }
      }
      if (kx !== -1) break;
    }
    if (kx === -1) return true; // king captured

    // Check if any opponent piece can attack (kx, ky)
    const opponent = kingColor === 'w' ? 'b' : 'w';
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = b[x][y];
        if (p && p.color === opponent) {
          const attacks = this.getPseudoLegalMoves({ x, y }, b);
          if (attacks.some((m) => m.x === kx && m.y === ky)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private isInCheck(color: PieceColor): boolean {
    return this.isBoardInCheck(this.board, color);
  }

  private hasAnyLegalMoves(color: PieceColor): boolean {
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = this.board[x][y];
        if (p && p.color === color) {
          if (this.getLegalMoves({ x, y }).length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private getAllLegalMovesForColor(color: PieceColor): Move[] {
    const allMoves: Move[] = [];
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = this.board[x][y];
        if (p && p.color === color) {
          const targets = this.getLegalMoves({ x, y });
          for (const to of targets) {
            allMoves.push({
              from: { x, y },
              to,
              piece: p,
              captured: this.board[to.x][to.y],
            });
          }
        }
      }
    }
    return allMoves;
  }

  private cloneBoard(b: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
    return b.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  private formatMoveSAN(move: Move, captured: ChessPiece | null): string {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const pType = move.piece.type.toUpperCase();
    const dest = `${files[move.to.x]}${move.to.y + 1}`;

    if (move.piece.type === 'p') {
      if (captured) {
        return `${files[move.from.x]}x${dest}`;
      }
      return dest;
    }
    const capStr = captured ? 'x' : '';
    return `${pType}${capStr}${dest}`;
  }

  private replayMovesUpTo(count: number) {
    this.initBoardState();
    this.turn = 'w';
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.isGameOver = false;

    // Collect all played SANs
    const allSans: string[] = [];
    for (const r of this.moveHistory) {
      if (r.white && r.white !== '...') allSans.push(r.white);
      if (r.black) allSans.push(r.black);
    }

    const trimmedSans = allSans.slice(0, count);
    this.moveHistory = [];

    // Replay
    for (let i = 0; i < trimmedSans.length; i++) {
      const colorToPlay: PieceColor = i % 2 === 0 ? 'w' : 'b';
      const moves = this.getAllLegalMovesForColor(colorToPlay);
      // match SAN or fallback
      const m = moves.find((cand) => this.formatMoveSAN(cand, cand.captured || null) === trimmedSans[i]);
      if (m) {
        this.board[m.to.x][m.to.y] = { ...m.piece, hasMoved: true };
        this.board[m.from.x][m.from.y] = null;
        if (m.captured) {
          if (m.captured.color === 'b') this.capturedByWhite.push(m.captured);
          else this.capturedByBlack.push(m.captured);
        }
        if (colorToPlay === 'w') {
          this.moveHistory.push({ white: trimmedSans[i] });
        } else {
          this.moveHistory[this.moveHistory.length - 1].black = trimmedSans[i];
        }
      }
    }

    this.turn = count % 2 === 0 ? 'w' : 'b';
    this.isCheck = this.isInCheck(this.turn);
    this.gameStatusText = `${this.turn === 'w' ? 'White' : 'Black'} to move`;
    this.rebuildAllPieces3D();
    this.clearHighlights();
  }

  /* ========================================================================
     AI ENGINE: MINIMAX WITH ALPHA-BETA PRUNING & HEURISTICS
     ======================================================================== */
  private triggerAIMove() {
    this.isThinking = true;
    this.gameStatusText = 'AI is calculating move... 🧠';
    this.cdr.detectChanges();

    // Async delay to let UI render and simulate real cognitive computation
    setTimeout(() => {
      const bestMove = this.calculateBestAIMove();
      this.isThinking = false;

      if (bestMove) {
        this.executeMove(bestMove, true);
      } else {
        this.isGameOver = true;
        this.gameStatusText = 'Game Over';
      }
      this.cdr.detectChanges();
    }, 450);
  }

  private calculateBestAIMove(): Move | null {
    const aiColor = this.turn;
    const moves = this.getAllLegalMovesForColor(aiColor);
    if (moves.length === 0) return null;

    // Easy / Casual difficulty: 70% evaluation, 30% random
    if (this.aiDifficulty === 'easy') {
      if (Math.random() < 0.35) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      return this.findGreedyBestMove(moves, aiColor);
    }

    // Medium: Minimax depth 2 with piece-square tables
    if (this.aiDifficulty === 'medium') {
      let bestMove = moves[0];
      let bestVal = -Infinity;

      for (const m of moves) {
        const boardCopy = this.cloneBoard(this.board);
        boardCopy[m.to.x][m.to.y] = { ...m.piece, hasMoved: true };
        boardCopy[m.from.x][m.from.y] = null;

        const score = -this.minimax(boardCopy, 2, -Infinity, Infinity, aiColor === 'w' ? 'b' : 'w');
        if (score > bestVal) {
          bestVal = score;
          bestMove = m;
        }
      }
      return bestMove;
    }

    // Hard / Master: Minimax depth 3 with move ordering (captures first) & PST
    let bestMove = moves[0];
    let bestVal = -Infinity;

    // Sort moves: high-value captures first for better alpha-beta pruning cutoffs
    moves.sort((a, b) => {
      const valA = a.captured ? PIECE_VALUES[a.captured.type] : 0;
      const valB = b.captured ? PIECE_VALUES[b.captured.type] : 0;
      return valB - valA;
    });

    for (const m of moves) {
      const boardCopy = this.cloneBoard(this.board);
      boardCopy[m.to.x][m.to.y] = { ...m.piece, hasMoved: true };
      boardCopy[m.from.x][m.from.y] = null;

      const score = -this.minimax(boardCopy, 3, -Infinity, Infinity, aiColor === 'w' ? 'b' : 'w');
      if (score > bestVal) {
        bestVal = score;
        bestMove = m;
      }
    }
    return bestMove;
  }

  private findGreedyBestMove(moves: Move[], color: PieceColor): Move {
    let bestMove = moves[0];
    let bestVal = -Infinity;
    for (const m of moves) {
      const boardCopy = this.cloneBoard(this.board);
      boardCopy[m.to.x][m.to.y] = { ...m.piece, hasMoved: true };
      boardCopy[m.from.x][m.from.y] = null;
      const score = this.evaluateBoard(boardCopy, color);
      if (score > bestVal) {
        bestVal = score;
        bestMove = m;
      }
    }
    return bestMove;
  }

  private minimax(
    b: (ChessPiece | null)[][],
    depth: number,
    alpha: number,
    beta: number,
    color: PieceColor
  ): number {
    if (depth === 0) {
      return this.evaluateBoard(b, color);
    }

    const opponent = color === 'w' ? 'b' : 'w';
    const moves: Move[] = [];

    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = b[x][y];
        if (p && p.color === color) {
          const raw = this.getPseudoLegalMoves({ x, y }, b);
          for (const to of raw) {
            const nextB = this.cloneBoard(b);
            nextB[to.x][to.y] = { ...p, hasMoved: true };
            nextB[x][y] = null;
            if (!this.isBoardInCheck(nextB, color)) {
              moves.push({ from: { x, y }, to, piece: p, captured: b[to.x][to.y] });
            }
          }
        }
      }
    }

    if (moves.length === 0) {
      if (this.isBoardInCheck(b, color)) {
        return -25000 + (3 - depth) * 100; // Checkmate penalty
      }
      return 0; // Stalemate
    }

    let maxEval = -Infinity;
    for (const m of moves) {
      const nextB = this.cloneBoard(b);
      nextB[m.to.x][m.to.y] = { ...m.piece, hasMoved: true };
      nextB[m.from.x][m.from.y] = null;

      const evalScore = -this.minimax(nextB, depth - 1, -beta, -alpha, opponent);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (alpha >= beta) {
        break; // Alpha-beta cutoff
      }
    }
    return maxEval;
  }

  private evaluateBoard(b: (ChessPiece | null)[][], povColor: PieceColor): number {
    let score = 0;

    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const p = b[x][y];
        if (!p) continue;

        let pieceScore = PIECE_VALUES[p.type];
        // Positional score based on Piece-Square Tables (PST)
        // Flip y for black
        const pstIndex = p.color === 'w' ? (7 - y) * 8 + x : y * 8 + x;

        switch (p.type) {
          case 'p':
            pieceScore += PAWN_PST[pstIndex] || 0;
            break;
          case 'n':
            pieceScore += KNIGHT_PST[pstIndex] || 0;
            break;
          case 'b':
            pieceScore += BISHOP_PST[pstIndex] || 0;
            break;
          case 'r':
            pieceScore += ROOK_PST[pstIndex] || 0;
            break;
          case 'q':
            pieceScore += QUEEN_PST[pstIndex] || 0;
            break;
          case 'k':
            pieceScore += KING_MID_PST[pstIndex] || 0;
            break;
        }

        if (p.color === povColor) {
          score += pieceScore;
        } else {
          score -= pieceScore;
        }
      }
    }
    return score;
  }

  /* ========================================================================
     ANIMATION LOOP & RESIZE
     ======================================================================== */
  private rebindRendererCanvas(newCanvas: HTMLCanvasElement) {
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }

    const container = this.containerRef?.nativeElement;
    const width = container?.clientWidth || window.innerWidth;
    const height = container?.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: newCanvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, newCanvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0, 0);

    (window as any).__CHESS_RENDERER__ = this.renderer;
    (window as any).__CHESS_CANVAS__ = newCanvas;
    console.log('[CHESS] Rebound renderer successfully to active DOM canvas:', { width, height });
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.canvasRef && this.renderer) {
      if (this.canvasRef.nativeElement !== this.renderer.domElement) {
        this.rebindRendererCanvas(this.canvasRef.nativeElement);
      }
    }
    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

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

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
