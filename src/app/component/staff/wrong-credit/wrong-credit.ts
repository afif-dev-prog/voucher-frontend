import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Staff } from '../../../services/staff';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Seller } from '../../../services/seller';
import { Auth } from '../../../services/auth';

interface CorrectionRow {
  student_id: string;
  wrong_amount: number | null;
  exact_amount: number | null;
  seller_name: string;
  status: 'idle' | 'processing' | 'success' | 'failed';
  message: string;
  difference: number | null;
}

interface ZeroliseRow {
  student_id: string;
  status: 'idle' | 'processing' | 'success' | 'failed';
  message: string;
  difference?: null; // kept so the generic progress template can read row.difference safely
}

@Component({
  selector: 'app-wrong-credit',
  imports: [CommonModule, FormsModule],
  templateUrl: './wrong-credit.html',
  styleUrl: './wrong-credit.css',
})
export class WrongCredit {
  private staffService = inject(Staff);
  private sellerService = inject(Seller);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // ── Shared fields (finance/seller tabs) ─────────────────────
  sharedWrongAmount: number | null = null;
  sharedExactAmount: number | null = null;
  sharedSellerName = '';
  useSharedValues = true;

  // ── Bulk ID input (finance/seller tabs) ──────────────────────
  bulkIdInput = '';
  rows: CorrectionRow[] = [];

  // ── Seller dropdown (finance/seller tabs) ────────────────────
  sellerDropdownOpen = false;
  sellerSearch = '';
  sellerList: any[] = [];
  sellerLoading = false;
  selectedSellerDisplay = '';
  private sellerSearchSubject = new Subject<string>();

  // ── Zerolise tab state ────────────────────────────────────────
  zeroliseBulkIdInput = '';
  zeroliseRows: ZeroliseRow[] = [];

  // ── Submission (shared across all tabs) ───────────────────────
  isProcessing = false;
  isComplete = false;
  successCount = 0;
  failCount = 0;

  // ── Confirm modal ──────────────────────────────────────────────
  showConfirmModal = false;
  globalError = '';

  // ── Tabs ──────────────────────────────────────────────────────
  activeTab: 'finance' | 'seller' | 'zerolise' = 'finance';

  switchTab(tab: 'finance' | 'seller' | 'zerolise'): void {
    this.activeTab = tab;
    this.reset();
    this.cdr.markForCheck();
  }

  /** Returns whichever row array is relevant to the active tab — used by the shared progress UI. */
  get activeRows(): (CorrectionRow | ZeroliseRow)[] {
    return this.activeTab === 'zerolise' ? this.zeroliseRows : this.rows;
  }

  // ════════════════════════════════════════════════════════════
  // Finance / Seller wrong-credit logic
  // ════════════════════════════════════════════════════════════

  get totalDifference(): number {
    if (this.sharedExactAmount == null || this.sharedWrongAmount == null) return 0;
    return this.sharedExactAmount - this.sharedWrongAmount;
  }

  get isPositiveDiff(): boolean {
    return this.totalDifference > 0;
  }

  parseBulkIds(): void {
    this.globalError = '';

    if (this.useSharedValues) {
      if (!this.sharedWrongAmount || this.sharedWrongAmount <= 0) {
        this.globalError = 'Please enter the wrong amount first.';
        return;
      }
      if (!this.sharedExactAmount || this.sharedExactAmount <= 0) {
        this.globalError = 'Please enter the correct amount first.';
        return;
      }
      if (!this.sharedSellerName.trim()) {
        this.globalError =
          this.activeTab === 'finance'
            ? 'Please enter the finance staff name first.'
            : 'Please enter the seller name first.';
        return;
      }
    }

    const ids = this.bulkIdInput
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      this.globalError = 'Please enter at least one student ID.';
      return;
    }

    const unique = [...new Set(ids)];

    this.rows = unique.map((id) => ({
      student_id: id,
      wrong_amount: this.useSharedValues ? this.sharedWrongAmount : null,
      exact_amount: this.useSharedValues ? this.sharedExactAmount : null,
      seller_name: this.useSharedValues ? this.sharedSellerName : '',
      status: 'idle',
      message: '',
      difference:
        this.useSharedValues && this.sharedWrongAmount != null && this.sharedExactAmount != null
          ? this.sharedExactAmount - this.sharedWrongAmount
          : null,
    }));

