import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { PaymentService } from '../../../services/payment-service';
import { Auth } from '../../../services/auth';
import { Subject, takeUntil } from 'rxjs';
import { SwPush } from '@angular/service-worker';

@Component({
  selector: 'app-payment-received',
  imports: [],
  templateUrl: './payment-received.html',
  styleUrl: './payment-received.css',
})
export class PaymentReceived implements OnInit, OnDestroy {
  private swPush = inject(SwPush);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  toast: { title: string; message: string } | null = null;
  private dismissTimer: any;

  ngOnInit(): void {
    if (this.auth.getRole() !== 'SELLER') return;

    // Listen for push messages while app is in foreground
    this.swPush.messages.pipe(takeUntil(this.destroy$)).subscribe((msg: any) => {
      if (msg?.type === 'PAYMENT_RECEIVED') {
        this.showToast(msg.title, msg.message);
      }
    });
  }

  showToast(title: string, message: string): void {
    clearTimeout(this.dismissTimer);
    this.toast = { title, message };
    this.cdr.markForCheck();

    // Auto-dismiss after 5 seconds
    this.dismissTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.markForCheck();
    }, 5000);
  }

  dismiss(): void {
    clearTimeout(this.dismissTimer);
    this.toast = null;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.dismissTimer);
  }
}
