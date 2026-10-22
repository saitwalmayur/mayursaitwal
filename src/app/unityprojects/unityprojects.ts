import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

export type UnityCategory = 'all' | 'enterprise' | 'assetstore' | 'webgames';

export interface UnityProjectLink {
  label: string;
  url: string;
  type: 'play' | 'store' | 'case-study' | 'external';
}

export interface UnityProjectItem {
  id: string;
  name: string;
  category: 'enterprise' | 'assetstore' | 'webgames';
  categoryLabel: string;
  tagline: string;
  description: string;
  imageUrl?: string;
  icon: string;
  techStack: string[];
  features: string[];
  links: UnityProjectLink[];
  architectureDetails?: string;
  metrics?: string;
}

@Component({
  selector: 'app-unityprojects',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './unityprojects.html',
  styleUrl: './unityprojects.scss',
})
export class Unityprojects {
  activeCategory: UnityCategory = 'all';
  searchQuery: string = '';
  selectedProject: UnityProjectItem | null = null;

  readonly projects: UnityProjectItem[] = [
    // Enterprise & Spatial Computing
    {
      id: 'apple-vision-pro',
      name: 'Digital Twin - Apple Vision Pro',
      category: 'enterprise',
      categoryLabel: 'Spatial Computing / visionOS',
      tagline: 'Enterprise spatial digital twin recognized with 2 Gold Awards at TCS',
      description:
        'Led end-to-end development of a next-generation spatial computing digital twin application on Apple Vision Pro. Built interactive gesture-driven 3D inspection, real-time telemetry streaming, and ultra-high-fidelity PBR rendering.',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/applevision.png',
      icon: '🥽',
      techStack: ['Unity', 'visionOS', 'C#', 'Polyspatial', 'Blender', 'Xcode'],
      features: [
        'Recognized with 2 Gold Awards at TCS',
        'Spatial gesture interaction & gaze tracking',
        'Real-time IoT telemetry synchronization',
        'Optimized stereoscopic 90fps rendering pipeline',
      ],
      links: [
        {
          label: 'View Showcase',
          url: 'https://www.linkedin.com/posts/tata-consultancy-services-north-america_tcsnycmarathon-runwithtcs-runwithtcsinnyc-ugcPost-7258484777668743169-vD4l/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAduOT4BroteUiiLGXBzeJpj6T4oXuEQ0VY',
          type: 'case-study',
        },
      ],
      architectureDetails:
        'Developed utilizing Unity Polyspatial and Swift bridging. Implemented custom spatial shaders and low-overhead geometry instancing to maintain rock-solid 90 FPS per eye without reprojection stutter.',
      metrics: '2 Gold Awards Winner • 90 FPS Spatial Fidelity',
    },
    {
      id: 'avataryug',
      name: 'Avataryug',
      category: 'enterprise',
      categoryLabel: 'Enterprise Gaming',
      tagline: 'Cross-platform 3D avatar creation engine & scalable multiplayer infrastructure',
      description:
        'Engineered core 3D avatar mechanics, dynamic skeletal mesh deformation, accessory attachment systems, and scalable multiplayer synchronization pipelines for enterprise gaming ecosystems.',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/AYlogo.webp',
      icon: '👤',
      techStack: ['Unity', 'C#', 'REST API', 'Unreal Engine', 'Skinning & Rigging'],
      features: [
        'Real-time skeletal mesh bone binding & blendshapes',
        'Cross-platform avatar export & synchronization',
        'Scalable REST API cloud backend integration',
        'Modular wardrobe & skin customization architecture',
      ],
      links: [
        {
          label: 'Visit Avataryug',
          url: 'https://avataryug.com/showcase',
          type: 'case-study',
        },
      ],
      architectureDetails:
        'Combined custom SkinnedMeshRenderer combine utilities to merge multiple apparel draw calls into a single unified draw call, reducing batch overhead by 70%.',
      metrics: 'Scalable Enterprise SDK • Multi-Platform',
    },
    {
      id: 'pool-royale',
      name: 'Pool Royale',
      category: 'enterprise',
      categoryLabel: 'Multiplayer Sports',
      tagline: 'Real-time competitive 8-ball pool with custom physics & server reconciliation',
      description:
        'Built full-stack real-time competitive multiplayer gameplay with deterministic ball-on-ball collision physics, realistic spin and cue friction, cue angle calculations, and live matchmaking.',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/poolroyale.png',
      icon: '🎱',
      techStack: ['Unity', 'C#', 'Photon PUN', 'PlayFab', 'Custom 2D/3D Physics'],
      features: [
        'Deterministic collision & ball deflection mechanics',
        'Real-time matchmaking & spectator lobbies',
        'PlayFab backend for inventories, cues & coins',
        'Smooth network interpolation & state reconciliation',
      ],
      links: [
        {
          label: 'Game Info',
          url: 'https://pool-royale-5r7.en.softonic.com/android?ex=RAMP-3507.3&rex=true',
          type: 'play',
        },
      ],
      architectureDetails:
        'Replaced standard PhysX non-deterministic solvers with a custom fixed-point mathematical ball simulator ensuring zero desync between mobile players on high-latency networks.',
      metrics: 'Over 100k+ Matches Simulated',
    },

    // Unity Asset Store Templates
    {
      id: 'bottle-shooter',
      name: 'Bottle Shooter 3D',
      category: 'assetstore',
      categoryLabel: 'Unity Asset Store',
      tagline: 'Complete 3D target shooting game template with ragdoll & fracture physics',
      description:
        'Commercial source-code template published on the official Unity Asset Store. Features modular weapon aiming systems, bullet trajectory ballistics, fracture glass physics, sound pooling, and responsive UI.',
      imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/package-screenshot/d4198f30-efc5-4b36-8bee-383f156f0c9e.webp',
      icon: '🎯',
      techStack: ['Unity', 'C#', 'Mesh Slicing', 'Audio Pooling', 'Asset Store'],
      features: [
        'Modular weapon system & trajectory calculation',
        'Dynamic glass shatter & mesh fracture effects',
        'Object pooling for particles & shell casings',
        'Comprehensive inspector documentation & clean code',
      ],
      links: [
        {
          label: 'Asset Store Package',
          url: 'https://assetstore.unity.com/packages/templates/bottle-shooter-89934',
          type: 'store',
        },
      ],
      metrics: 'Official Unity Asset Store Template',
    },
    {
      id: 'ace-bike-stunts',
      name: 'Ace Bike Stunts',
      category: 'assetstore',
      categoryLabel: 'Unity Asset Store',
      tagline: 'High-octane motorcycle physics & airborne stunt engine template',
      description:
        'Full motorcycle physics starter kit featuring wheel colliders, suspension damping, mid-air gyroscope stabilization, stunt detection scoring, and checkpoint racetrack management.',
      imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/package-screenshot/4d8f99e2-edf9-4a7b-9f39-3969e9474f11.webp',
      icon: '🏍️',
      techStack: ['Unity', 'C#', 'WheelColliders', 'Suspension Math', 'Asset Store'],
      features: [
        'Custom 2-wheel physics controller with lean dynamics',
        'Mid-air trick detection & rotational combo system',
        'Configurable suspension, torque curves & brake forces',
        'Mobile touch steering & tilt accelerometer support',
      ],
      links: [
        {
          label: 'Asset Store Package',
          url: 'https://assetstore.unity.com/packages/templates/ace-bike-stunts-88565',
          type: 'store',
        },
      ],
      metrics: 'Official Unity Asset Store Template',
    },
    {
      id: 'ace-fighter',
      name: 'Ace Fighter Combat',
      category: 'assetstore',
      categoryLabel: 'Unity Asset Store',
      tagline: 'Aerial dogfight combat simulator with missile tracking & aerodynamics',
      description:
        'Complete 3D arcade flight mechanics template featuring aerodynamic lift/drag math, enemy target radar lock-on, homing heat-seeking missiles, and dogfight AI behaviors.',
      imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/package-screenshot/25cec6cb-1d35-4500-b302-63421e7ebaee.webp',
      icon: '✈️',
      techStack: ['Unity', 'C#', 'Aerodynamics', 'Targeting AI', 'Asset Store'],
      features: [
        'Full 6-DOF arcade aerodynamic physics',
        'Radar target lock-on & heat-seeker missile guidance',
        'Enemy dogfight AI with evasion patterns',
        'Cinematic cockpit & trailing chase cameras',
      ],
      links: [
        {
          label: 'Asset Store Package',
          url: 'https://assetstore.unity.com/packages/templates/ace-fighter-88101',
          type: 'store',
        },
      ],
      metrics: 'Official Unity Asset Store Template',
    },
    {
      id: 'rocket-escape',
      name: 'Rocket Escape',
      category: 'assetstore',
      categoryLabel: 'Unity Asset Store',
      tagline: 'Precision 2D/3D rocket thrust physics & procedural obstacle gauntlets',
      description:
        'Intense gravity-defying arcade template where players balance momentum, fuel management, and dual-thruster vectors to navigate procedural hazards.',
      imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/key-image/14f7b279-213f-43d9-9258-558d27907179.webp',
      icon: '🚀',
      techStack: ['Unity', 'C#', 'Vector Physics', 'Procedural Levels', 'Asset Store'],
      features: [
        'Dual-thruster vector physics with momentum inertia',
        'Fuel economy & thermal heat gauge mechanics',
        'Procedural obstacle generation algorithms',
        'Particle exhaust emitters & screen-shake feedback',
      ],
      links: [
        {
          label: 'Asset Store Package',
          url: 'https://assetstore.unity.com/packages/templates/rocket-escape-78174',
          type: 'store',
        },
      ],
      metrics: 'Official Unity Asset Store Template',
    },
    {
      id: 'nano-ninja-jump',
      name: 'Nano Ninja Jump',
      category: 'assetstore',
      categoryLabel: 'Unity Asset Store',
      tagline: 'Fast-paced vertical platformer with wall-climbing & combo mechanics',
      description:
        'Addictive vertical platformer featuring tight wall-jumping physics, obstacle hazards, enemy shuriken mechanics, and procedural platform spawning.',
      icon: '🥷',
      techStack: ['Unity', 'C#', '2D/3D Platforming', 'Object Spawner', 'Asset Store'],
      features: [
        'Fluid wall-sliding and wall-jump mechanics',
        'Dynamic platform generator with scrolling difficulty',
        'Combo multiplier scoring system',
        'Optimized for instant mobile startup & 60fps',
      ],
      links: [
        {
          label: 'Asset Store Package',
          url: 'https://assetstore.unity.com/packages/templates/nano-ninja-jump-67653',
          type: 'store',
        },
      ],
      metrics: 'Official Unity Asset Store Template',
    },

    // Playable 3D Web Games
    {
      id: '3d-fill',
      name: '3D Fill',
      category: 'webgames',
      categoryLabel: 'Playable Web Game',
      tagline: 'Spatial logic puzzle requiring 3D block awareness & voxel pathfinding',
      description:
        'A challenging 3D puzzle game where players manipulate geometric voxels to completely fill intricate spatial contours within limited move counts.',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/fill3d.png',
      icon: '🧊',
      techStack: ['Unity WebGL', 'C#', 'Voxel Math', 'Spatial Logic', 'GamePix'],
      features: [
        'Playable directly in the browser via WebGL',
        'Over 50+ hand-crafted spatial puzzle stages',
        'Satisfying voxel snap animations & haptic audio',
        'Published & featured globally on GamePix',
      ],
      links: [
        {
          label: 'Play Free on GamePix ↗',
          url: 'https://www.gamepix.com/play/3d-fill',
          type: 'play',
        },
      ],
      metrics: 'Playable Online • Global WebGL Release',
    },
    {
      id: 'step-box',
      name: 'Step Box',
      category: 'webgames',
      categoryLabel: 'Playable Web Game',
      tagline: 'Strategic grid platformer puzzle where every step triggers environmental reactions',
      description:
        'Interactive 3D puzzle platformer where players calculate sequential steps across floating tile matrices, avoiding falling tiles and timed hazard traps.',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/stepbox.png',
      icon: '📦',
      techStack: ['Unity WebGL', 'C#', 'Grid Navigation', 'Puzzle Systems', 'GameArter'],
      features: [
        'Dynamic disintegrating tiles & elevator platforms',
        'Multi-stage checkpoint system with star ratings',
        'Playable on GamePix and GameArter platforms',
        'Smooth low-poly aesthetic & isometric camera',
      ],
      links: [
        {
          label: 'Play on GamePix ↗',
          url: 'https://www.gamepix.com/play/step-box',
          type: 'play',
        },
        {
          label: 'Play on GameArter ↗',
          url: 'https://www.gamearter.com/game/step-box/',
          type: 'play',
        },
      ],
      metrics: 'Playable Online • Dual Platform Release',
    },
    {
      id: 'impossible-bump-ball',
      name: 'Impossible Bump Ball',
      category: 'webgames',
      categoryLabel: 'Playable Web Game',
      tagline: 'Reflexive physics bouncer with dynamic rotational obstacles',
      description:
        'Vibrant one-tap arcade game with bouncy physics, rotational timing barriers, color matching deflectors, and procedural speed escalations.',
      imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/impo.png',
      icon: '🔴',
      techStack: ['Unity WebGL', 'C#', 'Physics Bounce', 'Arcade Reflex'],
      features: [
        'Hyper-responsive one-touch physics mechanics',
        'Juicy juice effects: screen shake, squash & stretch',
        'Color-matched collision filter layers',
        'Instant web browser loading',
      ],
      links: [
        {
          label: 'Play on GamePix ↗',
          url: 'https://www.gamepix.com/play/impossible-bump-ball',
          type: 'play',
        },
      ],
      metrics: 'Playable Online • Instant WebGL',
    },
    {
      id: 'planet-merge',
      name: 'Planet Merge',
      category: 'webgames',
      categoryLabel: 'Playable Web Game',
      tagline: 'Satisfying gravitational physics puzzle with celestial chain reactions',
      description:
        'Drop and merge celestial bodies inside a gravitational jar. Watch tiny moons combine into planets, gas giants, and radiant suns with juicy physics feedback.',
      imageUrl: 'https://img.gamepix.com/games/planet-merge/cover/planet-merge.png',
      icon: '🪐',
      techStack: ['Unity WebGL', 'C#', '2D/3D Physics', 'Particle FX', 'GamePix'],
      features: [
        'Addictive Suika-style merging physics mechanics',
        'Dynamic gravitational impulse & elastic bounce',
        'Celestial star-burst particle FX and sound cues',
        'Global leaderboard high-score tracking',
      ],
      links: [
        {
          label: 'Play on GamePix ↗',
          url: 'https://www.gamepix.com/play/planet-merge',
          type: 'play',
        },
      ],
      metrics: 'Playable Online • Viral Mechanics',
    },
    {
      id: 'match-mania',
      name: 'Match Mania 3D',
      category: 'webgames',
      categoryLabel: 'Playable Web Game',
      tagline: 'Casual 3D object sorting & tile matching with real-time physics chaos',
      description:
        'Search through a pile of scattered 3D objects, match identical items, and clear the board before the countdown expires with realistic physics collisions.',
      imageUrl: 'https://img.gamepix.com/games/match-mania/cover/match-mania.png',
      icon: '🧩',
      techStack: ['Unity WebGL', 'C#', 'Physics Solvers', 'UI Animations'],
      features: [
        'Hundreds of colorful 3D props with PhysX dynamics',
        'Satisfying magnetic match slots & combo streaks',
        'Over 40+ escalating puzzle levels',
        'Optimized for mobile touch & desktop click',
      ],
      links: [
        {
          label: 'Play on GamePix ↗',
          url: 'https://www.gamepix.com/play/match-mania',
          type: 'play',
        },
      ],
      metrics: 'Playable Online • Casual 3D',
    },
  ];

  get filteredProjects(): UnityProjectItem[] {
    return this.projects.filter((p) => {
      const matchesCategory =
        this.activeCategory === 'all' || p.category === this.activeCategory;
      const matchesSearch =
        !this.searchQuery ||
        p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        p.tagline.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        p.techStack.some((t) =>
          t.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      return matchesCategory && matchesSearch;
    });
  }

  setCategory(category: UnityCategory) {
    this.activeCategory = category;
  }

  openSpecs(project: UnityProjectItem) {
    this.selectedProject = project;
  }

  closeSpecs() {
    this.selectedProject = null;
  }
}
