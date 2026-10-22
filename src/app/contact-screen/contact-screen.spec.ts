import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactScreen } from './contact-screen';

describe('ContactScreen', () => {
  let component: ContactScreen;
  let fixture: ComponentFixture<ContactScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactScreen],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
