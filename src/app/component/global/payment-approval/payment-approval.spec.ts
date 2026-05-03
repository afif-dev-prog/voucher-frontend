import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentApproval } from './payment-approval';

describe('PaymentApproval', () => {
  let component: PaymentApproval;
  let fixture: ComponentFixture<PaymentApproval>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentApproval]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentApproval);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
