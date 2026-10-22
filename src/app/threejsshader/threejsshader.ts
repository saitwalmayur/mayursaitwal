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

@Component({
  selector: 'app-threejsshader',
  imports: [CommonModule, RouterLink],
  templateUrl: './threejsshader.html',
  styleUrl: './threejsshader.scss',
  host: {
    ngSkipHydration: 'true',
  },
})
export class Threejsshader implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportContainer') containerRef!: ElementRef<HTMLDivElement>;

  // Shader Controls
  geometryType: 'sphere' | 'torusKnot' | 'plane' = 'sphere';
  speed = 1.2;
  frequency = 2.0;
  amplitude = 0.35;
  wireframe = false;
  preset: 'cyanPlasma' | 'cyberNeon' | 'emeraldWave' | 'solarFlare' = 'cyanPlasma';
  autoRotate = false;
  isDockCollapsed = false;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private isBrowser = false;

  private starfield: THREE.Points | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;

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
    this.camera.position.set(0, 0.5, 4.2);

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

    this.buildStarfield();
    this.buildShaderMesh();
    this.animate();
  }

  private buildShaderMesh() {
    const vertexShader = `
      uniform float uTime;
      uniform float uSpeed;
      uniform float uFrequency;
      uniform float uAmplitude;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDisplacement;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);

        float displacement = sin(position.x * uFrequency + uTime * uSpeed) *
                             cos(position.y * uFrequency + uTime * uSpeed) *
                             sin(position.z * uFrequency + uTime * uSpeed * 0.75);

        vDisplacement = displacement;
        vec3 newPosition = position + normal * (displacement * uAmplitude);
        vPosition = newPosition;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDisplacement;

      void main() {
        vec3 viewDir = normalize(-vPosition);
        float fresnel = dot(viewDir, vNormal);
        fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
        fresnel = pow(fresnel, 2.8);

        float factor = (vDisplacement + 1.0) * 0.5;
        vec3 baseColor = mix(uColorA, uColorB, factor);
        vec3 finalColor = mix(baseColor, uColorC, fresnel * 0.85);

        finalColor += vec3(0.18) * pow(factor, 3.2);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const colors = this.getPresetColors(this.preset);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: this.speed },
        uFrequency: { value: this.frequency },
        uAmplitude: { value: this.amplitude },
        uColorA: { value: colors.colorA },
        uColorB: { value: colors.colorB },
        uColorC: { value: colors.colorC },
      },
      wireframe: this.wireframe,
      side: THREE.DoubleSide,
    });

    const geometry = this.createGeometry(this.geometryType);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  private createGeometry(type: 'sphere' | 'torusKnot' | 'plane'): THREE.BufferGeometry {
    switch (type) {
      case 'torusKnot':
        return new THREE.TorusKnotGeometry(0.85, 0.28, 180, 48);
      case 'plane':
        return new THREE.PlaneGeometry(3.5, 3.5, 96, 96);
      case 'sphere':
      default:
        return new THREE.SphereGeometry(1.2, 128, 96);
    }
  }

  setGeometry(type: 'sphere' | 'torusKnot' | 'plane') {
    this.geometryType = type;
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = this.createGeometry(type);
    }
  }

  setPreset(preset: 'cyanPlasma' | 'cyberNeon' | 'emeraldWave' | 'solarFlare') {
    this.preset = preset;
    if (this.material) {
      const colors = this.getPresetColors(preset);
      this.material.uniforms['uColorA'].value = colors.colorA;
      this.material.uniforms['uColorB'].value = colors.colorB;
      this.material.uniforms['uColorC'].value = colors.colorC;
    }
  }

  private getPresetColors(preset: string) {
    switch (preset) {
      case 'cyberNeon':
        return {
          colorA: new THREE.Color(0xff007f),
          colorB: new THREE.Color(0x7928ca),
          colorC: new THREE.Color(0x00f2fe),
        };
      case 'emeraldWave':
        return {
          colorA: new THREE.Color(0x0052d4),
          colorB: new THREE.Color(0x00f260),
          colorC: new THREE.Color(0x96c93d),
        };
      case 'solarFlare':
        return {
          colorA: new THREE.Color(0xf12711),
          colorB: new THREE.Color(0xf5af19),
          colorC: new THREE.Color(0xfff176),
        };
      case 'cyanPlasma':
      default:
        return {
          colorA: new THREE.Color(0x0b192c),
          colorB: new THREE.Color(0x00f2fe),
          colorC: new THREE.Color(0x4facfe),
        };
    }
  }

  onSpeedInput(event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.speed = val;
    if (this.material) this.material.uniforms['uSpeed'].value = val;
  }

  onFrequencyInput(event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.frequency = val;
    if (this.material) this.material.uniforms['uFrequency'].value = val;
  }

  onAmplitudeInput(event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.amplitude = val;
    if (this.material) this.material.uniforms['uAmplitude'].value = val;
  }

  toggleWireframe() {
    this.wireframe = !this.wireframe;
    if (this.material) {
      this.material.wireframe = this.wireframe;
    }
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(0, 0.5, 4.2);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
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

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const time = Date.now() * 0.001;

    if (this.controls) {
      this.controls.update();
    }

    if (this.material) {
      this.material.uniforms['uTime'].value = time;
    }

    if (this.mesh && !this.autoRotate) {
      this.mesh.rotation.y = time * 0.2;
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

  ngOnDestroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.mesh) {
      this.scene?.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.material?.dispose();
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
