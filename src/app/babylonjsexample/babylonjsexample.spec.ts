import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Babylonjsexample } from './babylonjsexample';

describe('Babylonjsexample', () => {
  let component: Babylonjsexample;
  let fixture: ComponentFixture<Babylonjsexample>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Babylonjsexample],
    }).compileComponents();

    fixture = TestBed.createComponent(Babylonjsexample);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
