import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { TopPanel } from './top-panel/top-panel';
import { AnalyticsService } from './analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private analytics = inject(AnalyticsService); // initializes Firebase & starts tracking
  protected readonly title = signal('mayursaitwal');
  protected readonly isThreeJs = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        this.checkRoute(event.urlAfterRedirects || event.url);
      });

    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      this.checkRoute(window.location.pathname);
    } else {
      this.checkRoute(this.router.url);
    }
  }

  private checkRoute(url: string) {
    const isThree =
      url.includes('/threejs') ||
      url.includes('/threejsexample') ||
      url.includes('/threejsshader') ||
      url.includes('/threedmodelviewer') ||
      url.includes('/audiovisulizer') ||
      url.includes('/threejsparticleeffects') ||
      url.includes('/threejschess') ||
      url.includes('/chessgame') ||
      url.includes('/openworld') ||
      url.includes('/lowpolyopenworld') ||
      url.includes('/ludo') ||
      url.includes('/ludogame') ||
      url.includes('/tictactoe') ||
      url.includes('/tetris') ||
      url.includes('/threejstetris') ||
      url.includes('/babylonjs') ||
      url.includes('/babylonjsexample') ||
      url.includes('/room');

    this.isThreeJs.set(isThree);
  }
}
