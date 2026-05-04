import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Seller } from '../../../services/seller';
import { Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';
import { Auth } from '../../../services/auth';
import { PaymentService } from '../../../services/payment-service';
import { SharedService } from '../../../services/shared-service';

@Component({
  selector: 'app-scantopay',
  imports: [CommonModule, FormsModule],
  templateUrl: './scantopay.html',
  styleUrl: './scantopay.css',
})
export class Scantopay implements OnInit, OnDestroy {
  private sellerService = inject(Seller);
  private auth = inject(Auth);
  private trigger = inject(SharedService);
  private paymentService = inject(PaymentService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  sellerId: number = 0; // replace with actual seller ID from auth

  sellerUsername = '';
  sellerRes: any = [];

  paymentId = '';
  isWaitingApproval = false;
  approvalCountdown = 60;
  approvalTimer: any;
  approvalStatus = '';

  readonly apiUrl = 'http://localhost:5094/api/voucher/seller';

  constructor() {
    this.sellerUsername = this.auth.getUserId();
    // console.log(this.sellerUsername);
  }

  // Tabs
  activeTab: 'scan' | 'qr' = 'qr';

  // Camera / Scan
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('manualInput') manualInput!: ElementRef<HTMLInputElement>;
  isCameraActive = false;
  isCameraLoading = false;
  cameraError = '';
  private stream: MediaStream | null = null;
  private scanInterval: any = null;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('amountInput') amountInput!: ElementRef<HTMLInputElement>;
  @ViewChild('doneButton') doneButton!: ElementRef<HTMLButtonElement>;

  // Seller info (get from auth/session)

  // Payment modal (after scan)
  showPaymentModal = false;
  scannedStudentId = '';
  paymentAmount: number | null = null;
  paymentNote = '';
  isProcessing = false;
  paymentError = '';
  paymentSuccess = false;
  paymentResult: any = null;
  // Scanner detection
  private scanBuffer = '';
  private scanBufferTimer: any = null;
  readonly SCAN_THRESHOLD_MS = 100; // chars arriving faster than this = scanner
  isFromScanner = false;
  // QR modal
  showQrModal = false;
  qrImageUrl = '';
  isGeneratingQr = false;

  sellerName = '';

  // Add this state
  showInlineAmount = false;
  inlineAmount: number | null = null;
  inlineError = '';
  isInlineProcessing = false;

  ngOnInit(): void {
    this.sellerName = this.auth.getName();
    console.log(this.auth.getUserId());

    this.loadSellerData();
    if (this.activeTab === 'scan') {
      // ← add this block
      this.focusManualInput();
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.destroy$.next();
    this.destroy$.complete();
  }
  focusAmountInput(): void {
    setTimeout(() => {
      this.amountInput?.nativeElement?.focus();
    }, 50);
  }
  // submitPaymentDirect(studentId: string): void {
  //   this.scannedStudentId = studentId;
  //   this.showInlineAmount = true; // show a quick inline amount bar
  //   this.inlineAmount = null;
  //   this.inlineError = '';
  //   setTimeout(() => {
  //     (document.querySelector('.inline-amount-input') as HTMLInputElement)?.focus();
  //   }, 50);
  //   this.cdr.markForCheck();
  // }

  submitInlinePayment(): void {
    if (!this.inlineAmount || this.inlineAmount <= 0) {
      this.inlineError = 'Enter a valid amount.';
      return;
    }
    this.isInlineProcessing = true;
    this.inlineError = '';
    this.cdr.markForCheck();

    this.sellerService
      .scantoPay(this.scannedStudentId, this.sellerId, this.inlineAmount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) {
            const charged = this.inlineAmount; // ← save BEFORE resetting
            const studentId = this.scannedStudentId; // ← save BEFORE resetting

            this.showInlineAmount = false;
            this.scannedStudentId = '';
            this.inlineAmount = null;
            this.isInlineProcessing = false;

            this.lastScanSuccess = `✓ RM ${Number(charged).toFixed(2)} charged to ${studentId}`;
            setTimeout(() => {
              this.lastScanSuccess = '';
              this.focusManualInput();
              this.cdr.markForCheck();
            }, 2500);
          } else {
            this.inlineError = res.message || 'Payment failed.';
            this.isInlineProcessing = false;
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.inlineError = err?.error?.message || 'Something went wrong.';
          this.isInlineProcessing = false;
          this.cdr.markForCheck();
        },
      });
  }

  cancelInlinePayment(): void {
    this.showInlineAmount = false;
    this.scannedStudentId = '';
    this.inlineAmount = null;
    this.inlineError = '';
    this.focusManualInput();
    this.cdr.markForCheck();
  }

  lastScanSuccess = '';

  onManualInputChange(value: string): void {
    const now = Date.now();

    // Clear previous timer
    if (this.scanBufferTimer) {
      clearTimeout(this.scanBufferTimer);
    }

    this.scannedStudentId = value;

    // If characters arrive very fast, it's a scanner
    this.scanBufferTimer = setTimeout(() => {
      this.isFromScanner = false; // reset after human typing pause
    }, this.SCAN_THRESHOLD_MS);
  }

  onManualKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Enter') {
      const id = input.value.trim();
      if (!id) return;

      if (this.isFromScanner) {
        // Scanner hit Enter — go straight to payment, skip amount step
        this.scannedStudentId = id;
        this.submitPaymentDirect(id);
      } else {
        // Human pressed Enter — open modal to enter amount
        this.openPaymentModal(id);
      }
      return;
    }

    // Detect scanner: keystrokes arriving very rapidly
    const timeSinceLastKey = Date.now();
    if (this.lastKeyTime && timeSinceLastKey - this.lastKeyTime < this.SCAN_THRESHOLD_MS) {
      this.isFromScanner = true;
    }
    this.lastKeyTime = timeSinceLastKey;
  }

  submitPaymentDirect(studentId: string): void {
    // Open modal normally — scanner flow still needs an amount
    // But if your use case is fixed amount, replace with direct API call
    this.openPaymentModal(studentId);

    // If you want FULLY automatic with a preset amount (e.g. RM 1.00):
    // this.scannedStudentId = studentId;
    // this.paymentAmount = 1.00;
    // this.isProcessing = true;
    // this.sellerService.scantoPay(...).subscribe(...)
  }

  private lastKeyTime = 0;

  getSellerId(): number {
    this.sellerService.getSellerList(1, 10, this.sellerName).subscribe((res) => {
      this.sellerRes = res.data[0];
      // console.log(this.sellerRes);
    });
    return this.sellerId;
  }

  switchTab(tab: 'scan' | 'qr'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();

    if (tab === 'scan') {
      // setTimeout(() => this.startCamera(), 100);
      this.stopCamera();
      this.focusManualInput();
    } else {
      this.loadSellerQr(); // refresh QR URL when tab is opened
    }
  }

  onScanPanelClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const isInteractive = target.closest('button, input, .camera-viewport');
    if (!isInteractive) {
      this.focusManualInput();
    }
  }

  private focusManualInput(): void {
    setTimeout(() => {
      this.manualInput?.nativeElement?.focus();
    }, 100);
  }

  // ── CAMERA ─────────────────────────────────────
  //
  isButtonPressed = false;
  async startCamera(): Promise<void> {
    this.isButtonPressed = true;
    this.isCameraLoading = true;
    this.cameraError = '';
    this.cdr.markForCheck();

    // console.log('🎥 Requesting camera access...');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      this.isCameraLoading = false;
      this.isCameraActive = true;
      this.cdr.detectChanges();

      await new Promise((resolve) => setTimeout(resolve, 50));

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        await this.videoElement.nativeElement.play();
        // console.log('✅ Camera started successfully');
        this.startQrScanning(); // ← uses jsQR now
        this.cdr.markForCheck();
      }
    } catch (err: any) {
      // console.error('❌ Camera error:', err);
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.isCameraLoading = false;
      this.isCameraActive = false;
      this.cameraError =
        err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permission.'
          : err.name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : 'Unable to access camera: ' + err.message;
      this.cdr.markForCheck();
    }
  }

  // stopCamera(): void {
  //   if (this.scanInterval) {
  //     clearInterval(this.scanInterval);
  //     this.scanInterval = null;
  //   }
  //   if (this.stream) {
  //     this.stream.getTracks().forEach((t) => t.stop());
  //     this.stream = null;
  //   }
  //   this.isCameraActive = false;
  // }

  stopCamera(): void {
    if (this.videoElement?.nativeElement?.srcObject) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.videoElement.nativeElement.srcObject = null;
    }
    this.isCameraActive = false;
    this.cameraError = '';
  }

  // Scan QR from video frames using Canvas + BarcodeDetector API
  // startQrScanning(): void {
  //   if ('BarcodeDetector' in window) {
  //     console.log('✅ BarcodeDetector API available — auto scanning started');

  //     const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

  //     this.scanInterval = setInterval(async () => {
  //       if (!this.videoElement?.nativeElement || this.showPaymentModal) return;

  //       try {
  //         const barcodes = await detector.detect(this.videoElement.nativeElement);

  //         if (barcodes.length > 0) {
  //           console.log('🎯 QR Detected!', barcodes);
  //           console.log('📦 Raw value:', barcodes[0].rawValue);
  //           this.onQrDetected(barcodes[0].rawValue);
  //         }
  //       } catch (err) {
  //         console.warn('⚠️ Scan error:', err); // log errors instead of swallowing them
  //       }
  //     }, 500);
  //   } else {
  //     console.warn('❌ BarcodeDetector NOT available in this browser — using fallback');
  //     this.scanInterval = setInterval(() => {
  //       this.autoScanFrame();
  //     }, 800);
  //   }
  // }
  startQrScanning(): void {
    // console.log('📷 Starting jsQR scanning...');

    this.scanInterval = setInterval(() => {
      this.autoScanFrame();
    }, 300); // scan every 300ms
  }

  // autoScanFrame(): void {
  //   if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;
  //   if (this.showPaymentModal) return;

  //   const video = this.videoElement.nativeElement;
  //   const canvas = this.canvasElement.nativeElement;

  //   if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

  //   canvas.width = video.videoWidth;
  //   canvas.height = video.videoHeight;
  //   canvas.getContext('2d')!.drawImage(video, 0, 0);
  // }
  autoScanFrame(): void {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;
    if (this.showPaymentModal) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;

    // Video must be ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      // console.log('⏳ Video not ready yet...');
      return;
    }

    // Draw current video frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get pixel data and run jsQR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      // console.log('🎯 QR Detected!', code.data);
      this.onQrDetected(code.data);
    }
  }
  // Manual capture fallback
  captureFrame(): void {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    // Try BarcodeDetector on canvas
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      detector.detect(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          this.onQrDetected(barcodes[0].rawValue);
        } else {
          this.cameraError = 'No QR code detected. Try again.';
          setTimeout(() => {
            this.cameraError = '';
            this.cdr.markForCheck();
          }, 2000);
          this.cdr.markForCheck();
        }
      });
    }
  }

  onQrDetected(value: string): void {
    // console.log('🚀 onQrDetected called with:', value);

    if (this.showPaymentModal) {
      // console.log('⛔ Modal already open — ignoring scan');
      return;
    }

    // console.log('✅ Proceeding to payment modal...');
    this.stopCamera();
    this.scannedStudentId = value;
    this.openPaymentModal(value);
  }

  // ── PAYMENT MODAL ──────────────────────────────
  openPaymentModal(studentId: string): void {
    const id = studentId?.trim();
    if (!id) {
      this.cameraError = 'Please enter a Student ID first.';
      return;
    }
    this.scannedStudentId = studentId;
    this.paymentAmount = null;
    this.paymentError = '';
    this.paymentSuccess = false;
    this.paymentResult = null;
    this.showPaymentModal = true;
    this.cdr.markForCheck();

    // Auto-focus amount input after modal renders
    setTimeout(() => {
      this.amountInput?.nativeElement?.focus();
    }, 100);
  }

  closePaymentModal(): void {
    if (this.isProcessing) return; // ← don't close while processing

    // Clear student ID if payment was successful
    if (this.paymentSuccess) {
      this.scannedStudentId = '';
      this.showInlineAmount = false;
    }

    this.showPaymentModal = false;
    this.paymentAmount = null;
    this.paymentError = '';
    this.paymentSuccess = false;
    this.isProcessing = false;
    this.paymentResult = null;
    this.cdr.markForCheck();

    // Refocus manual input so seller can scan next student
    this.focusManualInput();
  }

  onPaymentBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      if (!this.isProcessing) this.closePaymentModal();
    }
  }

  submitPayment(): void {
    if (!this.paymentAmount || this.paymentAmount <= 0) {
      this.paymentError = 'Please enter a valid amount.';
      this.focusAmountInput(); // refocus so user can type
      return;
    }

    if (this.isProcessing) return; // ← prevent double submit on rapid Enter

    this.isProcessing = true;
    this.paymentError = '';
    this.cdr.markForCheck();

    this.sellerService
      .scantoPay(this.scannedStudentId, this.sellerId, this.paymentAmount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) {
            this.paymentSuccess = true;
            this.paymentResult = res;
            this.isProcessing = false;
            this.trigger.trigger();
            setTimeout(() => {
              this.doneButton?.nativeElement?.focus();
            }, 50);
          } else {
            this.paymentError = res.message || 'Payment failed. Please try again.';
            this.isProcessing = false;
            this.focusAmountInput(); // refocus so user can correct
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.paymentError = err?.error?.message || 'Something went wrong. Please try again.';
          this.isProcessing = false;
          this.focusAmountInput();
          this.cdr.markForCheck();
        },
      });
  }
  // ready for update bersion 2

  // async submitPayment(): Promise<void> {
  //   if (!this.paymentAmount || this.paymentAmount <= 0) {
  //     this.paymentError = 'Please enter a valid amount.';
  //     return;
  //   }

  //   this.isProcessing = true;
  //   this.paymentError = '';

  //   this.paymentService.initiatePayment(this.scannedStudentId, this.paymentAmount).subscribe({
  //     next: (res: any) => {
  //       if (res?.success) {
  //         this.paymentId = res.paymentId;
  //         this.isProcessing = false;
  //         this.isWaitingApproval = true;
  //         this.approvalCountdown = 60;
  //         this.startPolling();
  //       } else {
  //         this.paymentError = res?.message || res.err || 'Failed to send payment request.';
  //         this.isProcessing = false;
  //       }
  //       this.cdr.markForCheck();
  //     },
  //   });
  // }

  // startPolling(): void {
  //   this.approvalTimer = setInterval(() => {
  //     this.approvalCountdown--;

  //     this.paymentService.getPaymentStatus(this.paymentId).subscribe({
  //       next: (res: any) => {
  //         const status = res?.data?.status;
  //         if (status === 'approved') {
  //           this.stopPolling();
  //           this.paymentSuccess = true;
  //           this.isWaitingApproval = false;
  //           this.approvalStatus = 'approved';
  //           this.cdr.markForCheck();
  //         } else if (status === 'rejected' || status === 'expired') {
  //           this.stopPolling();
  //           this.isWaitingApproval = false;
  //           this.approvalStatus = status;
  //           this.paymentError =
  //             status === 'rejected'
  //               ? 'Student rejected the payment.'
  //               : 'Payment request timed out.';
  //           this.cdr.markForCheck();
  //         }
  //       },
  //     });

  //     if (this.approvalCountdown <= 0) this.stopPolling();
  //   }, 1000);
  // }

  // stopPolling(): void {
  //   if (this.approvalTimer) {
  //     clearInterval(this.approvalTimer);
  //     this.approvalTimer = null;
  //   }
  // }

  loadSellerData(): void {
    this.sellerService
      .getSellerList(1, 10, this.sellerName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.data?.length > 0) {
            this.sellerRes = res.data[0];
            this.sellerId = this.sellerRes.s_id;
            // console.log('✅ Seller ID:', this.sellerId);
            this.loadSellerQr(); // ← only called AFTER sellerId is set
          } else {
            // console.warn('⚠️ No seller found for name:', this.sellerName);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          // console.error('❌ Failed to load seller:', err);
        },
      });
  }

  loadSellerQr(): void {
    this.isGeneratingQr = true;
    // sellerId is guaranteed to be set here
    const data = encodeURIComponent(`${this.sellerUsername}`);
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${data}&bgcolor=ffffff&color=1a1a2e&margin=16`;
    this.isGeneratingQr = false;
    this.cdr.markForCheck();
  }

  openQrModal(): void {
    this.showQrModal = true;
  }

  closeQrModal(): void {
    this.showQrModal = false;
  }

  onQrBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeQrModal();
    }
  }
}
