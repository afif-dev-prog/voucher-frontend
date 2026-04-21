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

  private auth = inject(Auth);
  private studentService = inject(Student);
  private sellerService = inject(Seller);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  studentId = '';
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
  isValidatingSeller = false;
  sellerValidError = '';

  // ── Payment ───────────────────────────
  payAmount = 0;
  payError = '';
  successMsg = '';
  currentBalance = 0;

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
    console.log(this.studentId);
    this.studentService
      .getBalance(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.currentBalance = res.data?.balance || 0;
          console.log(this.currentBalance);
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
  onQrDetected(data: string): void {
    this.stopCamera();
    this.isValidatingSeller = true;
    this.scanState = 'confirming';
    this.cdr.markForCheck();

    this.validateSeller(data);
  }

  // ── Payment ───────────────────────────
  confirmPayment(): void {
    if (!this.payAmount || this.payAmount <= 0) {
      this.payError = 'Please enter a valid amount.';
      return;
    }
    if (this.payAmount > this.currentBalance) {
      this.payError = 'Insufficient balance.';
      return;
    }

    this.scanState = 'processing';
    this.payError = '';
    this.cdr.markForCheck();

    this.studentService
      .studentPay(this.auth.getUserId(), this.scannedSellerId, this.payAmount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success !== false) {
            this.successMsg = `RM ${this.payAmount.toFixed(2)} paid to ${this.scannedSellerName}`;
            this.currentBalance -= this.payAmount;
            this.scanState = 'success';
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

  // ── Reset ─────────────────────────────
  resetScan(): void {
    this.stopCamera();
    this.scanState = 'idle';
    this.scannedSellerId = '';
    this.scannedSellerName = '';
    this.payAmount = 0;
    this.payError = '';
    this.sellerValidError = '';
    this.successMsg = '';
    this.isValidatingSeller = false;
    this.cdr.markForCheck();
  }
}
