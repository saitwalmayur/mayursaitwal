import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface BabylonProjectItem {
  id: string;
  route: string;
  title: string;
  tagline: string;
  description: string;
  tags: string[];
  icon: string;
  features: string[];
  gradient: string;
}

@Component({
  selector: 'app-babylonjsexample',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './babylonjsexample.html',
  styleUrl: './babylonjsexample.scss',
})
export class Babylonjsexample {
  readonly projects: BabylonProjectItem[] = [
    {
      id: 'cozy-room',
      route: '/babylonjs/room',
      title: 'Isometric Cozy Room 3D',
      tagline: 'Stylized pastel isometric living room with PBR GLB materials & interactive lighting',
      description:
        'A charming, detailed low-poly living room loaded from room2.glb. Features an authentic isometric orthographic camera, soft directional shadows, interactive wall lamp, clickable furniture animations, and Day/Sunset/Night lighting moods.',
      tags: ['GLTF / GLB Loader', 'Isometric Camera', 'PBR Materials', 'Soft Shadows', 'Day & Night Modes'],
      icon: '🛋️',
      features: ['room2.glb PBR Meshes & Soft Shadows', 'Authentic Isometric Orthographic View', 'Interactive Wall Lamp & Micro-Animations', 'Day, Golden Sunset & Cozy Night Modes'],
      gradient: 'linear-gradient(135deg, rgba(165, 193, 151, 0.4), rgba(77, 182, 247, 0.22))',
    },
    {
      id: 'element-table',
      route: '/babylonjs/element-table',
      title: '3D Periodic Table & Bohr Atom',
      tagline: 'Interactive 3D table of all 118 elements with animated atomic orbits',
      description:
        'Explore all 118 chemical elements in an interactive 3D periodic table. Hover or click any element to inspect its live 3D Bohr atom structure with spinning electron shells, energy levels, and elemental data.',
      tags: ['118 Elements', 'Bohr Atom Model', 'Dynamic Textures', 'Orbital Mechanics'],
      icon: '🧪',
      features: ['All 118 Elements & Categories', 'Animated Electron Shells', 'Element Inspector & Navigator', '3D Orbit Camera Controls'],
      gradient: 'linear-gradient(135deg, rgba(0, 229, 255, 0.22), rgba(156, 39, 176, 0.12))',
    },
    {
      id: 'open-world',
      route: '/babylonjs/openworld',
      title: 'Procedural Open World 3D',
      tagline: 'Infinite procedural terrain, biomes, foliage instancing, and dynamic atmospherics in Babylon.js',
      description:
        'Generate infinite mountainous terrain using multi-octave Perlin noise. Features Alpine, Canyon, Mystic Twilight, and Glacial biomes, real-time directional soft shadows, undulating reflective water, instanced low-poly vegetation, day-to-night lighting, drifting clouds, and drone flight controls.',
      tags: ['Procedural Terrain', 'Perlin Noise', 'Instanced Foliage', 'Water Shaders', 'Drone & Orbit Cam'],
      icon: '🏔️',
      features: ['Perlin Multi-Octave Heightmap & Biomes', 'Instanced Pine Trees & Low-Poly Boulders', 'Day / Sunset / Night / Dawn Cycles', 'Free Drone Flight & 360 Orbit Cameras'],
      gradient: 'linear-gradient(135deg, rgba(0, 242, 254, 0.25), rgba(79, 172, 254, 0.15))',
    },
  ];
}
