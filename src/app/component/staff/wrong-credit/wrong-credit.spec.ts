import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WrongCredit } from './wrong-credit';

describe('WrongCredit', () => {
  let component: WrongCredit;
  let fixture: ComponentFixture<WrongCredit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WrongCredit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WrongCredit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
