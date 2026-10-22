import { Component } from '@angular/core';
import { Threejschess } from '../threejschess/threejschess';

@Component({
  selector: 'app-chessgame',
  imports: [Threejschess],
  template: `<app-threejschess></app-threejschess>`,
  styles: [
    `
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      }
    `,
  ],
})
export class Chessgame {}
