import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Threejsshader } from './threejsshader';

describe('Threejsshader', () => {
  let component: Threejsshader;
  let fixture: ComponentFixture<Threejsshader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Threejsshader],
    }).compileComponents();

    fixture = TestBed.createComponent(Threejsshader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
