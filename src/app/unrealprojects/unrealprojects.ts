import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface UnrealProject {
  id: string;
  title: string;
  tagline: string;
  description: string;
  features: string[];
  techStack: string[];
  category: 'gameplay' | 'enterprise' | 'graphics';
  imageUrl?: string;
  links: { label: string; url: string; type: 'external' | 'internal' }[];
  accentColor: string;
}

@Component({
  selector: 'app-unrealprojects',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './unrealprojects.html',
  styleUrl: './unrealprojects.scss',
})
export class Unrealprojects {
  activeCategory: 'all' | 'gameplay' | 'enterprise' | 'graphics' = 'all';

  projects: UnrealProject[] = [
    {
      id: 'avataryug-unreal',
      title: 'Avataryug Cross-Platform 3D System',
      tagline: 'Enterprise 3D avatar creation & customizable runtime for gaming metaverses',
      description:
        'Engineered modular avatar customization and skinning/rigging pipelines in Unreal Engine. Integrated REST APIs, runtime character attachment, dynamic material variations, and cross-platform packaging for seamless multiplayer avatar synchronization.',
      features: [
        'Modular Skeletal Mesh Skinning & Rigging',
        'Customizable UMG UI with Real-Time Previews',
        'RESTful API Backend Asset Synchronization',
        'Multi-LOD Runtime Performance Optimization',
      ],
      techStack: ['Unreal Engine', 'C++', 'Blueprints', 'REST API', 'Skinning & Rigging'],
      category: 'enterprise',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/AYlogo.webp',
      links: [
        { label: 'View Showcase', url: 'https://avataryug.com/showcase', type: 'external' },
      ],
      accentColor: '#00f2fe',
    },
    {
      id: 'gas-eos-framework',
      title: 'GAS & Epic Online Services Architecture',
      tagline: 'Scalable C++ multiplayer framework utilizing Gameplay Ability System and EOS',
      description:
        'Architected an enterprise-level multiplayer foundation using Unreal Engine’s Gameplay Ability System (GAS). Implemented replicated attributes, gameplay effects, ability tasks, prediction keys, and matchmaking/lobbies with Epic Online Services (EOS).',
      features: [
        'Server-Authoritative Ability Execution & Prediction',
        'Custom Gameplay Effect Execution Calculations',
        'EOS P2P Matchmaking, Lobbies & Auth Integration',
        'Network Bandwidth Optimization & Actor Relevancy',
      ],
      techStack: ['Unreal Engine 5', 'C++', 'GAS', 'Epic Online Services (EOS)', 'Replication'],
      category: 'gameplay',
      links: [
        { label: 'Explore Experience', url: '/experience', type: 'internal' },
      ],
      accentColor: '#38bdf8',
    },
    {
      id: 'unreal-simulations',
      title: 'Real-Time AR & Interactive 3D Simulations',
      tagline: 'Immersive cross-platform simulation and interactive visualization experiences',
      description:
        'Developed interactive 3D simulations and augmented reality experiences in Unreal Engine for enterprise mobile and desktop platforms. Built custom plugin integrations, tactile UMG interfaces, and runtime camera controls.',
      features: [
        'Cross-Platform Deployment (iOS / Android / Desktop)',
        'Interactive Part Disassembly & Inspection Sequences',
        'Custom C++ Engine Plugins and Native SDK Bindings',
        'High-Fidelity Lighting with Lumen & Nanite Profiling',
      ],
      techStack: ['Unreal Engine 5', 'C++', 'Blueprints', 'OpenXR', 'UMG UI'],
      category: 'enterprise',
      links: [
        { label: 'View Experience', url: '/experience', type: 'internal' },
      ],
      accentColor: '#a855f7',
    },
    {
      id: 'custom-shaders-rendering',
      title: 'Custom Shaders & GPU Optimization',
      tagline: 'Advanced HLSL and Material Graph shaders tailored for high-framerate mobile/desktop',
      description:
        'Created custom material expressions, post-processing blendables, and procedural surface shaders. Profiled draw calls, vertex bottlenecks, and GPU occupancy to guarantee steady 60+ FPS on target devices.',
      features: [
        'Custom HLSL Shading Nodes & Post-Process Materials',
        'GPU Render Thread Profiling via Unreal Insights',
        'LOD Auto-Generation & Shader Permutation Stripping',
        'Dynamic Weather & Stylized Water Rendering',
      ],
      techStack: ['Unreal Engine', 'HLSL', 'Material Graph', 'Unreal Insights', 'GPU Profiling'],
      category: 'graphics',
      links: [
        { label: 'Contact For Demo', url: '/contact', type: 'internal' },
      ],
      accentColor: '#ec4899',
    },
  ];

  get filteredProjects(): UnrealProject[] {
    if (this.activeCategory === 'all') {
      return this.projects;
    }
    return this.projects.filter((p) => p.category === this.activeCategory);
  }

  setCategory(cat: 'all' | 'gameplay' | 'enterprise' | 'graphics') {
    this.activeCategory = cat;
  }
}
