import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Threejsparticleeffects } from './threejsparticleeffects';

describe('Threejsparticleeffects', () => {
  let component: Threejsparticleeffects;
  let fixture: ComponentFixture<Threejsparticleeffects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Threejsparticleeffects],
    }).compileComponents();

    fixture = TestBed.createComponent(Threejsparticleeffects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
