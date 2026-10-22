import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Babylonopenworld } from './babylonopenworld';

describe('Babylonopenworld', () => {
  let component: Babylonopenworld;
  let fixture: ComponentFixture<Babylonopenworld>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Babylonopenworld],
    }).compileComponents();

    fixture = TestBed.createComponent(Babylonopenworld);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
