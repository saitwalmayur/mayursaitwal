import { Routes } from '@angular/router';
import { HomeScreen } from './home-screen/home-screen';
import { ContactScreen } from './contact-screen/contact-screen';
import { ExperienceScreen } from './experience-screen/experience-screen';
import { Projects } from './projects/projects';
import { Showcase } from './showcase/showcase';

export const routes: Routes = [
  { path: '', component: HomeScreen, title: 'Home | Mayur Saitwal' },
  { path: 'experience', component: ExperienceScreen, title: 'Experience | Mayur Saitwal' },
  { path: 'projects', component: Projects, title: 'Projects | Mayur Saitwal' },
  { path: 'showcase', component: Showcase, title: 'Showcase | Mayur Saitwal' },
  { path: 'contact', component: ContactScreen, title: 'Contact | Mayur Saitwal' },
  {
    path: 'threejs',
    title: 'Three.js Demo | Mayur Saitwal',
    loadComponent: () => import('./threejsexample/threejsexample').then((m) => m.Threejsexample),
  },
  {
    path: 'threejsexample',
    title: 'Three.js Demo | Mayur Saitwal',
    loadComponent: () => import('./threejsexample/threejsexample').then((m) => m.Threejsexample),
  },
  {
    path: 'threejs/shaders',
    title: 'Three.js Shaders | Mayur Saitwal',
    loadComponent: () => import('./threejsshader/threejsshader').then((m) => m.Threejsshader),
  },
  {
    path: 'threejsshader',
    title: 'Three.js Shaders | Mayur Saitwal',
    loadComponent: () => import('./threejsshader/threejsshader').then((m) => m.Threejsshader),
  },
  {
    path: 'threejs/model-viewer',
    title: '3D Model Viewer | Mayur Saitwal',
    loadComponent: () => import('./threedmodelviewer/threedmodelviewer').then((m) => m.Threedmodelviewer),
  },
  {
    path: 'threedmodelviewer',
    title: '3D Model Viewer | Mayur Saitwal',
    loadComponent: () => import('./threedmodelviewer/threedmodelviewer').then((m) => m.Threedmodelviewer),
  },
  {
    path: 'threejs/audio-visualizer',
    title: 'Audio Visualizer | Mayur Saitwal',
    loadComponent: () => import('./audiovisulizer/audiovisulizer').then((m) => m.Audiovisulizer),
  },
  {
    path: 'audiovisulizer',
    title: 'Audio Visualizer | Mayur Saitwal',
    loadComponent: () => import('./audiovisulizer/audiovisulizer').then((m) => m.Audiovisulizer),
  },
  {
    path: 'threejs/particles',
    title: 'Particle Effects | Mayur Saitwal',
    loadComponent: () => import('./threejsparticleeffects/threejsparticleeffects').then((m) => m.Threejsparticleeffects),
  },
  {
    path: 'threejsparticleeffects',
    title: 'Particle Effects | Mayur Saitwal',
    loadComponent: () => import('./threejsparticleeffects/threejsparticleeffects').then((m) => m.Threejsparticleeffects),
  },
  {
    path: 'threejs/chess',
    title: 'Three.js Chess | Mayur Saitwal',
    loadComponent: () => import('./threejschess/threejschess').then((m) => m.Threejschess),
  },
  {
    path: 'threejschess',
    title: 'Three.js Chess | Mayur Saitwal',
    loadComponent: () => import('./threejschess/threejschess').then((m) => m.Threejschess),
  },
  {
    path: 'chessgame',
    title: 'Chess Game | Mayur Saitwal',
    loadComponent: () => import('./threejschess/threejschess').then((m) => m.Threejschess),
  },
  {
    path: 'threejs/openworld',
    title: 'Procedural Open World | Mayur Saitwal',
    loadComponent: () => import('./openworld/openworld').then((m) => m.Openworld),
  },
  {
    path: 'openworld',
    title: 'Procedural Open World | Mayur Saitwal',
    loadComponent: () => import('./openworld/openworld').then((m) => m.Openworld),
  },
  {
    path: 'threejs/lowpolyopenworld',
    title: 'Low-Poly Open World | Mayur Saitwal',
    loadComponent: () => import('./lowpolyopenworld/lowpolyopenworld').then((m) => m.Lowpolyopenworld),
  },
  {
    path: 'lowpolyopenworld',
    title: 'Low-Poly Open World | Mayur Saitwal',
    loadComponent: () => import('./lowpolyopenworld/lowpolyopenworld').then((m) => m.Lowpolyopenworld),
  },
  {
    path: 'unity',
    title: 'Unity 3D | Mayur Saitwal',
    loadComponent: () => import('./unityprojects/unityprojects').then((m) => m.Unityprojects),
  },
  {
    path: 'unityprojects',
    title: 'Unity 3D | Mayur Saitwal',
    loadComponent: () => import('./unityprojects/unityprojects').then((m) => m.Unityprojects),
  },
  {
    path: 'unreal',
    title: 'Unreal Engine | Mayur Saitwal',
    loadComponent: () => import('./unrealprojects/unrealprojects').then((m) => m.Unrealprojects),
  },
  {
    path: 'unrealprojects',
    title: 'Unreal Engine | Mayur Saitwal',
    loadComponent: () => import('./unrealprojects/unrealprojects').then((m) => m.Unrealprojects),
  },
  {
    path: 'threejs/ludo',
    title: '3D Ludo Game | Mayur Saitwal',
    loadComponent: () => import('./ludogame/ludogame').then((m) => m.Ludogame),
  },
  {
    path: 'ludo',
    title: '3D Ludo Game | Mayur Saitwal',
    loadComponent: () => import('./ludogame/ludogame').then((m) => m.Ludogame),
  },
  {
    path: 'ludogame',
    title: '3D Ludo Game | Mayur Saitwal',
    loadComponent: () => import('./ludogame/ludogame').then((m) => m.Ludogame),
  },
  {
    path: 'threejs/tictactoe',
    title: '3D Tic-Tac-Toe | Mayur Saitwal',
    loadComponent: () => import('./tictactoe/tictactoe').then((m) => m.Tictactoe),
  },
  {
    path: 'tictactoe',
    title: '3D Tic-Tac-Toe | Mayur Saitwal',
    loadComponent: () => import('./tictactoe/tictactoe').then((m) => m.Tictactoe),
  },
  {
    path: 'threejs/tetris',
    title: '3D Tetris Game | Mayur Saitwal',
    loadComponent: () => import('./threejstetris/threejstetris').then((m) => m.Threejstetris),
  },
  {
    path: 'tetris',
    title: '3D Tetris Game | Mayur Saitwal',
    loadComponent: () => import('./threejstetris/threejstetris').then((m) => m.Threejstetris),
  },
  {
    path: 'threejstetris',
    title: '3D Tetris Game | Mayur Saitwal',
    loadComponent: () => import('./threejstetris/threejstetris').then((m) => m.Threejstetris),
  },
  {
    path: 'babylonjs',
    title: 'Babylon.js 3D Showcase | Mayur Saitwal',
    loadComponent: () => import('./babylonjsexample/babylonjsexample').then((m) => m.Babylonjsexample),
  },
  {
    path: 'babylonjsexample',
    title: 'Babylon.js 3D Showcase | Mayur Saitwal',
    loadComponent: () => import('./babylonjsexample/babylonjsexample').then((m) => m.Babylonjsexample),
  },
  {
    path: 'babylonjs/element-table',
    title: '3D Periodic Table | Mayur Saitwal',
    loadComponent: () => import('./babylon/elementtable/elementtable').then((m) => m.Elementtable),
  },
  {
    path: 'babylonjs/room',
    title: 'Isometric Cozy Room 3D | Mayur Saitwal',
    loadComponent: () => import('./babylon/room/room').then((m) => m.Room),
  },
  {
    path: 'room',
    title: 'Isometric Cozy Room 3D | Mayur Saitwal',
    loadComponent: () => import('./babylon/room/room').then((m) => m.Room),
  },
  {
    path: 'babylonjs/openworld',
    title: 'Babylon.js Procedural Open World | Mayur Saitwal',
    loadComponent: () => import('./babylon/babylonopenworld/babylonopenworld').then((m) => m.Babylonopenworld),
  },
  {
    path: 'babylonopenworld',
    title: 'Babylon.js Procedural Open World | Mayur Saitwal',
    loadComponent: () => import('./babylon/babylonopenworld/babylonopenworld').then((m) => m.Babylonopenworld),
  },
];
