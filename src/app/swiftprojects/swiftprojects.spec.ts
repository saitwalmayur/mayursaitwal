import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Swiftprojects } from './swiftprojects';

describe('Swiftprojects', () => {
  let component: Swiftprojects;
  let fixture: ComponentFixture<Swiftprojects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Swiftprojects],
    }).compileComponents();

    fixture = TestBed.createComponent(Swiftprojects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
