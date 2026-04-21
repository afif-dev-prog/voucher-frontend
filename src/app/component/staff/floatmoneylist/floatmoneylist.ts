import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Staff } from '../../../services/staff';
import { CommonModule, DatePipe } from '@angular/common';
import { Float } from '../../../services/float';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface FloatRow {
  h_id: number;
  student_id: string;
  credit: number;
  pay_date: number;
  month_credit: string;
  user_update: string;
  // UI state
  selected: boolean;
  editing: boolean;
  editAmount: number;
  editPayDate: number;
  editMonthCredit: string;
  isSaving: boolean;
}
@Component({
  selector: 'app-floatmoneylist',
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './floatmoneylist.html',
  styleUrl: './floatmoneylist.css',
})
export class Floatmoneylist {
  private floatService = inject(Float); // adjust to your service
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  currentUser = 'admin'; // replace with auth

  // ── List state ────────────────────────
  rows: FloatRow[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';

  // Pagination
  currentPage = 1;
  readonly pageSize = 10;
  totalCount = 0;
  totalPages = 0;
  hasPrevious = false;
  hasNext = false;

  // ── Selection ─────────────────────────
  get selectedRows(): FloatRow[] {
    return this.rows.filter((r) => r.selected);
  }

  get allSelected(): boolean {
    return this.rows.length > 0 && this.rows.every((r) => r.selected);
  }

  get someSelected(): boolean {
    return this.rows.some((r) => r.selected) && !this.allSelected;
  }

  // ── Proceed — shared fields ───────────
  proceedAmount = 0;
  proceedMonthCredit = '';

  get proceedTotal(): number {
    return this.proceedAmount * this.selectedRows.length;
  }

  // ── Confirm modal ─────────────────────
  showConfirmModal = false;
  isProceeding = false;
  proceedSuccess = false;
  proceedError = '';

  // ── Delete ────────────────────────────
  showDeleteModal = false;
  rowToDelete: FloatRow | null = null;
  isDeleting = false;

  ngOnInit(): void {
    this.loadRows();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load ──────────────────────────────
  setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadRows();
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }
  onClearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadRows();
  }

  loadRows(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.floatService
      .getPaginatedFloatList(this.currentPage, this.pageSize, this.searchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.rows = (res.data || []).map((r: any) => ({
            ...r,
            selected: false,
            editing: false,
            editAmount: r.amount,
            editMonthCredit: r.month_credit,
            editPaydate: r.pay_date,
            isSaving: false,
          }));
          this.totalCount = res.pagination?.totalCount || 0;
          this.totalPages = res.pagination?.totalPages || 0;
          this.hasPrevious = res.pagination?.hasPrevious || false;
          this.hasNext = res.pagination?.hasNext || false;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Failed to load float records.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadRows();
  }
  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }
  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  get pageNumbers(): number[] {
    const max = 5;
    const half = Math.floor(max / 2);
    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, start + max - 1);
    if (end - start + 1 < max) start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  // ── Selection ─────────────────────────
  toggleSelectAll(): void {
    const newVal = !this.allSelected;
    this.rows.forEach((r) => (r.selected = newVal));
    this.cdr.markForCheck();
  }

  toggleRow(row: FloatRow): void {
    row.selected = !row.selected;
    this.cdr.markForCheck();
  }

  // ── Inline Edit ───────────────────────
  startEdit(row: FloatRow): void {
    this.rows.forEach((r) => {
      if (r.editing && r.h_id !== row.h_id) this.cancelEdit(r);
    });
    row.editAmount = row.credit;
    row.editPayDate = row.pay_date;
    row.editMonthCredit = row.month_credit;
    row.editing = true;
    this.cdr.markForCheck();
  }

  cancelEdit(row: FloatRow): void {
    row.editing = false;
    this.cdr.markForCheck();
  }

  saveEdit(row: FloatRow): void {
    if (!row.editAmount || row.editAmount <= 0) return;
    row.isSaving = true;

    const payload = {
      student_id: row.student_id,
      amount: row.editAmount,
      pay_date: row.editPayDate,
      month_credit: row.editMonthCredit,
      user_update: this.currentUser,
    };

    this.floatService
      .updateFloat(row.h_id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success !== false) {
            row.credit = row.editAmount;
            row.pay_date = row.editPayDate;
            row.month_credit = row.editMonthCredit;
            row.editing = false;
            // console.log(res.message);
          }
          row.isSaving = false;
          this.cdr.markForCheck();
        },
        error: () => {
          row.isSaving = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Pay Date helper ───────────────────
  // Convert unix timestamp → "yyyy-MM-dd" for <input type="date">
  toDateInputValue(unix: number): string {
    if (!unix) return '';
    return new Date(unix * 1000).toISOString().split('T')[0];
  }

  // Convert "yyyy-MM-dd" → unix timestamp
  fromDateInputValue(dateStr: string): number {
    if (!dateStr) return 0;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  }

  onEditPayDateChange(row: FloatRow, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    row.editPayDate = this.fromDateInputValue(val);
  }

  // ── Delete ────────────────────────────
  openDeleteModal(row: FloatRow): void {
    this.rowToDelete = row;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.rowToDelete = null;
    this.isDeleting = false;
  }

  confirmDelete(): void {
    if (!this.rowToDelete) return;
    this.isDeleting = true;

    this.floatService
      .deleteFloat(this.rowToDelete.student_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success !== false) {
            this.rows = this.rows.filter((r) => r.student_id !== this.rowToDelete!.student_id);
            this.totalCount--;
            this.closeDeleteModal();
          }
          this.isDeleting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isDeleting = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Proceed modal ─────────────────────
  openConfirmModal(): void {
    // Pre-fill month_credit from first selected row as a default
    this.proceedMonthCredit = this.selectedRows[0]?.month_credit || '';
    this.proceedAmount = this.selectedRows[0]?.credit || 0;
    this.proceedError = '';
    this.proceedSuccess = false;
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    if (this.isProceeding) return;
    this.showConfirmModal = false;
    this.proceedError = '';
    if (this.proceedSuccess) {
      this.proceedSuccess = false;
      this.loadRows();
    }
  }

  confirmProceed(): void {
    if (!this.proceedAmount || this.proceedAmount <= 0) {
      this.proceedError = 'Please enter a valid credit amount.';
      return;
    }
    if (!this.proceedMonthCredit) {
      this.proceedError = 'Please select a month credit.';
      return;
    }

    const ids = this.selectedRows.map((r) => r.student_id) as unknown as [string];
    this.isProceeding = true;
    this.proceedError = '';

    this.floatService
      .proceedFloat({
        ids: ids as unknown as [''],
        amount: this.proceedAmount,
        month_credit: this.proceedMonthCredit,
        user_update: this.currentUser,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success !== false) {
            const proceededIds = this.selectedRows.map((r) => r.h_id);
            this.rows = this.rows.filter((r) => !proceededIds.includes(r.h_id));
            this.totalCount -= proceededIds.length;
            this.proceedSuccess = true;
          } else {
            this.proceedError = res?.message || 'Failed to proceed.';
          }
          this.isProceeding = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.proceedError = err?.error?.message || 'Something went wrong.';
          this.isProceeding = false;
          this.cdr.markForCheck();
        },
      });
  }
}
