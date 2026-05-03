import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { PaymentService } from '../../../services/payment-service';
import { Auth } from '../../../services/auth';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-payment-received',
  imports: [],
  templateUrl: './payment-received.html',
  styleUrl: './payment-received.css',
})
export class PaymentReceived implements OnInit, OnDestroy {
  private paymentService = inject(PaymentService);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private $destroy = new Subject<void>();
  
  
  showPaymentReceived = false;
  isSuccess = false
  sellerUsername = ''
  ngOnInit(): void {
    this.sellerUsername = this.auth.getUserId();
  }
  ngOnDestroy(): void {}
}
