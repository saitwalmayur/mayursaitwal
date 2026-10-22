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

export type PlayerSymbol = 'X' | 'O';
export type GameMode = 'ai' | 'pvp';
export type AIDifficulty = 'easy' | 'hard';

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

interface PieceAnimation {
  mesh: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startTime: number;
  duration: number;
}

@Component({
  selector: 'app-tictactoe',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tictactoe.html',
  styleUrl: './tictactoe.scss',
})
export class Tictactoe implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer', { static: false })
  viewportContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rendererCanvas', { static: false })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;

  // Game State
  public board: (PlayerSymbol | null)[] = Array(9).fill(null);
  public currentTurn: PlayerSymbol = 'X';
  public winner: PlayerSymbol | 'draw' | null = null;
  public winningLine: number[] | null = null;
  public gameMode: GameMode = 'ai';
  public aiDifficulty: AIDifficulty = 'hard';
  public isAiThinking: boolean = false;
  public scores = { X: 0, O: 0, draws: 0 };
  public isSoundMuted: boolean = false;
  public hoveredTileIndex: number | null = null;

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animFrameId: number | null = null;

  // 3D Board Objects
  private tileMeshes: THREE.Mesh[] = [];
  private pieceObjects: (THREE.Group | null)[] = Array(9).fill(null);
  private ghostGroup!: THREE.Group;
  private ghostXMesh!: THREE.Group;
  private ghostOMesh!: THREE.Mesh;
  private winningBeam: THREE.Mesh | null = null;
  private activeAnimations: PieceAnimation[] = [];

  // Raycasting & Pointer Tracking
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };

  // Board dimensions
  private readonly CELL_SIZE = 2.4;
  private readonly TILE_SURFACE_Y = 0.28;

  // Synthesized Web Audio
  private audioCtx: AudioContext | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.initScene();
    this.buildBoard();
    this.createGhostPreview();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.renderer) this.renderer.dispose();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.viewportContainer || !this.camera || !this.renderer) return;
    const w = this.viewportContainer.nativeElement.clientWidth;
    const h = this.viewportContainer.nativeElement.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ==========================================
  // SCENE & BOARD SETUP
  // ==========================================

  private initScene(): void {
    const container = this.viewportContainer.nativeElement;
    const canvas = this.rendererCanvas.nativeElement;
    const w = container.clientWidth;
    const h = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d18);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 10.5, 11);

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 24;
    this.controls.target.set(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(8, 16, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    const cyanPoint = new THREE.PointLight(0x00f2fe, 1.3, 18);
    cyanPoint.position.set(-6, 4, -4);
    this.scene.add(cyanPoint);

    const rosePoint = new THREE.PointLight(0xf43f5e, 1.3, 18);
    rosePoint.position.set(6, 4, 4);
    this.scene.add(rosePoint);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x060810, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private buildBoard(): void {
    const boardGroup = new THREE.Group();

    // 1. 3D Platform Pedestal Base
    const baseGeo = new THREE.BoxGeometry(8.2, 0.35, 8.2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f1524,
      roughness: 0.3,
      metalness: 0.4,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.35 / 2;
    baseMesh.receiveShadow = true;
    boardGroup.add(baseMesh);

    // Outer Golden Border Trim
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.25,
      metalness: 0.85,
    });
    const trimBarH = 0.4;
    const trimThick = 0.2;

    const createTrim = (w: number, d: number, px: number, pz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, trimBarH, d), trimMat);
      m.position.set(px, trimBarH / 2, pz);
      boardGroup.add(m);
    };
    createTrim(8.4, trimThick, 0, 4.2);
    createTrim(8.4, trimThick, 0, -4.2);
    createTrim(trimThick, 8.4, 4.2, 0);
    createTrim(trimThick, 8.4, -4.2, 0);

    // 2. The Iconic 3D '#' Grid Lines dividing the 9 placement sections
    const gridBarMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.7,
    });
    const barLen = 7.4;
    const barW = 0.14;
    const barH = 0.22;
    const barY = 0.35 + barH / 2;

    const offset = this.CELL_SIZE / 2; // 1.2
    // 2 Vertical Grid Bars
    const v1 = new THREE.Mesh(new THREE.BoxGeometry(barW, barH, barLen), gridBarMat);
    v1.position.set(-offset, barY, 0);
    boardGroup.add(v1);

    const v2 = new THREE.Mesh(new THREE.BoxGeometry(barW, barH, barLen), gridBarMat);
    v2.position.set(offset, barY, 0);
    boardGroup.add(v2);

    // 2 Horizontal Grid Bars
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(barLen, barH, barW), gridBarMat);
    h1.position.set(0, barY, -offset);
    boardGroup.add(h1);

    const h2 = new THREE.Mesh(new THREE.BoxGeometry(barLen, barH, barW), gridBarMat);
    h2.position.set(0, barY, offset);
    boardGroup.add(h2);

    // 3. 9 Placement Section Tiles
    this.tileMeshes = [];
    const tileGeo = new THREE.BoxGeometry(2.18, 0.12, 2.18);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const index = r * 3 + c;
        const x = (c - 1) * this.CELL_SIZE;
        const z = (r - 1) * this.CELL_SIZE;

        const tileMat = new THREE.MeshStandardMaterial({
          color: 0x182238,
          roughness: 0.35,
          metalness: 0.2,
        });

        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.set(x, this.TILE_SURFACE_Y - 0.06, z);
        tile.receiveShadow = true;
        tile.userData = { index: index, origColor: 0x182238 };

        // Subtle center placement cross decal (+) on each empty tile
        const dot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12),
          new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.7 })
        );
        dot.position.y = 0.07;
        tile.add(dot);

        boardGroup.add(tile);
        this.tileMeshes.push(tile);
      }
    }

    this.scene.add(boardGroup);
  }

  // ==========================================
  // HOLOGRAPHIC GHOST PREVIEW
  // ==========================================

  private createGhostPreview(): void {
    this.ghostGroup = new THREE.Group();
    this.ghostGroup.visible = false;

    // Ghost X
    this.ghostXMesh = new THREE.Group();
    const barGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 16);
    const ghostXMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.45,
    });
    const b1 = new THREE.Mesh(barGeo, ghostXMat);
    b1.rotation.y = Math.PI / 4;
    b1.rotation.z = Math.PI / 2;
    this.ghostXMesh.add(b1);

    const b2 = new THREE.Mesh(barGeo, ghostXMat);
    b2.rotation.y = -Math.PI / 4;
    b2.rotation.z = Math.PI / 2;
    this.ghostXMesh.add(b2);
    this.ghostGroup.add(this.ghostXMesh);

    // Ghost O
    const ringGeo = new THREE.TorusGeometry(0.65, 0.13, 16, 32);
    const ghostOMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.45,
    });
    this.ghostOMesh = new THREE.Mesh(ringGeo, ghostOMat);
    this.ghostOMesh.rotation.x = Math.PI / 2;
    this.ghostGroup.add(this.ghostOMesh);

    this.scene.add(this.ghostGroup);
  }

  private updateGhostPlacement(index: number | null): void {
    if (index === null || this.board[index] !== null || this.winner || this.isAiThinking) {
      this.ghostGroup.visible = false;
      return;
    }

    const r = Math.floor(index / 3);
    const c = index % 3;
    const x = (c - 1) * this.CELL_SIZE;
    const z = (r - 1) * this.CELL_SIZE;

    this.ghostGroup.position.set(x, this.TILE_SURFACE_Y + 0.22, z);
    this.ghostGroup.visible = true;

    if (this.currentTurn === 'X') {
      this.ghostXMesh.visible = true;
      this.ghostOMesh.visible = false;
    } else {
      this.ghostXMesh.visible = false;
      this.ghostOMesh.visible = true;
    }
  }

  // ==========================================
  // 3D PIECES GENERATION
  // ==========================================

  private createPieceMesh(symbol: PlayerSymbol): THREE.Group {
    const group = new THREE.Group();

    if (symbol === 'X') {
      // 3D Crossed Neon Bars
      const barGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.7, 16);
      const barMat = new THREE.MeshStandardMaterial({
        color: 0x00f2fe,
        emissive: 0x00f2fe,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.6,
      });

      const bar1 = new THREE.Mesh(barGeo, barMat);
      bar1.rotation.y = Math.PI / 4;
      bar1.rotation.z = Math.PI / 2;
      bar1.castShadow = true;
      group.add(bar1);

      const bar2 = new THREE.Mesh(barGeo, barMat);
      bar2.rotation.y = -Math.PI / 4;
      bar2.rotation.z = Math.PI / 2;
      bar2.castShadow = true;
      group.add(bar2);
    } else {
      // 3D Neon Torus Ring
      const ringGeo = new THREE.TorusGeometry(0.68, 0.15, 20, 36);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.6,
      });

      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      group.add(ring);
    }

    return group;
  }

  // ==========================================
  // POINTER & RAYCASTING INTERACTION
  // ==========================================

  public onPointerDown(event: MouseEvent): void {
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  public onPointerUp(event: MouseEvent): void {
    if (this.winner || this.isAiThinking) return;

    // Check if it was a click (not a camera drag)
    const dist = Math.hypot(event.clientX - this.pointerDownPos.x, event.clientY - this.pointerDownPos.y);
    if (dist < 6) {
      const hitIndex = this.getTileIndexFromPointer(event);
      if (hitIndex !== null && this.board[hitIndex] === null) {
        this.makeMove(hitIndex);
      }
    }
  }

  public onCanvasPointerMove(event: MouseEvent): void {
    if (this.winner || this.isAiThinking) {
      this.clearHover();
      return;
    }

    const hitIndex = this.getTileIndexFromPointer(event);
    if (hitIndex !== null && this.board[hitIndex] === null) {
      if (this.hoveredTileIndex !== hitIndex) {
        this.setHoveredIndex(hitIndex);
      }
    } else {
      this.clearHover();
    }
  }

  private setHoveredIndex(index: number): void {
    this.clearHover();
    this.hoveredTileIndex = index;
    const mat = this.tileMeshes[index].material as THREE.MeshStandardMaterial;
    mat.color.setHex(0x28385e);
    mat.emissive.setHex(this.currentTurn === 'X' ? 0x00f2fe : 0xf43f5e);
    mat.emissiveIntensity = 0.28;
    this.updateGhostPlacement(index);
    this.cdr.detectChanges();
  }

  public clearHover(): void {
    if (this.hoveredTileIndex !== null) {
      const mat = this.tileMeshes[this.hoveredTileIndex].material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x182238);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      this.hoveredTileIndex = null;
    }
    this.updateGhostPlacement(null);
    this.cdr.detectChanges();
  }

  // 2D HUD Pad hover sync
  public onCellMouseEnter(index: number): void {
    if (this.board[index] === null && !this.winner && !this.isAiThinking) {
      this.setHoveredIndex(index);
    }
  }

  public onCellMouseLeave(): void {
    this.clearHover();
  }

  private getTileIndexFromPointer(event: MouseEvent): number | null {
    const rect = this.rendererCanvas.nativeElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tileMeshes, false);

    if (intersects.length > 0) {
      return intersects[0].object.userData['index'] as number;
    }
    return null;
  }

  // ==========================================
  // GAMEPLAY LOGIC
  // ==========================================

  public makeMove(index: number): void {
    if (this.board[index] !== null || this.winner || this.isAiThinking) return;

    this.clearHover();
    const symbol = this.currentTurn;
    this.board[index] = symbol;

    // 3D Piece spawn directly onto target tile
    const r = Math.floor(index / 3);
    const c = index % 3;
    const x = (c - 1) * this.CELL_SIZE;
    const z = (r - 1) * this.CELL_SIZE;
    const targetY = this.TILE_SURFACE_Y + 0.18;

    const piece = this.createPieceMesh(symbol);
    piece.position.set(x, targetY + 3.0, z);
    this.scene.add(piece);
    this.pieceObjects[index] = piece;

    this.activeAnimations.push({
      mesh: piece,
      startPos: new THREE.Vector3(x, targetY + 3.0, z),
      targetPos: new THREE.Vector3(x, targetY, z),
      startTime: performance.now(),
      duration: 260,
    });

    this.playTone(symbol === 'X' ? 440 : 330, 0.12);

    // Check Win
    const win = this.checkWin(this.board);
    if (win) {
      this.winner = symbol;
      this.winningLine = win;
      this.scores[symbol]++;
      this.highlightWinningTiles(win);
      this.playWinTone();
      this.cdr.detectChanges();
      return;
    }

    // Check Draw
    if (this.board.every((cell) => cell !== null)) {
      this.winner = 'draw';
      this.scores.draws++;
      this.playTone(220, 0.3);
      this.cdr.detectChanges();
      return;
    }

    // Advance turn
    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
    this.cdr.detectChanges();

    // Trigger AI move if in AI mode and it's O's turn
    if (this.gameMode === 'ai' && this.currentTurn === 'O') {
      this.isAiThinking = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        const aiMove = this.getBestMove();
        this.isAiThinking = false;
        this.makeMove(aiMove);
      }, 420);
    }
  }

  // ==========================================
  // AI LOGIC (MINIMAX)
  // ==========================================

  private getBestMove(): number {
    const emptyIndices = this.board
      .map((val, idx) => (val === null ? idx : null))
      .filter((val): val is number => val !== null);

    if (this.aiDifficulty === 'easy' && Math.random() < 0.4) {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    let bestScore = -Infinity;
    let move = emptyIndices[0];

    for (const idx of emptyIndices) {
      this.board[idx] = 'O';
      const score = this.minimax(this.board, 0, false);
      this.board[idx] = null;
      if (score > bestScore) {
        bestScore = score;
        move = idx;
      }
    }

    return move;
  }

  private minimax(board: (PlayerSymbol | null)[], depth: number, isMaximizing: boolean): number {
    const win = this.checkWin(board);
    if (win) {
      return isMaximizing ? -10 + depth : 10 - depth;
    }
    if (board.every((cell) => cell !== null)) {
      return 0;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'O';
          const score = this.minimax(board, depth + 1, false);
          board[i] = null;
          maxScore = Math.max(score, maxScore);
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'X';
          const score = this.minimax(board, depth + 1, true);
          board[i] = null;
          minScore = Math.min(score, minScore);
        }
      }
      return minScore;
    }
  }

  private checkWin(board: (PlayerSymbol | null)[]): number[] | null {
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return combo;
      }
    }
    return null;
  }

  private highlightWinningTiles(line: number[]): void {
    line.forEach((idx) => {
      const tile = this.tileMeshes[idx];
      const mat = tile.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x10b981);
      mat.emissive.setHex(0x10b981);
      mat.emissiveIntensity = 0.55;
    });

    // 3D Laser Beam connecting the 3 tiles
    const p1 = this.tileMeshes[line[0]].position;
    const p3 = this.tileMeshes[line[2]].position;
    const distance = p1.distanceTo(p3);

    const beamGeo = new THREE.CylinderGeometry(0.09, 0.09, distance + 1.2, 16);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.winningBeam = new THREE.Mesh(beamGeo, beamMat);

    this.winningBeam.position.set((p1.x + p3.x) / 2, this.TILE_SURFACE_Y + 0.45, (p1.z + p3.z) / 2);

    const direction = new THREE.Vector3().subVectors(p3, p1).normalize();
    const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const angle = Math.acos(new THREE.Vector3(0, 1, 0).dot(direction));
    this.winningBeam.setRotationFromAxisAngle(axis, angle);

    this.scene.add(this.winningBeam);
  }

  // ==========================================
  // CONTROLS & RESTART
  // ==========================================

  public resetGame(): void {
    this.clearHover();
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.winner = null;
    this.winningLine = null;
    this.isAiThinking = false;

    // Remove 3D pieces
    this.pieceObjects.forEach((p) => {
      if (p) this.scene.remove(p);
    });
    this.pieceObjects = Array(9).fill(null);

    // Remove winning beam
    if (this.winningBeam) {
      this.scene.remove(this.winningBeam);
      this.winningBeam = null;
    }

    // Reset tile colors
    this.tileMeshes.forEach((tile) => {
      const mat = tile.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x182238);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    });

    this.cdr.detectChanges();
  }

  public setGameMode(mode: GameMode): void {
    this.gameMode = mode;
    this.resetGame();
  }

  public toggleMute(): void {
    this.isSoundMuted = !this.isSoundMuted;
  }

  public resetCamera(): void {
    this.camera.position.set(0, 10.5, 11);
    this.controls.target.set(0, 0, 0);
  }

  // ==========================================
  // ANIMATION LOOP
  // ==========================================

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const now = performance.now();

    // Piece drop bounce animation
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      const progress = Math.min((now - anim.startTime) / anim.duration, 1);
      const ease = Math.sin((progress * Math.PI) / 2);

      anim.mesh.position.y = THREE.MathUtils.lerp(anim.startPos.y, anim.targetPos.y, ease);
      anim.mesh.rotation.y = (1 - ease) * Math.PI * 1.5;

      if (progress >= 1) {
        anim.mesh.position.copy(anim.targetPos);
        anim.mesh.rotation.y = 0;
        this.activeAnimations.splice(i, 1);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ==========================================
  // WEB AUDIO
  // ==========================================

  private getAudio(): AudioContext | null {
    if (this.isSoundMuted || typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private playTone(freq: number, duration: number): void {
    const ctx = this.getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playWinTone(): void {
    const ctx = this.getAudio();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.22), idx * 80);
    });
  }
}
