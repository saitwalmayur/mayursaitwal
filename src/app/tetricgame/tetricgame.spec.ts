import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tetricgame } from './tetricgame';

describe('Tetricgame', () => {
  let component: Tetricgame;
  let fixture: ComponentFixture<Tetricgame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tetricgame],
    }).compileComponents();

    fixture = TestBed.createComponent(Tetricgame);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
