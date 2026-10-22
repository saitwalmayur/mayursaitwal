import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Unrealprojects } from './unrealprojects';

describe('Unrealprojects', () => {
  let component: Unrealprojects;
  let fixture: ComponentFixture<Unrealprojects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Unrealprojects],
    }).compileComponents();

    fixture = TestBed.createComponent(Unrealprojects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
