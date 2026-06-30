import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Student } from '../../../services/student';
import { CommonModule, DatePipe } from '@angular/common';
import { Auth } from '../../../services/auth';
import { FormsModule } from '@angular/forms';

interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface PayHistory {
  transaction_id: string;
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
  selector: 'app-transhistory',
  imports: [DatePipe, CommonModule, FormsModule],
  templateUrl: './transhistory.html',
  styleUrl: './transhistory.css',
})
export class Transhistory implements OnInit {
  private studentService = inject(Student);

  private auth = inject(Auth);
  transactions: PayHistory[] = [];
  pagination: PaginationMetadata | null = null;
  isLoading: boolean = false;
  isLoadingMore: boolean = false;
  errorMessage: string = '';
  studentId: string = ''; // replace with actual student ID logic

  // ── Date filter ────────────────────
  txDateFrom = '';
  txDateTo = '';
  txFiltered = false;
  allTransactions: PayHistory[] = [];
  filteredTransactions: PayHistory[] = [];

  // ── Detail sheet ────────────────────
  selectedTx: PayHistory | null = null;
  showDetail = false;
  private cdr = inject(ChangeDetectorRef);
  constructor() {
    this.studentId = this.auth.getUserId();
    // this.loadTransactions();
  }

  private currentPage: number = 1;
  private readonly pageSize: number = 10;
  ngOnInit(): void {
    this.loadTransactions();
    this.studentId = this.auth.getUserId();
  }

  loadTransactions(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.studentService
      .getTransactionsPaginated(this.studentId, this.currentPage, this.pageSize)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.allTransactions = res.data;
            this.pagination = res.pagination;
            this.currentPage = 1;
            this.applyFilter();
          } else {
            this.errorMessage = res.message;
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Failed to load transactions.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  loadMore(): void {
    if (!this.pagination?.hasNext || this.isLoadingMore) return;
    this.isLoadingMore = true;
    const nextPage = this.currentPage + 1;

    this.studentService
      .getTransactionsPaginated(this.studentId, nextPage, this.pageSize)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.allTransactions = [...this.allTransactions, ...res.data];
            this.pagination = res.pagination;
            this.currentPage = nextPage;
            this.applyFilter();
          }
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        },
      });
  }

  applyFilter(): void {
    this.txFiltered = !!(this.txDateFrom || this.txDateTo);

    if (!this.txFiltered) {
      this.filteredTransactions = [...this.allTransactions];
      this.cdr.markForCheck();
      return;
    }

    const from = this.txDateFrom ? Math.floor(new Date(this.txDateFrom).getTime() / 1000) : null;
    const to = this.txDateTo
      ? Math.floor(new Date(this.txDateTo + 'T23:59:59').getTime() / 1000)
      : null;

    this.filteredTransactions = this.allTransactions.filter((tx) => {
      if (from && tx.pay_date < from) return false;
      if (to && tx.pay_date > to) return false;
      return true;
    });

    this.cdr.markForCheck();
  }

  clearFilter(): void {
    this.txDateFrom = '';
    this.txDateTo = '';
    this.txFiltered = false;
    this.filteredTransactions = [...this.allTransactions];
    this.cdr.markForCheck();
  }

  openDetail(tx: PayHistory): void {
    this.selectedTx = tx;
    this.showDetail = true;
    this.cdr.markForCheck();
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedTx = null;
    this.cdr.markForCheck();
  }

  // For double-entry: credit = admin top-up received
  // For legacy: credit column holds the value
  getStudentIncome(tx: any): number {
    const isLegacy =
      !tx.transaction_id || tx.transaction_id === '' || tx.transaction_id === 'No Value';
    if (isLegacy) return tx.credit || 0;
    return tx.credit || 0; // double-entry admin credit row
  }

  // For double-entry: debit = payment to seller
  // For legacy: debit column holds the value
  getStudentSpend(tx: any): number {
    const isLegacy =
      !tx.transaction_id || tx.transaction_id === '' || tx.transaction_id === 'No Value';
    if (isLegacy) return tx.debit || 0;
    return tx.debit || 0; // double-entry student payment row
  }

  // Student component
  getAmount(tx: any): { value: number; type: 'credit' | 'debit' } {
    const isLegacy =
      !tx.transaction_id || tx.transaction_id === 'No Value' || tx.transaction_id === '';
    if (isLegacy) {
      // legacy: debit = spent, credit = received (rare but possible)
      return tx.debit > 0
        ? { value: tx.debit, type: 'debit' }
        : { value: tx.credit, type: 'credit' };
    }
    // double-entry: check which column has value
    return tx.debit >= 0
      ? { value: tx.debit, type: 'debit' }
      : { value: tx.credit, type: 'credit' };
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'success':
        return 'status-success';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-default';
    }
  }
}
