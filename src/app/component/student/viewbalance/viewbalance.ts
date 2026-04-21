import { AfterViewInit, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Student } from '../../../services/student';
import { CommonModule, DatePipe } from '@angular/common';
import { Auth } from '../../../services/auth';
interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface PayHistory {
  pay_id: string;
  student_id: string;
  seller: string;
  pay_date: number; // assuming this is a timestamp in seconds
  debit: number;
  credit: number;
  remark: string;
  status: string;
  // add your other fields here
}

interface PagedResult<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationMetadata;
}
@Component({
  selector: 'app-viewbalance',
  imports: [DatePipe, CommonModule],
  templateUrl: './viewbalance.html',
  styleUrl: './viewbalance.css',
})
export class Viewbalance implements OnInit, AfterViewInit {
  // private studentService = inject(Student);
  studentId = '';
  isLoading: boolean = false;
  isLoadingMore: boolean = false;
  errorMessage: string = '';
  qrImageUrl = '';
  qrError = false;
  private auth = inject(Auth);
  constructor(
    private studentService: Student,
    private cdr: ChangeDetectorRef,
  ) {
    // this.getBalance();
    this.studentId = this.auth.getUserId();
  }
  ngAfterViewInit(): void {
    this.getBalance();
  }
  private currentPage: number = 1;
  private readonly pageSize: number = 10;
  // Totals
  totalCredit = 0;
  totalDebit = 0;
  netAmount = 0;
  calcTotals(): void {
    this.totalCredit = this.recentTransactions.reduce((s: any, t: any) => s + (t.credit || 0), 0);
    this.totalDebit = this.recentTransactions.reduce((s: any, t: any) => s + (t.debit || 0), 0);
    this.netAmount = this.totalDebit;
  }

  apiRes: any = [];
  ngOnInit(): void {
    this.getBalance();
    this.studentId = this.auth.getUserId();
    console.log(this.studentId);

    this.studentService
      .getTransactionsPaginated(this.studentId, this.currentPage, this.pageSize)
      .subscribe({
        next: (res: any) => {
          this.recentTransactions = res.data || [];
          this.calcTotals();
          this.cdr.markForCheck();
        },
      });
  }

  recentTransactions: any = [];

  loadTransactions(): void {
    this.isLoading = true;
    this.errorMessage = '';
    console.log(this.studentId);

    this.studentService
      .getTransactionsPaginated(this.studentId, this.currentPage, this.pageSize)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.recentTransactions = res.data;
            // console.log(this.transactions);
            this.cdr.markForCheck();
            this.pagination = res.pagination;
            this.currentPage = 1;
          } else {
            this.errorMessage = res.message;
          }
          // this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = 'Failed to load transactions.';
          this.isLoading = false;
        },
      });
  }
  pagination: PaginationMetadata | null = null;

  loadMore(): void {
    if (!this.pagination?.hasNext || this.isLoadingMore) return;

    this.isLoadingMore = true;
    const nextPage = this.currentPage + 1;

    this.studentService
      .getTransactionsPaginated(this.studentId, nextPage, this.pageSize)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.recentTransactions = [...this.recentTransactions, ...res.data]; // append, not replace
            this.pagination = res.pagination;
            this.cdr.markForCheck();
            this.currentPage = nextPage;
          }
          this.isLoadingMore = false;
        },
        error: () => {
          this.isLoadingMore = false;
        },
      });
  }

  getBalance() {
    this.studentService.getBalance(this.studentId).subscribe((res) => {
      this.apiRes = res.data;
      this.cdr.markForCheck();
      console.log(this.apiRes);
    });
  }
  // Add these helper methods to your component class:

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-active';
    }
  }

  showQrModal = false;
  isGeneratingQr = false;

  // ── QR Modal ──────────────────────────
  openQrModal(): void {
    this.showQrModal = true;
    this.isGeneratingQr = true;
    this.qrError = false;
    this.qrImageUrl = this.buildQrUrl(this.apiRes.student_id);
    this.cdr.markForCheck();
  }

  buildQrUrl(studentId: string): string {
    const size = 220;
    const color = '1e3a5f'; // dark navy — no # prefix for this API
    const bg = 'ffffff';
    return (
      `https://api.qrserver.com/v1/create-qr-code/` +
      `?size=${size}x${size}` +
      `&data=${encodeURIComponent(studentId)}` +
      `&color=${color}` +
      `&bgcolor=${bg}` +
      `&ecc=H` + // high error correction
      `&margin=2`
    );
  }

  onQrLoaded(): void {
    this.isGeneratingQr = false;
    this.cdr.markForCheck();
  }

  onQrError(): void {
    this.isGeneratingQr = false;
    this.qrError = true;
    this.cdr.markForCheck();
  }

  closeQrModal(): void {
    this.showQrModal = false;
    this.cdr.markForCheck();
  }
}
