import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-contact-screen',
  imports: [],
  templateUrl: './contact-screen.html',
  styleUrl: './contact-screen.scss',
})
export class ContactScreen implements AfterViewInit, OnDestroy {
  @ViewChild('particleCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private particlesMesh!: THREE.Points;
  private animationId: number | null = null;
  
  // Controls & Interaction
  private controls!: OrbitControls;
  private velocities!: Float32Array;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initThreeJs();
    }
  }

  private initThreeJs() {
    const canvas = this.canvasRef.nativeElement;
    const container = this.containerRef.nativeElement;

    let width = container.clientWidth;
    let height = container.clientHeight;

    if (width === 0 || height === 0) {
      width = window.innerWidth;
      height = window.innerHeight * 0.9;
    }

    // Scene Setup
    this.scene = new THREE.Scene();

    // Camera Setup
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 2.5;

    // Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // OrbitControls for panning and moving
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;

    // Particle Setup
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 8000;
    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);

    const color1 = new THREE.Color(0x00b09b);
    const color2 = new THREE.Color(0x96c93d);

    for (let i = 0; i < particlesCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 20;
      posArray[i + 1] = (Math.random() - 0.5) * 20;
      posArray[i + 2] = (Math.random() - 0.5) * 10;

      const mixedColor = color1.clone().lerp(color2, Math.random());
      colorsArray[i] = mixedColor.r;
      colorsArray[i + 1] = mixedColor.g;
      colorsArray[i + 2] = mixedColor.b;
    }
    
    // Generate random drift velocities for each particle
    const velocitiesArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
      velocitiesArray[i] = (Math.random() - 0.5) * 0.01;
    }
    this.velocities = velocitiesArray;

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    // Material setup
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    this.scene.add(this.particlesMesh);

    this.animate();
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (isPlatformBrowser(this.platformId) && this.camera && this.renderer && this.containerRef) {
      const container = this.containerRef.nativeElement;
      let width = container.clientWidth;
      let height = container.clientHeight;

      if (width === 0 || height === 0) {
        width = window.innerWidth;
        height = window.innerHeight * 0.9;
      }

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.controls) {
      this.controls.update(); // Required for damping
    }

    if (this.particlesMesh) {
      const positions = this.particlesMesh.geometry.attributes['position'].array as Float32Array;
      
      const wrapSizeX = 20.0;
      const wrapSizeY = 20.0;
      const wrapSizeZ = 10.0;

      const halfX = wrapSizeX / 2;
      const halfY = wrapSizeY / 2;
      const halfZ = wrapSizeZ / 2;
      
      const camPos = this.camera.position;
      
      for (let i = 0; i < positions.length; i += 3) {
        let px = positions[i];
        let py = positions[i + 1];
        let pz = positions[i + 2];

        // Drift
        px += this.velocities[i];
        py += this.velocities[i + 1];
        pz += this.velocities[i + 2];

        // Endless Wrapping Logic
        if (px < camPos.x - halfX) { px += wrapSizeX; }
        else if (px > camPos.x + halfX) { px -= wrapSizeX; }

        if (py < camPos.y - halfY) { py += wrapSizeY; }
        else if (py > camPos.y + halfY) { py -= wrapSizeY; }

        if (pz < camPos.z - halfZ) { pz += wrapSizeZ; }
        else if (pz > camPos.z + halfZ) { pz -= wrapSizeZ; }

        // Update positions array
        positions[i] = px;
        positions[i + 1] = py;
        positions[i + 2] = pz;
      }
      
      this.particlesMesh.geometry.attributes['position'].needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  ngOnDestroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.particlesMesh) {
      this.particlesMesh.geometry.dispose();
      (this.particlesMesh.material as THREE.Material).dispose();
    }
    if (this.controls) {
      this.controls.dispose();
    }
  }
}
