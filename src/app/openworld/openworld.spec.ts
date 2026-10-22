import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Openworld } from './openworld';

describe('Openworld', () => {
  let component: Openworld;
  let fixture: ComponentFixture<Openworld>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Openworld],
    }).compileComponents();

    fixture = TestBed.createComponent(Openworld);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
