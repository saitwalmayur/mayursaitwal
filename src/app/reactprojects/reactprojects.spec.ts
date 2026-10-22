import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Reactprojects } from './reactprojects';

describe('Reactprojects', () => {
  let component: Reactprojects;
  let fixture: ComponentFixture<Reactprojects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reactprojects],
    }).compileComponents();

    fixture = TestBed.createComponent(Reactprojects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
