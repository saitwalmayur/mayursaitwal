import {
  Component,
  ElementRef,
  HostListener,
  input,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-top-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './top-panel.html',
  styleUrl: './top-panel.scss',
})
export class TopPanel {
  isCompact = input<boolean>(false);
  menuOpen = signal(false);

  private elementRef = inject(ElementRef);

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.menuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }
}

