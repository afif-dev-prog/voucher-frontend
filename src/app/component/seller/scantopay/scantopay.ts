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

@Component({
  selector: 'app-scantopay',
  imports: [CommonModule, FormsModule],
  templateUrl: './scantopay.html',
  styleUrl: './scantopay.css',
})
export class Scantopay implements OnInit, OnDestroy {
  private sellerService = inject(Seller);
  private auth = inject(Auth);

  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  sellerId: number = 0; // replace with actual seller ID from auth
  sellerRes: any = [];

  readonly apiUrl = 'http://localhost:5094/api/voucher/seller';

  constructor() {}

  // Tabs
  activeTab: 'scan' | 'qr' = 'qr';

  // Camera / Scan
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  isCameraActive = false;
  isCameraLoading = false;
  cameraError = '';
  private stream: MediaStream | null = null;
  private scanInterval: any = null;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

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

  // QR modal
  showQrModal = false;
  qrImageUrl = '';
  isGeneratingQr = false;

  sellerName = '';

  ngOnInit(): void {
    this.sellerName = this.auth.getName();

    this.loadSellerData();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.destroy$.next();
    this.destroy$.complete();
  }

  getSellerId(): number {
    this.sellerService.getSellerList(1, 10, this.sellerName).subscribe((res) => {
      this.sellerRes = res.data[0];
      console.log(this.sellerRes);
    });
    return this.sellerId;
  }

  switchTab(tab: 'scan' | 'qr'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();

    if (tab === 'scan') {
      setTimeout(() => this.startCamera(), 100);
    } else {
      this.stopCamera();
      this.loadSellerQr(); // refresh QR URL when tab is opened
    }
  }

  // ── CAMERA ─────────────────────────────────────
  //

  async startCamera(): Promise<void> {
    this.isCameraLoading = true;
    this.cameraError = '';
    this.cdr.markForCheck();

    console.log('🎥 Requesting camera access...');

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
        console.log('✅ Camera started successfully');
        this.startQrScanning(); // ← uses jsQR now
        this.cdr.markForCheck();
      }
    } catch (err: any) {
      console.error('❌ Camera error:', err);
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

  stopCamera(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
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
    console.log('📷 Starting jsQR scanning...');

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
      console.log('⏳ Video not ready yet...');
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
      console.log('🎯 QR Detected!', code.data);
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
    console.log('🚀 onQrDetected called with:', value);

    if (this.showPaymentModal) {
      console.log('⛔ Modal already open — ignoring scan');
      return;
    }

    console.log('✅ Proceeding to payment modal...');
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
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.paymentAmount = null;
    this.paymentError = '';
    this.paymentSuccess = false;
    this.isProcessing = false;
    // Restart camera after closing
    if (this.activeTab === 'scan') {
      setTimeout(() => this.startCamera(), 200);
    }
    this.cdr.markForCheck();
  }

  onPaymentBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      if (!this.isProcessing) this.closePaymentModal();
    }
  }

  submitPayment(): void {
    if (!this.paymentAmount || this.paymentAmount <= 0) {
      this.paymentError = 'Please enter a valid amount.';
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.cdr.markForCheck();

    this.sellerService
      .scantoPay(this.scannedStudentId, this.sellerId, this.paymentAmount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          console.log('✅ Payment response:', res);

          if (res.success !== false) {
            // Success — show success state inside modal
            this.paymentSuccess = true;
            this.paymentResult = res;
            this.isProcessing = false;
            console.log('💰 Payment successful');
          } else {
            // API returned failure
            this.paymentError = res.message || 'Payment failed. Please try again.';
            this.isProcessing = false;
            console.error('❌ Payment failed:', res.message);
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('❌ Payment error:', err);
          this.paymentError = err?.error?.message || 'Something went wrong. Please try again.';
          this.isProcessing = false;
          this.cdr.markForCheck();
        },
      });
  }

  loadSellerData(): void {
    this.sellerService
      .getSellerList(1, 10, this.sellerName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.data?.length > 0) {
            this.sellerRes = res.data[0];
            this.sellerId = this.sellerRes.s_id;
            console.log('✅ Seller ID:', this.sellerId);
            this.loadSellerQr(); // ← only called AFTER sellerId is set
          } else {
            console.warn('⚠️ No seller found for name:', this.sellerName);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('❌ Failed to load seller:', err);
        },
      });
  }

  loadSellerQr(): void {
    this.isGeneratingQr = true;
    // sellerId is guaranteed to be set here
    const data = encodeURIComponent(`${this.sellerId}`);
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
