import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { catchError, Observable, of } from 'rxjs';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private http = inject(HttpClient);
  private swPush = inject(SwPush);
  private auth = inject(Auth);

  // readonly apiUrl = 'http://localhost:5094/api/voucher/payment';
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/payment';

  // ── Push subscription ──────────────────
  async subscribeToPush(): Promise<boolean> {
    if (!this.swPush.isEnabled) {
      console.warn('[Push] SwPush is NOT enabled');
      return false;
    }
    try {
      const keyRes: any = await this.http.get(`${this.apiUrl}/vapid-public-key`).toPromise();
      console.log('[Push] VAPID key fetched:', keyRes.publicKey?.substring(0, 20) + '...');

      console.log('[Push] Requesting subscription...');
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: keyRes.publicKey,
      });
      console.log('[Push] Subscription created:', sub.endpoint);

      const userId = this.auth.getUserId();
      console.log('[Push] Saving subscription for:', userId);
      const keys = sub.toJSON().keys as any;

      const res: any = await this.http
        .post(`${this.apiUrl}/subscribe`, {
          studentId: userId, // ← fixed from userId to studentId
          endpoint: sub.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        })
        .toPromise();

      console.log('[Push] Backend response:', res);
      return true;
    } catch (e: any) {
      // Log the full error details
      console.error('[Push] Subscription failed:', e);
      console.error('[Push] Error name:', e?.name);
      console.error('[Push] Error message:', e?.message);
      return false;
    }
  }

  // ── Seller initiates payment ───────────
  initiatePayment(studentId: string, amount: number): Observable<any> {
    const sellerUsername = this.auth.getUserId();
    return this.http
      .post(`${this.apiUrl}/initiate`, { studentId, amount, sellerUsername })
      .pipe(catchError((err) => of(err.error)));
  }

  // ── Poll payment status ────────────────
  getPaymentStatus(paymentId: string): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/status/${paymentId}`)
      .pipe(catchError((err) => of(err.error)));
  }

  // ── Student polls pending payments ─────
  getPendingPayments(studentId: string): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/pending?studentId=${studentId}`)
      .pipe(catchError((err) => of(err.error)));
  }

  // ── Student approves ───────────────────
  approvePayment(paymentId: string, studentId: string): Observable<any> {
    const headers = { 'content-type': 'application/json' };

    return this.http
      .post(`${this.apiUrl}/approve/${paymentId}`, JSON.stringify(studentId), { headers: headers })
      .pipe(catchError((err) => of(err.error)));
  }

  // ── Student rejects ────────────────────
  rejectPayment(paymentId: string, studentId: string): Observable<any> {
    const headers = { 'content-type': 'application/json' };

    return this.http
      .post(`${this.apiUrl}/reject/${paymentId}`, JSON.stringify(studentId), { headers: headers })
      .pipe(catchError((err) => of(err.error)));
  }
}
