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
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

@Component({
  selector: 'app-threedmodelviewer',
  imports: [CommonModule, RouterLink],
  templateUrl: './threedmodelviewer.html',
  styleUrl: './threedmodelviewer.scss',
  host: {
    ngSkipHydration: 'true',
  },
})
export class Threedmodelviewer implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportContainer') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  activeModelType: 'drone' | 'helmet' | 'crystal' | 'custom' = 'drone';
  showGrid = true;
  autoRotate = true;
  wireframe = false;
  customFileName = '';
  modelStats = { triangles: 0, vertices: 0 };
  isLoadingCustomModel = false;
  isDockCollapsed = false;
  errorMessage: string | null = null;
  private errorTimeoutId: any = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isBrowser = false;

  private starfield: THREE.Points | null = null;
  private modelGroup: THREE.Group | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  isDraggingFile = false;
  private clock = new THREE.Clock();
  private mixer: THREE.AnimationMixer | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.initThree();
    }
  }

  toggleDock() {
    this.isDockCollapsed = !this.isDockCollapsed;
    this.cdr.detectChanges();
  }

  private initThree() {
    const canvas = this.canvasRef.nativeElement;
    const container = this.containerRef.nativeElement;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x13131f, 0.035);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 1.8, 4.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 25;
    this.controls.minDistance = 1;
    this.controls.target.set(0, 0.4, 0);
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.0;

    if (typeof ResizeObserver !== 'undefined' && container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(container);
    }

    this.setupLighting();
    this.buildStarfield();
    this.setupGrid();

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.loadBuiltInModel(this.activeModelType);
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(4, 6, 4);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x00f2fe, 1.2);
    fillLight.position.set(-4, 2, 2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x96c93d, 1.5);
    rimLight.position.set(0, 4, -4);
    this.scene.add(rimLight);
  }

  private setupGrid() {
    this.gridHelper = new THREE.GridHelper(10, 20, 0x00f2fe, 0x24243e);
    this.gridHelper.position.y = -0.8;
    this.gridHelper.visible = this.showGrid;
    this.scene.add(this.gridHelper);
  }

  loadBuiltInModel(type: 'drone' | 'helmet' | 'crystal' | 'custom') {
    if (type === 'custom') return;
    this.dismissError();
    this.activeModelType = type;
    this.customFileName = '';

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }

    if (!this.modelGroup) return;
    this.disposeHierarchy(this.modelGroup);
    this.modelGroup.clear();

    let model: THREE.Object3D;
    switch (type) {
      case 'helmet':
        model = this.buildCyberHelmet();
        break;
      case 'crystal':
        model = this.buildGeodesicCrystal();
        break;
      case 'drone':
      default:
        model = this.buildSciFiDrone();
        break;
    }

    this.modelGroup.add(model);
    this.updateModelStats(model);
    this.applyWireframe();
    this.cdr.detectChanges();
  }

  private buildSciFiDrone(): THREE.Group {
    const drone = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.35, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      metalness: 0.85,
      roughness: 0.25,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    drone.add(body);

    const coreGeo = new THREE.SphereGeometry(0.28, 32, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.05;
    drone.add(core);

    const armMat = new THREE.MeshStandardMaterial({ color: 0x3a404d, metalness: 0.8, roughness: 0.3 });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x4facfe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.8,
      metalness: 0.5,
    });

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const armLength = 1.1;
      const x = Math.cos(angle) * armLength;
      const z = Math.sin(angle) * armLength;

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, armLength), armMat);
      arm.position.set(x * 0.5, 0, z * 0.5);
      arm.rotation.y = -angle + Math.PI / 2;
      drone.add(arm);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.18, 16), armMat);
      pod.position.set(x, 0.05, z);
      drone.add(pod);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 16, 32), ringMat);
      ring.position.set(x, -0.06, z);
      ring.rotation.x = Math.PI / 2;
      drone.add(ring);
    }

    drone.position.y = 0.4;
    return drone;
  }

  private buildCyberHelmet(): THREE.Group {
    const helmet = new THREE.Group();

    const skullGeo = new THREE.DodecahedronGeometry(0.95, 2);
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0x22262f,
      metalness: 0.9,
      roughness: 0.2,
      flatShading: true,
    });
    const skull = new THREE.Mesh(skullGeo, skullMat);
    skull.scale.set(0.9, 1.1, 1.0);
    helmet.add(skull);

    const visorGeo = new THREE.BoxGeometry(1.05, 0.25, 0.45);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.9,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.1, 0.65);
    helmet.add(visor);

    const earGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.3, 16);
    const earMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.7, roughness: 0.3 });

    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(0.9, 0, 0);
    helmet.add(leftEar);

    const rightEar = leftEar.clone();
    rightEar.position.set(-0.9, 0, 0);
    helmet.add(rightEar);

    helmet.position.y = 0.4;
    return helmet;
  }

  private buildGeodesicCrystal(): THREE.Group {
    const crystal = new THREE.Group();

    const outerGeo = new THREE.IcosahedronGeometry(1.05, 1);
    const outerMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f2fe,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85,
      ior: 1.5,
      flatShading: true,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    crystal.add(outer);

    const innerGeo = new THREE.OctahedronGeometry(0.55, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.8,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    crystal.add(inner);

    crystal.position.y = 0.4;
    return crystal;
  }

  triggerFileUpload() {
    this.fileInputRef?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.loadModelFile(input.files[0]);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.loadModelFile(files[0]);
    }
  }

  loadModelFile(file: File) {
    this.dismissError();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['glb', 'gltf', 'fbx', 'obj'];

    if (!extension || !validExtensions.includes(extension)) {
      this.showErrorMessage(
        `Unsupported format ".${extension || 'unknown'}". Please upload a .glb, .gltf, .fbx, or .obj 3D model.`
      );
      return;
    }

    this.isLoadingCustomModel = true;
    this.customFileName = file.name;
    this.activeModelType = 'custom';
    this.cdr.detectChanges();

    try {
      if (extension === 'glb' || extension === 'gltf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const loader = new GLTFLoader();
          loader.parse(
            arrayBuffer,
            '',
            (gltf) => {
              this.setupImportedModel(gltf.scene, gltf.animations);
            },
            (error) => {
              console.error('Error parsing GLTF/GLB model:', error);
              this.handleLoadError('GLB / GLTF', file.name);
            }
          );
        };
        reader.onerror = () => this.handleLoadError('GLB / GLTF', file.name);
        reader.readAsArrayBuffer(file);
      } else if (extension === 'fbx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const loader = new FBXLoader();
            const fbx = loader.parse(arrayBuffer, '');
            this.setupImportedModel(fbx, fbx.animations || []);
          } catch (error) {
            console.error('Error parsing FBX model:', error);
            this.handleLoadError('FBX', file.name);
          }
        };
        reader.onerror = () => this.handleLoadError('FBX', file.name);
        reader.readAsArrayBuffer(file);
      } else if (extension === 'obj') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const loader = new OBJLoader();
            const obj = loader.parse(text);
            this.setupImportedModel(obj, []);
          } catch (error) {
            console.error('Error parsing OBJ model:', error);
            this.handleLoadError('OBJ', file.name);
          }
        };
        reader.onerror = () => this.handleLoadError('OBJ', file.name);
        reader.readAsText(file);
      }
    } catch (err) {
      console.error('Failed to load 3D model:', err);
      this.handleLoadError(extension.toUpperCase(), file.name);
    }
  }

  private setupImportedModel(loadedModel: THREE.Object3D, animations: THREE.AnimationClip[] = []) {
    if (!this.modelGroup) return;

    let hasGeometry = false;
    loadedModel.traverse((child: any) => {
      if (child.isMesh && child.geometry) {
        hasGeometry = true;
      }
    });

    if (!hasGeometry) {
      this.showErrorMessage(
        `Failed to load "${this.customFileName}": No valid 3D meshes or visible geometry found in the file.`
      );
      return;
    }

    this.dismissError();
    this.disposeHierarchy(this.modelGroup);
    this.modelGroup.clear();

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }

    if (animations && animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(loadedModel);
      animations.forEach((clip) => {
        this.mixer?.clipAction(clip).play();
      });
    }

    loadedModel.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }

        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x00f2fe,
            roughness: 0.35,
            metalness: 0.45,
            side: THREE.DoubleSide,
          });
        }
      }
    });

    const box = new THREE.Box3().setFromObject(loadedModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2.2 / maxDim : 1;
    loadedModel.scale.setScalar(scale);

    loadedModel.position.x = -center.x * scale;
    loadedModel.position.y = -center.y * scale + 0.4;
    loadedModel.position.z = -center.z * scale;

    this.modelGroup.add(loadedModel);
    this.updateModelStats(loadedModel);
    this.applyWireframe();

    this.isLoadingCustomModel = false;
    this.cdr.detectChanges();
  }

  private handleLoadError(format: string, fileName?: string) {
    const fileText = fileName ? ` "${fileName}"` : '';
    this.showErrorMessage(
      `Failed to load${fileText}: Could not parse ${format} file data. Please verify the file is not corrupted or missing required texture assets.`
    );
  }

  showErrorMessage(msg: string) {
    this.errorMessage = msg;
    this.isLoadingCustomModel = false;
    this.cdr.detectChanges();

    if (this.errorTimeoutId) {
      clearTimeout(this.errorTimeoutId);
    }
    this.errorTimeoutId = setTimeout(() => {
      this.dismissError();
    }, 7000);
  }

  dismissError() {
    this.errorMessage = null;
    if (this.errorTimeoutId) {
      clearTimeout(this.errorTimeoutId);
      this.errorTimeoutId = null;
    }
    this.cdr.detectChanges();
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    if (this.gridHelper) {
      this.gridHelper.visible = this.showGrid;
    }
  }

  toggleWireframe() {
    this.wireframe = !this.wireframe;
    this.applyWireframe();
  }

  private applyWireframe() {
    if (!this.modelGroup) return;
    this.modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => (mat.wireframe = this.wireframe));
        } else if (child.material) {
          child.material.wireframe = this.wireframe;
        }
      }
    });
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(0, 1.8, 4.2);
      this.controls.target.set(0, 0.4, 0);
      this.controls.update();
    }
  }

  private updateModelStats(object: THREE.Object3D) {
    let triangles = 0;
    let vertices = 0;

    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geo = child.geometry;
        if (geo.index) {
          triangles += geo.index.count / 3;
        } else if (geo.attributes['position']) {
          triangles += geo.attributes['position'].count / 3;
        }
        if (geo.attributes['position']) {
          vertices += geo.attributes['position'].count;
        }
      }
    });

    this.modelStats = {
      triangles: Math.round(triangles),
      vertices: Math.round(vertices),
    };
  }

  private buildStarfield() {
    const count = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const c1 = new THREE.Color(0x00f2fe);
    const c2 = new THREE.Color(0x4facfe);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

      const mixed = c1.clone().lerp(c2, Math.random());
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

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
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, newCanvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 25;
    this.controls.minDistance = 1;
    this.controls.target.set(0, 0.4, 0);
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.0;
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.canvasRef && this.renderer) {
      if (this.canvasRef.nativeElement !== this.renderer.domElement) {
        this.rebindRendererCanvas(this.canvasRef.nativeElement);
      }
    }
    const time = Date.now() * 0.001;

    if (this.controls) {
      this.controls.update();
    }

    const delta = this.clock.getDelta();
    if (this.mixer) {
      this.mixer.update(delta);
    }

    if (this.starfield) {
      this.starfield.rotation.y = time * 0.03;
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

  private disposeHierarchy(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  ngOnDestroy() {
    this.dismissError();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.modelGroup) {
      this.scene?.remove(this.modelGroup);
      this.disposeHierarchy(this.modelGroup);
    }
    if (this.gridHelper) {
      this.scene?.remove(this.gridHelper);
      this.gridHelper.dispose();
    }
    if (this.starfield) {
      this.scene?.remove(this.starfield);
      this.starfield.geometry.dispose();
      (this.starfield.material as THREE.Material).dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
