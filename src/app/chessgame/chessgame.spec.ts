import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chessgame } from './chessgame';

describe('Chessgame', () => {
  let component: Chessgame;
  let fixture: ComponentFixture<Chessgame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chessgame],
    }).compileComponents();

    fixture = TestBed.createComponent(Chessgame);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
