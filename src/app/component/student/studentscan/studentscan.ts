import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Auth } from '../../../services/auth';
import { Staff } from '../../../services/staff';
import { Subject, takeUntil } from 'rxjs';
import { Student } from '../../../services/student';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Seller } from '../../../services/seller';
import { SharedService } from '../../../services/shared-service';

type ScanState = 'idle' | 'scanning' | 'confirming' | 'processing' | 'success' | 'error';
@Component({
  selector: 'app-studentscan',
  imports: [CommonModule, FormsModule],
  templateUrl: './studentscan.html',
  styleUrl: './studentscan.css',
})
export class Studentscan implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('amountInput') amountInput!: ElementRef<HTMLInputElement>;

  private auth = inject(Auth);
  private studentService = inject(Student);
  private sellerService = inject(Seller);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private sharedService = inject(SharedService);
  studentId = '';
  private payAmountCents = 0;
  constructor() {
    this.studentId = this.auth.getUserId();
  }

  // ── State ──────────────────────────────
  scanState: ScanState = 'idle';
  stream: MediaStream | null = null;
  animFrame: number | null = null;

  // ── Scanned seller data ────────────────
  scannedSellerId = '';
  scannedSellerName = '';
  scannedSellerUsername = ''; // ← store username for API call
  isValidatingSeller = false;
  sellerValidError = '';

  // ── Payment ───────────────────────────
  payAmount = 0;
  payError = '';
  successMsg = '';
  currentBalance = 0;

  // ── Confirm modal ─────────────────────
  showConfirmModal = false;

  // ── Success summary ───────────────────
  paymentSummary: {
    amount: number;
    sellerName: string;
    newBalance: number;
    paidAt: Date;
  } | null = null;
  dismissCountdown = 10;
  dismissTimer: any = null;

  // ── jsQR ──────────────────────────────
  private jsQR: any = null;

  ngOnInit(): void {
    this.loadJsQr();
    this.loadBalance();
    this.studentId = this.auth.getUserId();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get formattedPayAmount(): string {
    if (this.payAmountCents === 0) return '';
    return (this.payAmountCents / 100).toFixed(2);
  }

  onPayAmountKeydown(event: KeyboardEvent): void {
    event.preventDefault();

    if (event.key >= '0' && event.key <= '9') {
      if (this.payAmountCents < 999999) {
        this.payAmountCents = this.payAmountCents * 10 + parseInt(event.key);
        this.payAmount = this.payAmountCents / 100;
      }
    } else if (event.key === 'Backspace') {
      this.payAmountCents = Math.floor(this.payAmountCents / 10);
      this.payAmount = this.payAmountCents > 0 ? this.payAmountCents / 100 : 0;
    }

    this.payError = '';
    this.cdr.markForCheck();
  }

  setPayQuickAmount(amt: number): void {
    this.payAmountCents = amt * 100;
    this.payAmount = amt;
    this.payError = '';
    setTimeout(() => this.amountInput?.nativeElement?.focus(), 50);
    this.cdr.markForCheck();
  }

  // ── Load jsQR dynamically ─────────────
  loadJsQr(): void {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = () => {
      this.jsQR = (window as any).jsQR;
    };
    document.head.appendChild(script);
  }

  loadBalance(): void {
    // console.log(this.studentId);
    this.studentService
      .getBalance(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.currentBalance = res.data?.balance || 0;
          // console.log(this.currentBalance);
          this.cdr.markForCheck();
        },
      });
  }

  // ── Camera ────────────────────────────
  async startCamera(): Promise<void> {
    this.scanState = 'scanning';
    this.sellerValidError = '';
    this.scannedSellerId = '';
    this.cdr.markForCheck();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      // Wait for DOM
      setTimeout(() => {
        if (this.videoRef?.nativeElement) {
          this.videoRef.nativeElement.srcObject = this.stream;
          this.videoRef.nativeElement.play();
          this.scanLoop();
        }
      }, 100);
    } catch {
      this.scanState = 'error';
      this.payError = 'Camera access denied. Please allow camera permission.';
      this.cdr.markForCheck();
    }
  }

  stopCamera(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  // ── Scan loop ─────────────────────────
  scanLoop(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas || !this.jsQR) {
      this.animFrame = requestAnimationFrame(() => this.scanLoop());
      return;
    }

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = this.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code?.data) {
        this.onQrDetected(code.data);
        return; // stop loop after detection
      }
    }

    this.animFrame = requestAnimationFrame(() => this.scanLoop());
  }
  restApi: any = [];
  validateSeller(sellerName: any): boolean {
    this.sellerService.getSellerList(1, 10, sellerName).subscribe({
      next: (res: any) => {
        this.restApi = res.pagination.totalCount;
      },
    });
    if (this.restApi == 1) {
      return true;
    }
    return true;
  }

  // ── QR detected ───────────────────────
  // onQrDetected(data: string): void {
  //   this.stopCamera();
  //   this.isValidatingSeller = true;
  //   this.scanState = 'confirming';
  //   this.cdr.markForCheck();

  //   this.validateSeller(data);
  // }
  onQrDetected(data: string): void {
    this.stopCamera();
    this.isValidatingSeller = true;
    this.scanState = 'confirming';
    this.payAmountCents = 0; // ← reset on new scan
    this.payAmount = 0;
    this.cdr.markForCheck();

    this.sellerService
      .getSellerList(1, 10, data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const sellers = res?.pagination?.data || res?.data || [];
          const totalCount = res?.pagination?.totalCount;

          if (totalCount === 1 && sellers.length > 0) {
            const seller = sellers[0];
            this.scannedSellerId = seller.s_id; // adjust to your actual field names
            this.scannedSellerName = seller.s_name || seller.username;
            this.scannedSellerUsername = seller.username; // ← store username
            this.isValidatingSeller = false;
            this.scanState = 'confirming';

            // Auto-focus amount input after render
            setTimeout(() => this.amountInput?.nativeElement?.focus(), 150);
            this.cdr.markForCheck();
          } else {
            // No seller found — show error
            this.sellerValidError = 'This QR code does not belong to a registered seller.';
            this.isValidatingSeller = false;
            this.scanState = 'error';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.sellerValidError = 'Could not validate seller. Please try again.';
          this.isValidatingSeller = false;
          this.scanState = 'error';
          this.cdr.markForCheck();
        },
      });
  }

  // // ── Payment ───────────────────────────
  // confirmPayment(): void {
  //   if (!this.payAmount || this.payAmount <= 0) {
  //     this.payError = 'Please enter a valid amount.';
  //     return;
  //   }
  //   // if (this.payAmount > this.currentBalance) {
  //   //   this.payError = 'Insufficient balance.';
  //   //   return;
  //   // }
  //   this.showConfirmModal = false;

  //   this.scanState = 'processing';
  //   this.payError = '';
  //   this.cdr.markForCheck();

  //   this.studentService
  //     .studentPay(this.studentId, this.scannedSellerName, this.payAmount)
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe({
  //       next: (res: any) => {
  //         // console.log(res);
  //         if (res?.success !== false) {
  //           this.successMsg =
  //             res?.message || `RM ${this.payAmount.toFixed(2)} paid to ${this.scannedSellerName}`;
  //           // this.currentBalance -= this.payAmount;
  //           this.ngOnInit();
  //           this.scanState = 'success';
  //         } else {
  //           this.payError = res?.message || 'Payment failed.';
  //           this.scanState = 'confirming';
  //         }
  //         this.cdr.markForCheck();
  //       },
  //       error: (err: any) => {
  //         this.payError = err?.error?.message || 'Payment failed. Please try again.';
  //         this.scanState = 'confirming';
  //         this.cdr.markForCheck();
  //       },
  //     });
  // }

  // ── Open confirm modal ────────────────
  openConfirmModal(): void {
    if (!this.payAmount || this.payAmount <= 0) {
      this.payError = 'Please enter a valid amount.';
      return;
    }
    if (this.payAmount > this.currentBalance) {
      this.payError = 'Insufficient balance.';
      return;
    }
    this.payError = '';
    this.showConfirmModal = true;
    this.cdr.markForCheck();
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.cdr.markForCheck();
  }

  // ── Confirm and pay ───────────────────
  confirmPayment(): void {
    this.showConfirmModal = false;
    this.scanState = 'processing';
    this.cdr.markForCheck();

    this.studentService
      .studentPay(this.studentId, this.scannedSellerUsername, this.payAmount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success !== false && res?.success !== undefined ? res.success : res?.data) {
            // Build payment summary
            this.paymentSummary = {
              amount: this.payAmount,
              sellerName: this.scannedSellerName,
              newBalance: res?.data?.balance ?? this.currentBalance - this.payAmount,
              paidAt: new Date(),
            };
            this.currentBalance = this.paymentSummary.newBalance;
            this.sharedService.trigger();
            this.scanState = 'success';
            this.startDismissTimer();
          } else {
            this.payError = res?.message || 'Payment failed.';
            this.scanState = 'confirming';
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.payError = err?.error?.message || 'Payment failed. Please try again.';
          this.scanState = 'confirming';
          this.cdr.markForCheck();
        },
      });
  }

  // ── Auto-dismiss timer ────────────────
  startDismissTimer(): void {
    this.dismissCountdown = 10;
    this.dismissTimer = setInterval(() => {
      this.dismissCountdown--;
      this.cdr.markForCheck();
      if (this.dismissCountdown <= 0) {
        this.clearDismissTimer();
        this.resetScan();
      }
    }, 1000);
  }

  clearDismissTimer(): void {
    if (this.dismissTimer) {
      clearInterval(this.dismissTimer);
      this.dismissTimer = null;
    }
  }

  dismissSuccess(): void {
    this.clearDismissTimer();
    this.resetScan();
  }

  // ── Reset ─────────────────────────────
  resetScan(): void {
    this.stopCamera();
    this.clearDismissTimer();
    this.scanState = 'idle';
    this.scannedSellerId = '';
    this.scannedSellerName = '';
    this.scannedSellerUsername = '';
    this.payAmount = 0;
    this.payAmountCents = 0; // ← add this
    this.payError = '';
    this.sellerValidError = '';
    this.paymentSummary = null;
    this.showConfirmModal = false;
    this.isValidatingSeller = false;
    this.loadBalance();
    this.cdr.markForCheck();
  }
}
