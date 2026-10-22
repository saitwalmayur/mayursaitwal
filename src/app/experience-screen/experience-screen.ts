import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GameLink {
  label: string;
  url: string;
  type: 'store' | 'website' | 'detail' | 'apple';
}

export interface Game {
  name: string;
  imageUrl?: string;
  links: GameLink[];
  techStack?: string;
  details?: string;
}

export interface Experience {
  company: string;
  role: string;
  location: string;
  duration: string;
  bullets: string[];
  games: Game[];
}

export interface SkillCategory {
  title: string;
  skills: string[];
}

@Component({
  selector: 'app-experience-screen',
  imports: [CommonModule],
  templateUrl: './experience-screen.html',
  styleUrl: './experience-screen.scss',
})
export class ExperienceScreen {
  selectedGame: Game | null = null;

  skillCategories: SkillCategory[] = [
    {
      title: 'Leadership & Management',
      skills: ['Team Leadership', 'Mentorship', 'Cross-Functional Collaboration', 'Agile Delivery', 'Strategic Planning', 'Technical Architecture', 'Stakeholder Management']
    },
    {
      title: 'Frontend & Web',
      skills: ['Angular', 'React', 'React Native', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Three.js', 'Ionic', 'Capacitor']
    },
    {
      title: 'Game Development & XR',
      skills: ['Unity', 'Unreal Engine (C++, Blueprints)', 'Gameplay Ability System (GAS)', 'Epic Online Services (EOS)', 'C#', 'C++', 'OpenXR', 'AR/VR Development', 'Apple Vision Pro', 'Spatial Computing', 'Zenject', 'Unity DOTS/ECS', 'SceneKit', 'Filament']
    },
    {
      title: 'Backend & Cloud',
      skills: ['Node.js', 'REST APIs', 'Firebase', 'Azure', 'AWS', 'PlayFab', 'Nakama', 'Photon', 'Mirror Networking']
    },
    {
      title: 'AI & Emerging Technologies',
      skills: ['AI Integration', 'NLP Applications', 'Image Recognition', 'AI-Assisted Development', 'Real-Time AI Experiences']
    },
    {
      title: 'Architecture & Optimization',
      skills: ['System Design', 'Performance Optimization', 'Scalability', 'Multiplayer Architecture', 'LiveOps', 'Unity Test Framework', 'Quality Assurance', 'CI/CD']
    },
    {
      title: 'Tools',
      skills: ['Git', 'GitHub', 'Azure DevOps', 'Jira', 'Postman', 'Xcode', 'Android Studio']
    }
  ];

  experiences: Experience[] = [
    {
      company: 'NetConnect Global',
      role: 'Senior Software Engineer',
      location: 'Mumbai',
      duration: '01/2026 – Present',
      bullets: [
        'Built and enhanced browser-based interactive 3D planogram solutions using Angular and Three.js for AB InBev retail visualization.',
        'Developed configurable 3D fixture creation and product-positioning systems supporting accurate real-world retail layout simulation.',
        'Optimized real-time 3D scenes, draw calls, and rendering performance for large-scale store environments, delivering smooth 60fps user experiences.',
        'Designed interactive 3D visualization workflows that improved merchandising planning efficiency and reduced manual store setup effort.',
        'Worked across 3D scene architecture, object placement, visualization logic, and browser-based rendering workflows.'
      ],
      games: [
        {
          name: 'CatExpert',
          links: [
            { label: 'Detail', url: 'https://catexpert.ab-inbev.com/home', type: 'website' }
          ],
          techStack: 'Three.js, Angular'
        }
      ]
    },
    {
      company: 'Dreambridge',
      role: 'Senior Interaction Developer',
      location: 'Mumbai',
      duration: '04/2024 – 01/2026',
      bullets: [
        'Led development of an award-winning Apple Vision Pro spatial computing application for TCS (awarded two Gold Awards at NY Digital Awards 2024); engineered an interactive digital twin platform in Unity enabling real-time 3D anatomical models and spatial healthcare analytics.',
        'Implemented cross-platform XR hand-tracking, grab, gesture, and spatial interaction mechanics in Unity adhering to OpenXR standards.',
        'Designed and developed enterprise-grade real-time 3D applications and interactive simulations using Unreal Engine, Unity, Three.js, Angular, and C++/C#.',
        'Applied GPU rendering, custom shader programming, 3D mathematics, and scene optimization to deliver high-fidelity spatial experiences.',
        'Developed a multiplayer Apple Vision Pro experience using Photon, enabling multiple concurrent users to interact in a shared spatial environment.',
        'Integrated real-time cloud data and enterprise backend microservices hosted on AWS and Azure using WebSockets and REST APIs, validated and tested using Postman.',
        'Developed an interactive 3D CNC machine part visualization platform for Apple Vision Pro, Angular, and Three.js, enabling component inspection and spare-part procurement.',
        'Engineered an interactive AI-powered web application using Node.js, enabling real-time conversations with live AI characters through dynamic speech and NLP.',
        'Developed a full-featured event management application for Walmart using Ionic, Capacitor, and SQLite, featuring encrypted offline data storage and REST API synchronization.'
      ],
      games: [
        {
          name: 'Digital Twin',
          imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/applevision.png',
          links: [
            { label: 'Detail', url: 'https://www.linkedin.com/posts/tata-consultancy-services-north-america_tcsnycmarathon-runwithtcs-runwithtcsinnyc-ugcPost-7258484777668743169-vD4l/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAduOT4BroteUiiLGXBzeJpj6T4oXuEQ0VY', type: 'detail' }
          ],
          techStack: 'Photoshop, Unity, C#, Blender, Xcode'
        },
        {
          name: 'CNC Machine',
          imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/applevision.png',
          links: [
            { label: 'Detail', url: 'https://www.linkedin.com/posts/thapasjoseph_augmentedreality-virtualreality-spatialcomputing-activity-7295082810858524673-hpVv?utm_source=share&utm_medium=member_desktop&rcm=ACoAAAduOT4BroteUiiLGXBzeJpj6T4oXuEQ0VY', type: 'detail' }
          ],
          techStack: 'Photoshop, Unity, C#, Blender, Xcode'
        }
      ]
    },
    {
      company: 'Tapmyads Technologies LTD',
      role: 'Senior Software Developer',
      location: 'Mumbai',
      duration: '12/2019 – 04/2024',
      bullets: [
        'Directed strategic product development and architecture for multiplayer gaming platforms using Nakama, Photon, and Mirror Networking, implementing server-authoritative state synchronization.',
        'Developed cross-platform gameplay systems in Unreal Engine (C++, Blueprints) for mobile (iOS/Android) and desktop titles, including gameplay mechanics, AI, Gameplay Ability System (GAS), Epic Online Services (EOS), UMG-based UI, and runtime performance optimization.',
        'Developed immersive applications and real-time interactive visualization experiences using Unreal Engine for AR and cross-platform 3D simulations.',
        'Architected scalable game systems in Unity utilizing Zenject for dependency injection, ensuring decoupled, testable, and maintainable production codebases.',
        'Developed server-side game logic for multiplayer titles using Lua and JavaScript, ensuring synchronized gameplay and preventing unauthorized client tampering.',
        'Built comprehensive LiveOps frameworks integrating PlayFab, Firebase, and AWS for remote configuration, seasonal events, rewards, promotions, and player analytics.',
        'Created custom shaders and advanced rendering systems in Unreal Engine, Unity, SceneKit, and Filament, optimizing GPU performance across multiple shipped titles.',
        'Extended engine functionalities with custom plugins and SDK integrations (Unreal Engine, Unity) and built native deployment packages (Swift/Xcode, Android Studio).',
        'Led engineering teams across diverse tech stacks while enforcing high architectural standards, code reviews, and automated CI/CD pipelines.'
      ],
      games: [
        {
          name: 'Avataryug',
          imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/AYlogo.webp',
          links: [
            { label: 'Detail', url: 'https://avataryug.com/showcase', type: 'website' }
          ],
          techStack: 'Photoshop, Unity, C#, Rest API, Unreal Engine,Angular,Scenekit,swift,Android studio,Python,Blender'
        },
        {
          name: 'Pool Royale',
          imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/poolroyale.png',
          links: [
            { label: 'Detail', url: 'https://pool-royale-5r7.en.softonic.com/android?ex=RAMP-3507.3&rex=true', type: 'store' }
          ],
          techStack: 'Photoshop, Unity, C#, Playfab, Photon,'
        },
        {
          name: 'Billiards Pool Arena',
          imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/8ballarena.png',
          links: [
            { label: 'Detail', url: 'https://billiards-pool-arena.en.softonic.com/android?ex=RAMP-3507.3&rex=true', type: 'store' }
          ],
          techStack: 'Photoshop, Unity, C#, Rest API, Photon,'
        }
      ]
    },
    {
      company: 'Eduisfun Technology',
      role: 'Senior Game Developer',
      location: 'Mumbai',
      duration: '05/2019 – 11/2019',
      bullets: [
        'Directed the creation of interactive educational gaming platforms in Unity, improving learning engagement and digital user experiences.',
        'Implemented secure Unity Addressables to dynamically load grade-specific educational content with encrypted asset bundles, reducing initial app footprint and preventing asset tampering.',
        'Integrated and validated secure REST APIs with external backend services using Postman for endpoint testing and contract verification.',
        'Established automated unit testing practices using the Unity Test Framework, driving agile delivery via Jira and mentoring developers on coding standards.'
      ],
      games: [
        {
          name: 'StepApp',
          imageUrl: 'https://raw.githubusercontent.com/saitwalmayur/saitwalmayur/main/icon/stepapp.webp',
          links: [
            { label: 'Detail', url: 'https://play.google.com/store/apps/details?id=com.EduIsFun.EduIsFun&hl=en_IN', type: 'store' }
          ],
          techStack: 'Unity, C#, Addressable, Aws, Rest api'
        }
      ]
    },
    {
      company: 'Day Dreamz Studio',
      role: 'Senior Game Developer',
      location: 'Hyderabad',
      duration: '06/2017 – 04/2019',
      bullets: [
        'Delivered 50+ hyper-casual Unity games from concept to release, generating over 100,000 organic downloads across Android and iOS.',
        'Leveraged Unity DOTS/ECS and performance profiling (CPU/GPU/memory) to boost runtime efficiency by up to 40% on mid-range mobile devices.',
        'Built AI-driven NPC systems, responsive gameplay mechanics, and state machines, increasing player engagement and session duration.',
        'Implemented custom Unity Editor-based Level Editors in C# with automated data serialization, cutting level design iteration time by over 50%.',
        'Authored and published reusable Unity tools and plugins to the Unity Asset Store, establishing a dedicated passive revenue channel for the studio.',
        'Implemented local game data protection mechanisms using encryption, secure local persistence, and memory tampering validation.',
        'Expanded studio revenue through IAP receipt validation, Ad SDK monetization (AdMob, Chartboost), and OneSignal push notifications.'
      ],
      games: [
        { name: 'Archery Blast', links: [{ label: 'Detail', url: 'https://apkpure.com/archery-blast/com.daydreamzstudio.archeryblast', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Trampo Up', links: [{ label: 'Detail', url: 'https://apkpure.com/trampo-up/com.Feels.TrampoUp', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Drop the ball', links: [{ label: 'Detail', url: 'https://apkpure.com/drop-the-ball/com.feels.troopyshot', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Feels', links: [{ label: 'Detail', url: 'https://apkpure.com/5eels-cut-rope-games/com.feels.feels', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Soul Flower', links: [{ label: 'Detail', url: 'https://apkpure.com/playdead-inside/com.feels.soulflower', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Fight Club', links: [], techStack: 'Unity, C#' },
        { name: 'Snake Ballz 2', links: [{ label: 'Detail', url: 'https://apkpure.com/idle-snake-balls/com.daydreamzstudios.snakeballz2', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Thirsty Vampire', links: [{ label: 'Detail', url: 'https://www.amazon.com/DayDreamz-Studio-Thirsty-Vampire/dp/B073WWYBBD', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Angry Shark Racing', links: [{ label: 'Detail', url: 'https://www.amazon.com/DayDreamz-Studio-Angry-Shark-Racing/dp/B0751CJ8X8', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Klear', links: [{ label: 'Detail', url: 'https://apkpure.com/klear/com.daydreamzstudios.klear', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Flotus', links: [{ label: 'Detail', url: 'https://www.amazon.com/DayDreamz-Studio-Flotus/dp/B074DWZGCQ', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Wave Racer', links: [{ label: 'Detail', url: 'https://apkpure.com/wave-racer/com.daydreamzstudios.waveracer', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Shadow Dancer', links: [{ label: 'Detail', url: 'https://apkpure.com/shadow-dancer/com.daydreamzstudio.amazinghitmanrun', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Talking Santa Gifts', links: [{ label: 'Detail', url: 'https://www.amazon.com/DayDreamz-Studio-Talking-Santa-Gifts/dp/B0752PCQ99', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Dragon Trials', links: [{ label: 'Detail', url: 'https://apkpure.com/dragon-trials/com.daydreamzstudios.dragontrials', type: 'store' }], techStack: 'Unity, C#' },
        { name: 'Stickman Apple Shooter', links: [{ label: 'Detail', url: 'https://apkpure.com/stickman-apple-shooter/com.daydreamzstudios.stickmanappleshooter', type: 'store' }], techStack: 'Unity, C#' }
      ]
    },
    {
      company: 'Ace Games',
      role: 'Junior Game Developer',
      location: 'Hyderabad',
      duration: '06/2015 – 05/2017',
      bullets: [
        'Built reusable modular C# frameworks and UI systems for Unity3D, boosting team efficiency and project scalability.',
        'Implemented secure in-app purchase (IAP) receipt verification and server-side validation for Android and iOS, preventing fraudulent transactions.',
        'Managed monetization strategy with AdMob and Chartboost ad mediation alongside analytics integration, delivering consistent revenue gains.',
        'Played a pivotal role in publishing and deploying games on Android, iOS, and Windows platforms.'
      ],
      games: [
        { name: 'Bottle Shooter', imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/package-screenshot/d4198f30-efc5-4b36-8bee-383f156f0c9e.webp', links: [{ label: 'Detail', url: 'https://assetstore.unity.com/packages/templates/bottle-shooter-89934', type: 'website' }], techStack: 'Unity 3D, C#' },
        { name: 'Ace Bike Stunts', imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/package-screenshot/4d8f99e2-edf9-4a7b-9f39-3969e9474f11.webp', links: [{ label: 'Detail', url: 'https://assetstore.unity.com/packages/templates/ace-bike-stunts-88565', type: 'website' }], techStack: 'Unity 3D, C#' },
        { name: 'Ace Fighter', imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/package-screenshot/25cec6cb-1d35-4500-b302-63421e7ebaee.webp', links: [{ label: 'Detail', url: 'https://assetstore.unity.com/packages/templates/ace-fighter-88101', type: 'website' }], techStack: 'Unity 3D, C#' },
        { name: 'Rocket Escape', imageUrl: 'https://assetstorev1-prd-cdn.unity3d.com/key-image/14f7b279-213f-43d9-9258-558d27907179.webp', links: [{ label: 'Detail', url: 'https://assetstore.unity.com/packages/templates/rocket-escape-78174', type: 'website' }], techStack: 'Unity 3D, C#' },
        { name: 'Nano Ninja Jump', links: [{ label: 'Detail', url: 'https://assetstore.unity.com/packages/templates/nano-ninja-jump-67653', type: 'website' }], techStack: 'Unity 3D, C#' },
        { name: 'Cycle Stunts', links: [{ label: 'Detail', url: 'https://assetstore.unity.com/packages/templates/cycle-stunts-88274', type: 'website' }], techStack: 'Unity 3D, C#' },
        { name: 'Krishna Murari Run', links: [{ label: 'Detail', url: 'https://krishna-murari-run.en.softonic.com/android', type: 'store' }], techStack: 'Unity 3D, C#' },
        { name: 'Strike A Can', links: [{ label: 'Detail', url: 'https://strike-a-can.en.softonic.com/android', type: 'store' }], techStack: 'Unity 3D, C#' },
        { name: 'City Hot Wheels Racer', links: [{ label: 'Detail', url: 'https://city-hot-wheels-racer.en.softonic.com/android', type: 'store' }], techStack: 'Unity 3D, C#' },
        { name: 'Jet Boat Rush', links: [{ label: 'Detail', url: 'https://jet-boat-rush.en.softonic.com/android', type: 'store' }], techStack: 'Unity 3D, C#' }
      ]
    }
  ];

  openInfo(game: Game) {
    this.selectedGame = game;
  }

  closeInfo() {
    this.selectedGame = null;
  }
}
