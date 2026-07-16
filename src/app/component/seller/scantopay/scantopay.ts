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
import { Student } from '../../../services/student';

type PaymentInputMethod = 'camera_scan' | 'scanner_keyin' | 'manual_keyin';
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
  private studentService = inject(Student);
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

    console.log(this.sellerUsername);
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
  @ViewChild('inlineAmountInput') inlineAmountInput!: ElementRef<HTMLInputElement>;

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
  private cameraTriggeredThisPayment = false;

  private resolveInputMethod(cameraTriggered: boolean): PaymentInputMethod {
    if (cameraTriggered) return 'camera_scan';
    return this.isFromScanner ? 'scanner_keyin' : 'manual_keyin';
  }
  quickAmounts = [
    { label: '10¢', value: 0.1 },
    { label: '20¢', value: 0.2 },
    { label: '50¢', value: 0.5 },
    { label: 'RM 1', value: 1 },
    { label: 'RM 2', value: 2 },
    { label: 'RM 3', value: 3 },
    { label: 'RM 5', value: 5 },
    { label: 'RM 10', value: 10 },
    { label: 'RM 20', value: 20 },
  ];

  studentInfo: { name: string; id: string } | null = null;
  isLookingUpStudent = false;
  studentLookupError = '';

  // Add this state
  showInlineAmount = false;
  inlineAmount: number | null = null;
  inlineError = '';
  isInlineProcessing = false;

  ngOnInit(): void {
    this.sellerName = this.auth.getName();
    // console.log(this.auth.getUserId());
    console.log(this.sellerName);

    this.loadSellerData();
    if (this.activeTab === 'scan') {
      // ← add this block
      this.focusManualInput();
    }
  }
  private toPaymentSource(method: PaymentInputMethod): 'manual' | 'scan' {
    return method === 'manual_keyin' ? 'manual' : 'scan';
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
  lookupStudent(studentId: string): void {
    const id = studentId?.trim();
    if (!id) return;

    this.isLookingUpStudent = true;
    this.studentLookupError = '';
    this.studentInfo = null;
    this.cdr.markForCheck();

    this.studentService.getStudentById(id).subscribe({
      next: (res: any) => {
        const student = res?.data || res;
        if (student?.student_name || student?.name) {
          this.studentInfo = {
            name: student.student_name || student.name,
            id: student.student_id || id,
          };
        } else {
          this.studentLookupError = 'Student not found.';
        }
        this.isLookingUpStudent = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.studentLookupError = 'Could not verify student.';
        this.isLookingUpStudent = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Inline amount cents state ─────────
  private inlineAmountCents = 0;

  get formattedInlineAmount(): string {
    if (this.inlineAmountCents === 0) return '';
    return (this.inlineAmountCents / 100).toFixed(2);
  }

  // onInlineAmountKeydown(event: KeyboardEvent): void {
  //   if (event.key === 'Enter' || event.key === 'Escape') return;

  //   event.preventDefault();

  //   if (event.key >= '0' && event.key <= '9') {
  //     if (this.inlineAmountCents < 999999) {
  //       this.inlineAmountCents = this.inlineAmountCents * 10 + parseInt(event.key);
  //       this.inlineAmount = this.inlineAmountCents / 100;
  //     }
  //   } else if (event.key === 'Backspace') {
  //     this.inlineAmountCents = Math.floor(this.inlineAmountCents / 10);
  //     this.inlineAmount = this.inlineAmountCents > 0 ? this.inlineAmountCents / 100 : null;
  //   }

  //   this.inlineError = '';
  //   this.cdr.markForCheck();
  // }

  onInlineAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Strip anything that isn't a digit
    const digitsOnly = input.value.replace(/\D/g, '');

    if (digitsOnly === '') {
      this.inlineAmountCents = 0;
      this.inlineAmount = null;
    } else {
      const cents = parseInt(digitsOnly, 10);
      if (cents <= 999999) {
        this.inlineAmountCents = cents;
        this.inlineAmount = cents / 100;
      }
    }
    // Keep display in sync — show formatted value
    input.value = this.inlineAmountCents > 0 ? (this.inlineAmountCents / 100).toFixed(2) : '';
    this.inlineError = '';
    this.cdr.markForCheck();
  }

  onPaymentAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = input.value.replace(/\D/g, '');

    if (digitsOnly === '') {
      this.amountCents = 0;
      this.paymentAmount = null;
    } else {
      const cents = parseInt(digitsOnly, 10);
      if (cents <= 999999) {
        this.amountCents = cents;
        this.paymentAmount = cents / 100;
      }
    }
    input.value = this.amountCents > 0 ? (this.amountCents / 100).toFixed(2) : '';
    this.paymentError = '';
    this.cdr.markForCheck();
  }

  // Update setQuickAmount to use cents too
  setQuickAmount(amt: number): void {
    this.amountCents = Math.round(amt * 100);
    this.paymentAmount = amt;
    this.paymentError = '';
    this.cdr.markForCheck();
  }

  setInlineQuickAmountVal(val: number): void {
    this.inlineAmountCents = Math.round(val * 100);
    this.inlineAmount = val;
    this.inlineError = '';
    this.cdr.markForCheck();
  }

  // setInlineQuickAmount(amt: number): void {
  //   this.inlineAmountCents = amt * 100;
  //   this.inlineAmount = amt;
  //   this.inlineError = '';
  //   setTimeout(() => this.inlineAmountInput?.nativeElement?.focus(), 50);
  //   this.cdr.markForCheck();
  // }
  // ── Amount input state ────────────────
  private amountCents = 0; // stores value in cents e.g. 150 = RM 1.50

  get formattedAmount(): string {
    if (this.amountCents === 0) return '';
    return (this.amountCents / 100).toFixed(2);
  }

  onAmountKeydown(event: KeyboardEvent): void {
    // Allow Enter and Escape to bubble up to their handlers
    if (event.key === 'Enter' || event.key === 'Escape') return;

    event.preventDefault(); // block default input behaviour

    if (event.key >= '0' && event.key <= '9') {
      // Max 6 digits = RM 9999.99
      if (this.amountCents < 999999) {
        this.amountCents = this.amountCents * 10 + parseInt(event.key);
        this.paymentAmount = this.amountCents / 100;
      }
    } else if (event.key === 'Backspace') {
      this.amountCents = Math.floor(this.amountCents / 10);
      this.paymentAmount = this.amountCents > 0 ? this.amountCents / 100 : null;
    }

    this.paymentError = '';
    this.cdr.markForCheck();
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

  private getDescriptionPrefix(cameraTriggered: boolean): string {
    const isScanBased = cameraTriggered || this.isFromScanner;
    return isScanBased ? 'QRS-' : 'MKI-';
  }

  submitInlinePayment(): void {
    if (!this.inlineAmount || this.inlineAmount <= 0) {
      this.inlineError = 'Enter a valid amount.';
      return;
    }
    this.isInlineProcessing = true;
    this.inlineError = '';
    this.cdr.markForCheck();
    const source = this.toPaymentSource(this.resolveInputMethod(this.cameraTriggeredThisPayment));

    this.sellerService
      .scantoPay(this.scannedStudentId, this.sellerId, this.inlineAmount, source)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) {
            const charged = this.inlineAmount;
            const studentId = this.scannedStudentId;

            this.showInlineAmount = false;
            this.scannedStudentId = '';
            this.inlineAmount = null;
            this.inlineAmountCents = 0; // ← reset
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
    this.inlineAmountCents = 0; // ← reset
    this.inlineError = '';
    this.focusManualInput();
    this.cdr.markForCheck();
  }

  lastScanSuccess = '';

  private keystrokeTimestamps: number[] = [];
  readonly SCAN_AVG_THRESHOLD_MS = 40; // tune this against your actual scanner
  readonly MIN_CHARS_FOR_DETECTION = 4;

  onManualInputChange(value: string): void {
    const now = Date.now();

    if (value.length === 0) {
      this.keystrokeTimestamps = [];
    } else {
      this.keystrokeTimestamps.push(now);
    }

    this.scannedStudentId = value;
    this.classifyInputSource(value.length);
  }

  private classifyInputSource(length: number): void {
    if (length < this.MIN_CHARS_FOR_DETECTION || this.keystrokeTimestamps.length < 2) {
      this.isFromScanner = false;
      return;
    }
    const span = this.keystrokeTimestamps.at(-1)! - this.keystrokeTimestamps[0];
    const avgInterval = span / (this.keystrokeTimestamps.length - 1);
    this.isFromScanner = avgInterval < this.SCAN_AVG_THRESHOLD_MS;
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
    // Wherever you trigger showInlineAmount

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

  setQuickAmountVal(val: number): void {
    this.amountCents = Math.round(val * 100);
    this.paymentAmount = val;
    this.paymentError = '';
    this.cdr.markForCheck();
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
    this.amountCents = 0;
    this.paymentError = '';
    this.paymentSuccess = false;
    this.paymentResult = null;
    this.studentInfo = null; // ✅ reset
    this.studentLookupError = ''; // ✅ reset
    this.showPaymentModal = true;
    this.cdr.markForCheck();

    // ✅ fetch student info when modal opens
    this.lookupStudent(studentId);

    setTimeout(() => {
      this.amountInput?.nativeElement?.focus();
    }, 100);
  }

  // Update closePaymentModal to reset student info
  closePaymentModal(): void {
    if (this.isProcessing) return;
    if (this.paymentSuccess) {
      this.scannedStudentId = '';
      this.showInlineAmount = false;
    }
    this.showPaymentModal = false;
    this.paymentAmount = null;
    this.amountCents = 0;
    this.paymentError = '';
    this.paymentSuccess = false;
    this.isProcessing = false;
    this.paymentResult = null;
    this.studentInfo = null; // ✅ reset
    this.studentLookupError = ''; // ✅ reset
    this.cdr.markForCheck();
    this.focusManualInput();
  }
  // setQuickAmount(amt: number): void {
  //   this.amountCents = amt * 100;
  //   this.paymentAmount = amt;
  //   this.paymentError = '';
  //   this.focusAmountInput();
  //   this.cdr.markForCheck();
  // }
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
        // next: (res: any) => {
        //   if (res.success !== false) {
        //     this.paymentSuccess = true;
        //     this.paymentResult = res;
        //     this.isProcessing = false;
        //     this.trigger.trigger();
        //     setTimeout(() => {
        //       this.doneButton?.nativeElement?.focus();
        //     }, 50);
        //   } else {
        //     this.paymentError = res.message || 'Payment failed. Please try again.';
        //     this.isProcessing = false;
        //     this.focusAmountInput(); // refocus so user can correct
        //   }
        //   this.cdr.markForCheck();
        // },
        // error: (err: any) => {
        //   this.paymentError = err?.error?.message || 'Something went wrong. Please try again.';
        //   this.isProcessing = false;
        //   this.focusAmountInput();
        //   this.cdr.markForCheck();
        // },
        next: (res: any) => {
          // Check if approval is required
          if (res?.success && res?.message?.startsWith('APPROVAL_REQUIRED:')) {
            const paymentId = res.message.split(':')[1];
            this.isProcessing = false;
            this.showPaymentModal = false;
            // Show waiting state
            this.paymentId = paymentId;
            this.isWaitingApproval = true;
            this.approvalCountdown = 60;
            this.approvalStatus = '';
            this.startPolling();
            this.cdr.markForCheck();
            return;
          }

          if (res.success !== false) {
            this.paymentSuccess = true;
            this.paymentResult = res;
            this.isProcessing = false;
            this.trigger.trigger();
            setTimeout(() => this.doneButton?.nativeElement?.focus(), 50);
          } else {
            this.paymentError = res.message || 'Payment failed.';
            this.isProcessing = false;
            this.focusAmountInput();
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.paymentError = err?.error?.message || 'Something went wrong.';
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

  startPolling(): void {
    this.approvalTimer = setInterval(() => {
      this.approvalCountdown--;

      this.paymentService.getPaymentStatus(this.paymentId).subscribe({
        next: (res: any) => {
          const status = res?.data?.status;
          if (status === 'approved') {
            this.stopPolling();
            this.paymentSuccess = true;
            this.isWaitingApproval = false;
            this.approvalStatus = 'approved';
            this.cdr.markForCheck();
          } else if (status === 'rejected' || status === 'expired') {
            this.stopPolling();
            this.isWaitingApproval = false;
            this.approvalStatus = status;
            this.paymentError =
              status === 'rejected'
                ? 'Student rejected the payment.'
                : 'Payment request timed out.';
            this.cdr.markForCheck();
          }
        },
      });

      if (this.approvalCountdown <= 0) this.stopPolling();
    }, 1000);
  }

  stopPolling(): void {
    if (this.approvalTimer) {
      clearInterval(this.approvalTimer);
      this.approvalTimer = null;
    }
  }

  loadSellerData(): void {
    this.sellerService
      .getSellerList(1, 10, this.sellerUsername)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.data?.length > 0) {
            this.sellerRes = res.data[0];
            this.sellerId = this.sellerRes.s_id;
            console.log('✅ Seller ID:', this.sellerId);
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
