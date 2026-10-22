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
  selector: 'app-audiovisulizer',
  imports: [CommonModule, RouterLink],
  templateUrl: './audiovisulizer.html',
  styleUrl: './audiovisulizer.scss',
  host: {
    ngSkipHydration: 'true',
  },
})
export class Audiovisulizer implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportContainer') containerRef!: ElementRef<HTMLDivElement>;

  isPlaying = false;
  autoRotate = true;
  isDockCollapsed = false;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private isBrowser = false;

  // Web Audio Nodes
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioDataArray: Uint8Array<ArrayBuffer> | null = null;
  private synthInterval: any = null;

  // Visualizer Meshes
  private visualizerGroup: THREE.Group | null = null;
  private bars: THREE.Mesh[] = [];
  private starfield: THREE.Points | null = null;
  private coreSphere: THREE.Mesh | null = null;

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
    this.scene.fog = new THREE.FogExp2(0x10101c, 0.03);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 3.2, 5.5);

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
    this.controls.minDistance = 2;
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.2;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const light1 = new THREE.PointLight(0x00f2fe, 3, 20);
    light1.position.set(0, 2, 0);
    this.scene.add(light1);

    const light2 = new THREE.PointLight(0xe52e71, 2.5, 20);
    light2.position.set(0, -2, 0);
    this.scene.add(light2);

    this.buildStarfield();
    this.buildVisualizer();
    this.animate();
  }

  private buildVisualizer() {
    if (this.visualizerGroup) {
      this.scene.remove(this.visualizerGroup);
      this.visualizerGroup.clear();
    }

    this.visualizerGroup = new THREE.Group();
    this.bars = [];

    const coreGeo = new THREE.IcosahedronGeometry(0.7, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.8,
      wireframe: true,
    });
    this.coreSphere = new THREE.Mesh(coreGeo, coreMat);
    this.visualizerGroup.add(this.coreSphere);

    const barCount = 48;
    const radius = 2.4;
    const barGeo = new THREE.BoxGeometry(0.12, 1, 0.12);

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const color = new THREE.Color().setHSL(i / barCount, 0.9, 0.55);
      const barMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.8,
      });

      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(x, 0, z);
      bar.rotation.y = -angle;
      bar.scale.y = 0.2;

      this.visualizerGroup.add(bar);
      this.bars.push(bar);
    }

    this.scene.add(this.visualizerGroup);
  }

  toggleAudio() {
    if (this.isPlaying) {
      this.stopAudio();
    } else {
      this.startAudio();
    }
  }

  private startAudio() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const notes = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 783.99];
    let step = 0;

    this.synthInterval = setInterval(() => {
      if (!this.audioCtx || !this.analyser) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      const freq = notes[step % notes.length];
      osc.type = step % 4 === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);

      step++;
    }, 180);

    this.isPlaying = true;
    this.cdr.detectChanges();
  }

  private stopAudio() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.isPlaying = false;
    this.cdr.detectChanges();
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(0, 3.2, 5.5);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  private buildStarfield() {
    const count = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const c1 = new THREE.Color(0xe52e71);
    const c2 = new THREE.Color(0x00f2fe);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 22;

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

    let averageFrequency = 0;
    if (this.analyser && this.audioDataArray && this.isPlaying) {
      this.analyser.getByteFrequencyData(this.audioDataArray);

      let sum = 0;
      for (let i = 0; i < this.audioDataArray.length; i++) {
        sum += this.audioDataArray[i];
      }
      averageFrequency = sum / this.audioDataArray.length;

      for (let i = 0; i < this.bars.length; i++) {
        const dataIndex = i % this.audioDataArray.length;
        const val = this.audioDataArray[dataIndex] / 255.0;
        const targetScaleY = Math.max(0.15, val * 3.5);
        this.bars[i].scale.y = THREE.MathUtils.lerp(this.bars[i].scale.y, targetScaleY, 0.25);
        this.bars[i].position.y = this.bars[i].scale.y * 0.5;
      }
    } else {
      for (let i = 0; i < this.bars.length; i++) {
        const wave = Math.sin(time * 3 + i * 0.3) * 0.5 + 0.6;
        this.bars[i].scale.y = THREE.MathUtils.lerp(this.bars[i].scale.y, wave, 0.1);
        this.bars[i].position.y = this.bars[i].scale.y * 0.5;
      }
    }

    if (this.coreSphere) {
      const coreScale = 1 + (averageFrequency / 255.0) * 0.8;
      this.coreSphere.scale.setScalar(coreScale);
      this.coreSphere.rotation.x = time * 0.5;
      this.coreSphere.rotation.y = time * 0.8;
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
    this.stopAudio();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
    }
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.visualizerGroup) {
      this.scene?.remove(this.visualizerGroup);
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
