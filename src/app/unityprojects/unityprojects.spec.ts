import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Unityprojects } from './unityprojects';

describe('Unityprojects', () => {
  let component: Unityprojects;
  let fixture: ComponentFixture<Unityprojects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Unityprojects],
    }).compileComponents();

    fixture = TestBed.createComponent(Unityprojects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
