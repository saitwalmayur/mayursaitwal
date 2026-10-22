import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Threedmodelviewer } from './threedmodelviewer';

describe('Threedmodelviewer', () => {
  let component: Threedmodelviewer;
  let fixture: ComponentFixture<Threedmodelviewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Threedmodelviewer],
    }).compileComponents();

    fixture = TestBed.createComponent(Threedmodelviewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
