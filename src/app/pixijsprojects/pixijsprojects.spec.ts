import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pixijsprojects } from './pixijsprojects';

describe('Pixijsprojects', () => {
  let component: Pixijsprojects;
  let fixture: ComponentFixture<Pixijsprojects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pixijsprojects],
    }).compileComponents();

    fixture = TestBed.createComponent(Pixijsprojects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
