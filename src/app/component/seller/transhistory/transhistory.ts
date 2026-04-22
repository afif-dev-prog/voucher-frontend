import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Seller } from '../../../services/seller';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-transhistory',
  imports: [CommonModule, FormsModule],
  templateUrl: './transhistory.html',
  styleUrl: './transhistory.css',
})
export class Transhistory implements OnInit, OnDestroy {
  private sellerService = inject(Seller);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  seller = {
    id: '13',
    username: 'Koperasi Sarawak Skills 2',
    s_name: 'ahmad_cafe',
    email: 'ahmad@cafe.com',
  };

  // Replace with actual seller ID from auth/session
  // sellerId: string = 'SOCC Sribima Offshore Catering Co';

  transactions: any[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';

  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 0;
  hasPrevious = false;
  hasNext = false;

  // Summary totals
  totalCredit = 0;
  totalDebit = 0;

  ngOnInit(): void {
    this.seller.username = this.auth.getName();
    this.loadTransactions();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadTransactions();
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  onClearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadTransactions();
  }

  loadTransactions(): void {
    // console.log(this.seller.username);
    this.isLoading = true;
    this.errorMessage = '';

    this.sellerService
      .getSellerTransactions(this.seller.username, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.transactions = response?.data || [];
          // console.log(response);
          this.totalCount = response.pagination?.totalCount;
          this.totalPages = response.pagination?.totalPages;
          this.hasPrevious = response.pagination?.hasPrevious;
          this.hasNext = response.pagination?.hasNext;

          // Calculate page totals
          this.totalCredit = this.transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
          this.totalDebit = this.transactions.reduce((sum, t) => sum + (t.debit || 0), 0);

          this.isLoading = false;
          this.cdr?.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Failed to load transactions.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  getSellerIncome(tx: any): number {
    const isLegacy =
      !tx.transaction_id || tx.transaction_id === 'No Value' || tx.transaction_id === '';
    return isLegacy ? tx.debit || 0 : tx.credit || 0;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadTransactions();
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }
  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  get pageNumbers(): number[] {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'status-success';
      case 'PENDING':
        return 'status-pending';
      case 'FAILED':
        return 'status-failed';
      default:
        return 'status-default';
    }
  }
}
