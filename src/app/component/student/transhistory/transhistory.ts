import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
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
  selector: 'app-transhistory',
  imports: [DatePipe, CommonModule],
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
    // console.log(this.studentId);

    this.studentService
      .getTransactionsPaginated(this.studentId, this.currentPage, this.pageSize)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.transactions = res.data;
            // console.log(this.transactions);
            this.cdr.markForCheck();
            this.pagination = res.pagination;
            this.currentPage = 1;
          } else {
            this.errorMessage = res.message;
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = 'Failed to load transactions.';
          this.isLoading = false;
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
            this.transactions = [...this.transactions, ...res.data]; // append, not replace
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
    return tx.debit > 0 ? { value: tx.debit, type: 'debit' } : { value: tx.credit, type: 'credit' };
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
