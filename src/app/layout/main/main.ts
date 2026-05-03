import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Menubar } from '../menubar/menubar';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { Auth } from '../../services/auth';
import { SwPush } from '@angular/service-worker';
import { PaymentService } from '../../services/payment-service';
import { PaymentApproval } from '../../component/global/payment-approval/payment-approval';

@Component({
  selector: 'app-main',
  imports: [Menubar, RouterModule, CommonModule, PaymentApproval],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnInit {
  title: string = 'Voucher';
  private router = inject(Router);
  private auth = inject(Auth);
  private swPush = inject(SwPush);
  private paymentService = inject(PaymentService);
  private cdr = inject(ChangeDetectorRef);
  showMenubar = false;

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      const hidden = ['/login', '/change-password', '/unauthorized', '/'];
      this.showMenubar = !hidden.includes(e.urlAfterRedirects);
    });
  }
  onRefresh() {
    window.location.reload(); // or re-fetch your voucher data
  }
  ngOnInit(): void {
    // ── On refresh: if logged in, redirect to correct dashboard ──
    const currentUrl = this.router.url;
    if (currentUrl === '/' || currentUrl === '/login') {
      if (this.auth.isLoggedIn()) {
        this.auth.redirectByRole();
      }
    }

    // Subscribe for both students AND sellers
    if (
      this.auth.isLoggedIn() &&
      (this.auth.getRole() === 'STUDENT' || this.auth.getRole() === 'SELLER')
    ) {
      this.paymentService.subscribeToPush().catch();
    }

    // Listen for push notification clicks from SwPush
    this.swPush.notificationClicks.subscribe(({ action, notification }) => {
      const studentId = this.auth.getUserId();
      const paymentId = notification.data?.paymentId;
      if (!paymentId) return;

      if (action === 'approve') {
        this.paymentService.approvePayment(paymentId, studentId).subscribe();
      } else if (action === 'reject') {
        this.paymentService.rejectPayment(paymentId, studentId).subscribe();
      }
    });
  }
}
