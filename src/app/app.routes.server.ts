import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'threejs/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'threejs',
    renderMode: RenderMode.Client,
  },
  {
    path: 'threejsexample',
    renderMode: RenderMode.Client,
  },
  {
    path: 'threejsshader',
    renderMode: RenderMode.Client,
  },
  {
    path: 'threedmodelviewer',
    renderMode: RenderMode.Client,
  },
  {
    path: 'audiovisulizer',
    renderMode: RenderMode.Client,
  },
  {
    path: 'threejsparticleeffects',
    renderMode: RenderMode.Client,
  },
  {
    path: 'threejschess',
    renderMode: RenderMode.Client,
  },
  {
    path: 'chessgame',
    renderMode: RenderMode.Client,
  },
  {
    path: 'openworld',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