    this.cdr.markForCheck();
  }

  applySharedToAll(): void {
    this.rows = this.rows.map((row) => ({
      ...row,
      wrong_amount: this.sharedWrongAmount,
      exact_amount: this.sharedExactAmount,
      seller_name: this.sharedSellerName,
      difference:
        this.sharedWrongAmount != null && this.sharedExactAmount != null
          ? this.sharedExactAmount - this.sharedWrongAmount
          : null,
    }));
    this.cdr.markForCheck();
  }

  updateRowDiff(row: CorrectionRow): void {
    row.difference =
      row.wrong_amount != null && row.exact_amount != null
        ? row.exact_amount - row.wrong_amount
        : null;
  }

  removeRow(index: number): void {
    this.rows.splice(index, 1);
    this.cdr.markForCheck();
  }

  get canSubmit(): boolean {
    return (
      this.rows.length > 0 &&
      this.rows.every(
        (r) =>
          r.student_id.trim() &&
          r.wrong_amount != null &&
          r.wrong_amount > 0 &&
          r.exact_amount != null &&
          r.exact_amount > 0 &&
          r.seller_name.trim(),
      )
    );
  }

  async submitCorrections(): Promise<void> {
    this.showConfirmModal = false;
    this.isProcessing = true;
    this.isComplete = false;
    this.successCount = 0;
    this.failCount = 0;

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      row.status = 'processing';
      this.cdr.markForCheck();

      await new Promise<void>((resolve) => {
        const call =
          this.activeTab === 'finance'
            ? this.staffService.correctWrongCredit(
                row.student_id,
                row.wrong_amount!,
                row.seller_name,
                row.exact_amount!,
              )
            : this.staffService.correctWrongChargeBySeller(
                row.student_id,
                row.wrong_amount!,
                row.seller_name,
                row.exact_amount!,
              );

        call.pipe(takeUntil(this.destroy$)).subscribe({
          next: (res: any) => {
            if (res?.success === true) {
              row.status = 'success';
              row.message = res.message || 'Corrected successfully';
              this.successCount++;
            } else {
              row.status = 'failed';
              row.message = res?.message || 'Failed';
              this.failCount++;
            }
            this.cdr.markForCheck();
            resolve();
          },
          error: (err: any) => {
            row.status = 'failed';
            row.message = err?.error?.message || 'Server error';
            this.failCount++;
            this.cdr.markForCheck();
            resolve();
          },
        });
      });

      await new Promise((r) => setTimeout(r, 150));
    }

    this.isProcessing = false;
    this.isComplete = true;
    this.cdr.markForCheck();
  }

  // ════════════════════════════════════════════════════════════
  // Zerolise inactive account logic
  // ════════════════════════════════════════════════════════════

  get zeroliseCanSubmit(): boolean {
    return this.zeroliseRows.length > 0;
  }

  parseZeroliseBulkIds(): void {
    this.globalError = '';
    const ids = this.zeroliseBulkIdInput
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      this.globalError = 'Please enter at least one student ID.';
      return;
    }

    const unique = [...new Set(ids)];
    this.zeroliseRows = unique.map((id) => ({
      student_id: id,
      status: 'idle',
      message: '',
    }));
    this.cdr.markForCheck();
  }

  removeZeroliseRow(index: number): void {
    this.zeroliseRows.splice(index, 1);
    this.cdr.markForCheck();
  }

  async submitZerolise(): Promise<void> {
    this.showConfirmModal = false;
    this.isProcessing = true;
    this.isComplete = false;
    this.successCount = 0;
    this.failCount = 0;

    for (let i = 0; i < this.zeroliseRows.length; i++) {
      const row = this.zeroliseRows[i];
      row.status = 'processing';
      this.cdr.markForCheck();

      await new Promise<void>((resolve) => {
        this.staffService
          .zerolisevoucher(row.student_id, this.auth.getName())
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              if (res?.success === true) {
                row.status = 'success';
                row.message = res.message || 'Balance zeroed successfully';
                this.successCount++;
              } else {
                row.status = 'failed';
                row.message = res?.message || 'Failed';
                this.failCount++;
              }
              this.cdr.markForCheck();
              resolve();
            },
            error: (err: any) => {
              row.status = 'failed';
              row.message = err?.error?.message || 'Server error';
              this.failCount++;
              this.cdr.markForCheck();
              resolve();
            },
          });
      });

      await new Promise((r) => setTimeout(r, 150));
    }

    this.isProcessing = false;
    this.isComplete = true;
    this.cdr.markForCheck();
  }

  // ════════════════════════════════════════════════════════════
  // Shared: confirm modal, reset, seller dropdown, lifecycle
  // ════════════════════════════════════════════════════════════

  openConfirm(): void {
    this.globalError = '';
    if (this.activeTab === 'zerolise') {
      if (!this.zeroliseCanSubmit) {
        this.globalError = 'Please load at least one student ID.';
        return;
      }
    } else if (!this.canSubmit) {
      this.globalError = 'Please fill in all required fields for every row.';
      return;
    }
    this.showConfirmModal = true;
  }

  closeConfirm(): void {
    if (this.isProcessing) return;
    this.showConfirmModal = false;
  }

  reset(): void {
    this.bulkIdInput = '';
    this.rows = [];
    this.zeroliseBulkIdInput = '';
    this.zeroliseRows = [];
    this.sharedWrongAmount = null;
    this.sharedExactAmount = null;
    this.sharedSellerName = '';
    this.isProcessing = false;
    this.isComplete = false;
    this.successCount = 0;
    this.failCount = 0;
    this.globalError = '';
    this.selectedSellerDisplay = '';
    this.sellerDropdownOpen = false;
    this.sellerSearch = '';
    this.sellerList = [];
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.sellerSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.fetchSellers(search);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openSellerDropdown(): void {
    this.sellerDropdownOpen = true;
    this.sellerSearch = '';
    this.fetchSellers('');
    this.cdr.markForCheck();
  }

  closeSellerDropdown(): void {
    this.sellerDropdownOpen = false;
    this.cdr.markForCheck();
  }

  onSellerSearchInput(value: string): void {
    this.sellerSearch = value;
    this.sellerSearchSubject.next(value);
  }

  fetchSellers(search: string): void {
    this.sellerLoading = true;
    this.cdr.markForCheck();

    const call =
      this.activeTab === 'finance'
        ? this.staffService.getStaffListPaginated(1, 20, search)
        : this.sellerService.getSellerList(1, 20, search);

    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.sellerList = res?.data ?? [];
        this.sellerLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sellerList = [];
        this.sellerLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  selectSeller(item: any): void {
    if (this.activeTab === 'finance') {
      this.sharedSellerName = item.staff_id; // payload
      this.selectedSellerDisplay = item.s_name; // display
    } else {
      this.sharedSellerName = item.username; // payload
      this.selectedSellerDisplay = item.s_name; // display
    }
    this.sellerDropdownOpen = false;
    this.cdr.markForCheck();
  }

  clearSeller(): void {
    this.sharedSellerName = '';
    this.selectedSellerDisplay = '';
    this.cdr.markForCheck();
  }
}
