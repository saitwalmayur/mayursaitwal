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

import '@babylonjs/loaders/glTF';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  Color3,
  Color4,
  SceneLoader,
  ShadowGenerator,
  GlowLayer,
  AbstractMesh,
  Mesh,
  Animation,
  PointerEventTypes,
  Camera,
  ImageProcessingConfiguration,
} from '@babylonjs/core';

export type LightingMood = 'day' | 'sunset' | 'night';
export type ViewPreset = 'iso' | 'sofa' | 'coffee' | 'window' | 'plant';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class Room implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly loading = signal(true);
  readonly lampOn = signal(true);
  readonly mood = signal<LightingMood>('day');
  readonly isOrtho = signal(true);
  readonly autoRotate = signal(false);
  readonly currentPreset = signal<ViewPreset>('iso');
  readonly lastInteracted = signal<string | null>(null);

  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;
  private hemiLight: HemisphericLight | null = null;
  private dirLight: DirectionalLight | null = null;
  private lampLight: PointLight | null = null;
  private shadowGenerator: ShadowGenerator | null = null;
  private glowLayer: GlowLayer | null = null;
  private lampBulbMesh: AbstractMesh | null = null;
  private clockHandMesh: AbstractMesh | null = null;

  // Exact room center based on GLB bounds
  private readonly defaultTarget = new Vector3(1.28, 1.02, -1.50);
  private readonly defaultAlpha = -Math.PI / 4; // -45 deg, looking straight into corner
  private readonly defaultBeta = 1.01; // ~57.8 deg elevation (isometric reference angle)
  private readonly defaultRadius = 9.0;
  private orthoZoom = 2.45;
  private toastTimer: any = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initBabylonScene();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
    }
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.engine) {
      this.engine.resize();
      this.updateOrthoBounds();
    }
  }

  private async initBabylonScene(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.scene = new Scene(this.engine);
    // Soft sage background matching the reference image perimeter
    this.scene.clearColor = new Color4(0.65, 0.77, 0.60, 1.0);

    // Setup Tonemapping & Contrast for crisp pastel render
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = 1.05;
    this.scene.imageProcessingConfiguration.contrast = 1.08;

    this.setupCamera(canvas);
    this.setupLighting();
    this.setupInteractivity();

    // Start render loop
    this.engine.runRenderLoop(() => {
      if (this.autoRotate() && this.camera) {
        this.camera.alpha += 0.004;
      }
      this.scene?.render();
    });

    await this.loadRoomModel();
  }

  private setupCamera(canvas: HTMLCanvasElement): void {
    if (!this.scene) return;

    this.camera = new ArcRotateCamera(
      'isoCamera',
      this.defaultAlpha,
      this.defaultBeta,
      this.defaultRadius,
      this.defaultTarget.clone(),
      this.scene
    );

    this.camera.attachControl(canvas, true);
    this.camera.wheelPrecision = 45;
    this.camera.pinchPrecision = 40;
    this.camera.panningSensibility = 1000;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = Math.PI / 2 - 0.05;
    this.camera.lowerRadiusLimit = 3.5;
    this.camera.upperRadiusLimit = 22.0;

    // Default to Orthographic mode to match reference screenshot perfectly
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.updateOrthoBounds();

    // Handle smooth wheel zooming in Orthographic mode
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.isOrtho() || !this.camera) return;
        e.preventDefault();
        const delta = e.deltaY * 0.002;
        this.orthoZoom = Math.min(Math.max(this.orthoZoom + delta, 1.2), 4.8);
        this.updateOrthoBounds();
      },
      { passive: false }
    );
  }

  private updateOrthoBounds(): void {
    if (!this.camera || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const aspect = canvas.clientWidth / (canvas.clientHeight || 1);

    if (aspect >= 1) {
      this.camera.orthoTop = this.orthoZoom;
      this.camera.orthoBottom = -this.orthoZoom;
      this.camera.orthoLeft = -this.orthoZoom * aspect;
      this.camera.orthoRight = this.orthoZoom * aspect;
    } else {
      this.camera.orthoLeft = -this.orthoZoom;
      this.camera.orthoRight = this.orthoZoom;
      this.camera.orthoTop = this.orthoZoom / aspect;
      this.camera.orthoBottom = -this.orthoZoom / aspect;
    }
  }

  private setupLighting(): void {
    if (!this.scene) return;

    // Hemispheric Ambient Light
    this.hemiLight = new HemisphericLight(
      'hemiLight',
      new Vector3(0, 1, 0),
      this.scene
    );
    this.hemiLight.intensity = 0.95;
    this.hemiLight.diffuse = new Color3(1.0, 0.98, 0.94);
    this.hemiLight.groundColor = new Color3(0.68, 0.79, 0.62);

    // Directional Sunlight (matching the soft shadow angles from the reference)
    const dir = new Vector3(-0.85, -1.35, 0.65).normalize();
    this.dirLight = new DirectionalLight('dirLight', dir, this.scene);
    this.dirLight.position = new Vector3(8, 14, -8);
    this.dirLight.intensity = 1.3;
    this.dirLight.diffuse = new Color3(1.0, 0.97, 0.92);

    // Shadow Generator for buttery smooth pastel shadows
    this.shadowGenerator = new ShadowGenerator(2048, this.dirLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
    this.shadowGenerator.blurBoxOffset = 2;
    this.shadowGenerator.darkness = 0.28; // Soft, gentle shadow tone

    // Warm Point Light at the Wall Lamp Bulb
    this.lampLight = new PointLight(
      'lampLight',
      new Vector3(0.35, 2.05, -1.65),
      this.scene
    );
    this.lampLight.diffuse = new Color3(1.0, 0.92, 0.78);
    this.lampLight.intensity = 0.75;
    this.lampLight.range = 4.0;

    // Glow Layer for the lamp bulb
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 0.45;
  }

  private async loadRoomModel(): Promise<void> {
    if (!this.scene) return;

    try {
      // First try loading rom2.glb from public/room/
      let result;
      try {
        result = await SceneLoader.ImportMeshAsync(
          '',
          '/room/',
          'room2.glb',
          this.scene
        );
      } catch (err) {
        console.warn('Could not load room2.glb, falling back to room1.glb', err);
        result = await SceneLoader.ImportMeshAsync(
          '',
          '/room/',
          'room1.glb',
          this.scene
        );
      }

      this.processMeshes(result.meshes);
      this.loading.set(false);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading room model:', error);
      this.loading.set(false);
      this.showToast('Failed to load room model');
      this.cdr.detectChanges();
    }
  }

  private processMeshes(meshes: AbstractMesh[]): void {
    if (!this.shadowGenerator) return;

    for (const mesh of meshes) {
      const name = mesh.name;

      // Floors and walls receive shadows
      if (name.includes('Floor') || name.includes('Wall')) {
        mesh.receiveShadows = true;
      } else if (
        name !== '__root__' &&
        !name.includes('Pane') // Window glass
      ) {
        // Furniture, props, and decor cast and receive shadows
        mesh.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(mesh, true);
      }

      // Check for wall lamp bulb
      if (name === 'Lamp_Bulb' || name.includes('Bulb')) {
        this.lampBulbMesh = mesh;
        if (mesh.material) {
          (mesh.material as any).emissiveColor = new Color3(1.0, 0.92, 0.75);
        }
      }

      // Check for clock hands
      if (name === 'Hand_M' || name.includes('Hand')) {
        this.clockHandMesh = mesh;
      }
    }
  }

  private setupInteractivity(): void {
    if (!this.scene) return;

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pickResult = pointerInfo.pickInfo;
        if (pickResult && pickResult.hit && pickResult.pickedMesh) {
          this.handleMeshClick(pickResult.pickedMesh);
        }
      }
    });
  }

  private handleMeshClick(mesh: AbstractMesh): void {
    const name = mesh.name;

    if (name.includes('Lamp')) {
      this.toggleLamp();
      this.showToast(this.lampOn() ? 'Wall Lamp ON 💡' : 'Wall Lamp OFF 🌑');
      return;
    }

    if (name.includes('Armchair') || name.includes('Loveseat')) {
      this.animateSquish(mesh);
      this.showToast('Cozy Velvet Sofa Cushion 🛋️');
      return;
    }

    if (name.includes('Donut') || name.includes('Sprinkle')) {
      this.animateHop(mesh);
      this.showToast('Strawberry Sprinkled Donut 🍩');
      return;
    }

    if (name.includes('Saucer') || name.includes('Coffee')) {
      this.animateHop(mesh);
      this.showToast('Hot Fresh Brewed Coffee ☕');
      return;
    }

    if (name.includes('Plant') || name.includes('Pot') || name.includes('Soil')) {
      this.animateSway(mesh);
      this.showToast('Potted Succulent Plant 🪴');
      return;
    }

    if (name.includes('Clock') || name.includes('Hand')) {
      this.spinClockHand();
      this.showToast('Wall Clock Ticked ⏰');
      return;
    }

    if (name.includes('Curtain') || name.includes('Win')) {
      this.animateSway(mesh);
      this.showToast('Sunlit Window & Curtains 🪟');
      return;
    }

    if (name.includes('Table') || name.includes('Stool')) {
      this.animateHop(mesh);
      this.showToast('Oak Coffee Table');
      return;
    }
  }

  /* ── Interactive Micro-Animations ── */

  private animateSquish(mesh: AbstractMesh): void {
    if (!this.scene) return;
    const origScale = mesh.scaling.clone();
    Animation.CreateAndStartAnimation(
      'squish',
      mesh,
      'scaling',
      60,
      15,
      origScale,
      new Vector3(origScale.x * 1.04, origScale.y * 0.92, origScale.z * 1.04),
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      undefined,
      () => {
        Animation.CreateAndStartAnimation(
          'squishReturn',
          mesh,
          'scaling',
          60,
          15,
          mesh.scaling.clone(),
          origScale,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
      }
    );
  }

  private animateHop(mesh: AbstractMesh): void {
    if (!this.scene) return;
    const origPos = mesh.position.clone();
    Animation.CreateAndStartAnimation(
      'hop',
      mesh,
      'position.y',
      60,
      12,
      origPos.y,
      origPos.y + 0.08,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      undefined,
      () => {
        Animation.CreateAndStartAnimation(
          'hopDown',
          mesh,
          'position.y',
          60,
          12,
          origPos.y + 0.08,
          origPos.y,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
      }
    );
  }

  private animateSway(mesh: AbstractMesh): void {
    if (!this.scene) return;
    const origRot = mesh.rotation.clone();
    Animation.CreateAndStartAnimation(
      'sway',
      mesh,
      'rotation.z',
      60,
      12,
      origRot.z,
      origRot.z + 0.08,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      undefined,
      () => {
        Animation.CreateAndStartAnimation(
          'swayBack',
          mesh,
          'rotation.z',
          60,
          14,
          origRot.z + 0.08,
          origRot.z,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
      }
    );
  }

  private spinClockHand(): void {
    if (!this.scene || !this.clockHandMesh) return;
    const currentRot = this.clockHandMesh.rotation.x;
    Animation.CreateAndStartAnimation(
      'clockSpin',
      this.clockHandMesh,
      'rotation.x',
      60,
      30,
      currentRot,
      currentRot + Math.PI * 2,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /* ── User Controls ── */

  toggleLamp(): void {
    const newState = !this.lampOn();
    this.lampOn.set(newState);

    if (this.lampLight) {
      this.lampLight.intensity = newState ? (this.mood() === 'night' ? 1.6 : 0.75) : 0;
    }
    if (this.lampBulbMesh && this.lampBulbMesh.material) {
      const mat = this.lampBulbMesh.material as any;
      mat.emissiveColor = newState
        ? new Color3(1.0, 0.92, 0.75)
        : new Color3(0.1, 0.1, 0.1);
    }
  }

  setMood(newMood: LightingMood): void {
    this.mood.set(newMood);
    if (!this.scene || !this.hemiLight || !this.dirLight) return;

    if (newMood === 'day') {
      // Soft, clean pastel daylight (Matches screenshot)
      this.scene.clearColor = new Color4(0.65, 0.77, 0.60, 1.0);
      this.hemiLight.diffuse = new Color3(1.0, 0.98, 0.94);
      this.hemiLight.groundColor = new Color3(0.68, 0.79, 0.62);
      this.hemiLight.intensity = 0.95;

      this.dirLight.direction = new Vector3(-0.85, -1.35, 0.65).normalize();
      this.dirLight.diffuse = new Color3(1.0, 0.97, 0.92);
      this.dirLight.intensity = 1.3;

      if (this.shadowGenerator) this.shadowGenerator.darkness = 0.28;
      if (this.lampLight && this.lampOn()) this.lampLight.intensity = 0.75;
      this.showToast('Daylight Mood: Soft Pastel Warmth ☀️');
    } else if (newMood === 'sunset') {
      // Warm golden hour
      this.scene.clearColor = new Color4(0.78, 0.60, 0.51, 1.0);
      this.hemiLight.diffuse = new Color3(1.0, 0.82, 0.69);
      this.hemiLight.groundColor = new Color3(0.63, 0.48, 0.41);
      this.hemiLight.intensity = 0.8;

      this.dirLight.direction = new Vector3(-1.1, -0.75, 0.65).normalize();
      this.dirLight.diffuse = new Color3(1.0, 0.65, 0.38);
      this.dirLight.intensity = 1.5;

      if (this.shadowGenerator) this.shadowGenerator.darkness = 0.38;
      if (this.lampLight && this.lampOn()) this.lampLight.intensity = 1.0;
      this.showToast('Golden Hour Sunset Mood 🌇');
    } else if (newMood === 'night') {
      // Cozy moody night
      this.scene.clearColor = new Color4(0.08, 0.11, 0.15, 1.0);
      this.hemiLight.diffuse = new Color3(0.25, 0.35, 0.45);
      this.hemiLight.groundColor = new Color3(0.08, 0.11, 0.15);
      this.hemiLight.intensity = 0.35;

      this.dirLight.direction = new Vector3(1.1, -1.0, -0.4).normalize();
      this.dirLight.diffuse = new Color3(0.55, 0.72, 0.95);
      this.dirLight.intensity = 0.45;

      if (this.shadowGenerator) this.shadowGenerator.darkness = 0.6;
      if (this.lampLight && this.lampOn()) this.lampLight.intensity = 1.7;
      this.showToast('Cozy Midnight Room Mood 🌙');
    }
  }

  toggleCameraProjection(): void {
    if (!this.camera) return;
    const willBeOrtho = !this.isOrtho();
    this.isOrtho.set(willBeOrtho);

    if (willBeOrtho) {
      this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      this.updateOrthoBounds();
      this.showToast('Switched to Isometric 2.5D Mode 📐');
    } else {
      this.camera.mode = Camera.PERSPECTIVE_CAMERA;
      this.camera.fov = 0.75;
      this.showToast('Switched to Perspective 3D Mode 👁️');
    }
  }

  toggleAutoRotate(): void {
    const next = !this.autoRotate();
    this.autoRotate.set(next);
    this.showToast(next ? 'Turntable Rotation Started 🔄' : 'Turntable Paused ⏸️');
  }

  resetCameraView(): void {
    this.focusPreset('iso');
    this.showToast('Camera Reset to Reference Isometric View 🎯');
  }

  focusPreset(preset: ViewPreset): void {
    if (!this.camera || !this.scene) return;
    this.currentPreset.set(preset);

    let targetAlpha = this.defaultAlpha;
    let targetBeta = this.defaultBeta;
    let targetRadius = this.defaultRadius;
    let targetPos = this.defaultTarget.clone();
    let targetZoom = 2.45;

    switch (preset) {
      case 'iso':
        // Exact screenshot framing
        targetAlpha = this.defaultAlpha;
        targetBeta = this.defaultBeta;
        targetRadius = this.defaultRadius;
        targetPos = this.defaultTarget.clone();
        targetZoom = 2.45;
        break;
      case 'sofa':
        // Loveseat & Pillows focus
        targetAlpha = -0.55;
        targetBeta = 1.15;
        targetRadius = 5.5;
        targetPos = new Vector3(0.65, 0.65, -2.05);
        targetZoom = 1.6;
        break;
      case 'coffee':
        // Donut & Coffee table close-up
        targetAlpha = -0.78;
        targetBeta = 1.1;
        targetRadius = 4.2;
        targetPos = new Vector3(1.85, 0.45, -1.85);
        targetZoom = 1.4;
        break;
      case 'window':
        // Window & Armchair view
        targetAlpha = -1.15;
        targetBeta = 1.18;
        targetRadius = 5.2;
        targetPos = new Vector3(2.35, 1.1, -0.65);
        targetZoom = 1.65;
        break;
      case 'plant':
        // Stool & potted plant focus
        targetAlpha = -0.78;
        targetBeta = 1.05;
        targetRadius = 4.8;
        targetPos = new Vector3(0.8, 0.8, -0.8);
        targetZoom = 1.5;
        break;
    }

    // Animate camera smoothly
    Animation.CreateAndStartAnimation(
      'camAlpha',
      this.camera,
      'alpha',
      60,
      30,
      this.camera.alpha,
      targetAlpha,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    Animation.CreateAndStartAnimation(
      'camBeta',
      this.camera,
      'beta',
      60,
      30,
      this.camera.beta,
      targetBeta,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    Animation.CreateAndStartAnimation(
      'camTarget',
      this.camera,
      'target',
      60,
      30,
      this.camera.target,
      targetPos,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    Animation.CreateAndStartAnimation(
      'camRadius',
      this.camera,
      'radius',
      60,
      30,
      this.camera.radius,
      targetRadius,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    this.orthoZoom = targetZoom;
    this.updateOrthoBounds();
  }

  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.lastInteracted.set(message);
    this.toastTimer = setTimeout(() => {
      this.lastInteracted.set(null);
      this.cdr.detectChanges();
    }, 2800);
  }
}
