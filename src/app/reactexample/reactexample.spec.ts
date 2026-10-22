import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Reactexample } from './reactexample';

describe('Reactexample', () => {
  let component: Reactexample;
  let fixture: ComponentFixture<Reactexample>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reactexample],
    }).compileComponents();

    fixture = TestBed.createComponent(Reactexample);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
