import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, logEvent, Analytics, setCurrentScreen } from 'firebase/analytics';
import { firebaseConfig } from './firebase.config';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  private app: FirebaseApp | null = null;
  private analytics: Analytics | null = null;

  constructor() {
    // Firebase Analytics only works in the browser (not SSR/server)
    if (isPlatformBrowser(this.platformId)) {
      this.initFirebase();
      this.logInitialPageView();
      this.trackRouteChanges();
    }
  }

  private initFirebase(): void {
    // Avoid re-initializing if already done (e.g. HMR)
    this.app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    this.analytics = getAnalytics(this.app);
  }

  /**
   * Log the very first page the user lands on.
   * Deferred by one tick (setTimeout 0) so Angular's TitleStrategy
   * has already set document.title before we read it.
   */
  private logInitialPageView(): void {
    setTimeout(() => {
      const initialPath = window.location.pathname + window.location.search;
      this.logPageView(initialPath);
    }, 0);
  }

  /** Listen for every Angular route change and log it */
  private trackRouteChanges(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        this.logPageView(event.urlAfterRedirects || event.url);
      });
  }

  /** Log a page_view event to Firebase Analytics */
  logPageView(url: string): void {
    if (!this.analytics) return;
    setCurrentScreen(this.analytics, url);
    logEvent(this.analytics, 'page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,   // reads route title set by Angular TitleStrategy
    });
  }

  /** Log any custom event */
  logCustomEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!this.analytics) return;
    logEvent(this.analytics, eventName, params);
  }
}
