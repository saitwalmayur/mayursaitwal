import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ludogame } from './ludogame';

describe('Ludogame', () => {
  let component: Ludogame;
  let fixture: ComponentFixture<Ludogame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ludogame],
    }).compileComponents();

    fixture = TestBed.createComponent(Ludogame);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
