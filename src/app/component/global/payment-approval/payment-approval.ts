import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { interval, Subject, switchMap, takeUntil } from 'rxjs';
import { PaymentService } from '../../../services/payment-service';
import { Auth } from '../../../services/auth';
import { SharedService } from '../../../services/shared-service';

interface PendingPayment {
  id: string;
  seller_name: string;
  amount: number;
  status: string;
  seconds_remaining: number;
}
@Component({
  selector: 'app-payment-approval',
  imports: [CommonModule],
  templateUrl: './payment-approval.html',
  styleUrl: './payment-approval.css',
})
export class PaymentApproval implements OnInit, OnDestroy {
  private paymentService = inject(PaymentService);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private sharedService = inject(SharedService);

  pendingPayment: PendingPayment | null = null;
  isActing = false;
  lastAction = '';
  resultMsg = '';
  isSuccess = false;

  ngOnInit(): void {
    if (this.auth.getRole() !== 'STUDENT') return;
    const studentId = this.auth.getUserId();

    // Poll every 3 seconds for pending payments (iOS fallback + backup)
    interval(3000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.paymentService.getPendingPayments(studentId)),
      )
      .subscribe({
        next: (res: any) => {
          if (res?.data && res.data.status === 'pending') {
            this.pendingPayment = res.data;
          } else if (this.pendingPayment?.status === 'pending') {
            // Payment was resolved elsewhere (push notification action)
            this.pendingPayment = null;
          }
          this.cdr.markForCheck();
        },
      });

    // Also listen to SwPush messages for instant response
    // (handled in app.component via notificationClicks)
  }

  approve(): void {
    if (!this.pendingPayment) return;
    this.isActing = true;
    this.lastAction = 'approve';

    const studentId = this.auth.getUserId();

    this.paymentService.approvePayment(this.pendingPayment.id, studentId).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.isSuccess = true;
          this.resultMsg = 'Payment approved! ✓';
          this.sharedService.trigger();
          setTimeout(() => {
            this.pendingPayment = null;
            this.resultMsg = '';
          }, 2000);
        } else {
          this.isSuccess = false;
          this.resultMsg = res?.message || 'Failed to approve.';
          this.ngOnDestroy();
        }
        this.isActing = false;
        this.cdr.markForCheck();
      },
    });
  }

  reject(): void {
    if (!this.pendingPayment) return;
    this.isActing = true;
    this.lastAction = 'reject';

    const studentId = this.auth.getUserId();

    this.paymentService.rejectPayment(this.pendingPayment.id, studentId).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.isSuccess = false;
          this.resultMsg = 'Payment rejected.';
          this.sharedService.trigger();
          setTimeout(() => {
            this.pendingPayment = null;
            this.resultMsg = '';
          }, 1500);
        } else {
          this.isSuccess = false;
          this.resultMsg = res?.message || 'Failed to reject.';
        }
        this.isActing = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
