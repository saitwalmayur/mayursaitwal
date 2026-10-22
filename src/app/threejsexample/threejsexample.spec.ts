import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Threejsexample } from './threejsexample';

describe('Threejsexample', () => {
  let component: Threejsexample;
  let fixture: ComponentFixture<Threejsexample>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Threejsexample],
    }).compileComponents();

    fixture = TestBed.createComponent(Threejsexample);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
