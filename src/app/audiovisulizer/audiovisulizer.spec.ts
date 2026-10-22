import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Audiovisulizer } from './audiovisulizer';

describe('Audiovisulizer', () => {
  let component: Audiovisulizer;
  let fixture: ComponentFixture<Audiovisulizer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Audiovisulizer],
    }).compileComponents();

    fixture = TestBed.createComponent(Audiovisulizer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
