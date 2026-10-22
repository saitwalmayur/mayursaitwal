import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Lowpolyopenworld } from './lowpolyopenworld';

describe('Lowpolyopenworld', () => {
  let component: Lowpolyopenworld;
  let fixture: ComponentFixture<Lowpolyopenworld>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Lowpolyopenworld],
    }).compileComponents();

    fixture = TestBed.createComponent(Lowpolyopenworld);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
