import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Elementtable } from './elementtable';

describe('Elementtable', () => {
  let component: Elementtable;
  let fixture: ComponentFixture<Elementtable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Elementtable],
    }).compileComponents();

    fixture = TestBed.createComponent(Elementtable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
