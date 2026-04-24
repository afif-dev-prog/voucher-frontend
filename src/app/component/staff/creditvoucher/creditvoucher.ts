import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Staff } from '../../../services/staff';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
// import * as Papa from 'papaparse';
// Remove PapaParse import, add SheetJS
import * as XLSX from 'xlsx';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';

interface StudentCredit {
  id: number;
  student_id: string;
  student_name: string;
  nric: string;
  selected: boolean;
}

interface CsvRow {
  student_id: string;
  amount: string;
  month_credit: string;
  user_update: string;
  _valid: boolean;
  _errors: string[];
}

interface UploadProgress {
  index: number;
  total: number;
  student_id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  message: string;
}
@Component({
  selector: 'app-creditvoucher',
  imports: [CommonModule, FormsModule],
  templateUrl: './creditvoucher.html',
  styleUrl: './creditvoucher.css',
})
export class Creditvoucher {
  private staffService = inject(Staff); // adjust to your service
  private cdr = inject(ChangeDetectorRef);

  private auth = inject(Auth);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // ── Tabs ──────────────────────────────────
  activeTab: 'individual' | 'bulk' = 'individual';

  // ── Individual — Student Search ───────────
  searchQuery = '';
  searchResults: StudentCredit[] = [];
  selectedStudents: StudentCredit[] = [];
  isSearching = false;
  hasSearched = false;

  currentUsernameLogged = '';

  // Individual — Credit Form
  creditAmount: number = 0.0;
  creditRemark = '';
  creditMonthCredit = '';
  userUpdate = '';
  isSubmittingIndividual = false;
  individualError = '';
  individualSuccess = '';

  resprogress: any = [];

  // Individual — Confirm modal
  showIndividualConfirm = false;
  currentUser: string = 'admin';
  // ── Bulk ──────────────────────────────────
  csvFile: File | null = null;
  csvRows: CsvRow[] = [];
  csvValidRows: CsvRow[] = [];
  csvInvalidRows: CsvRow[] = [];
  csvParsed = false;
  csvError = '';
  isDragging = false;

  // Bulk progress
  showProgress = false;
  progressItems: UploadProgress[] = [];
  progressDone = 0;
  progressFailed = 0;
  isUploading = false;
  uploadComplete = false;

  // ── CSV Template columns ──────────────────
  readonly csvTemplateHeaders = ['student_id', 'amount', 'month_credit'];

  ngOnInit(): void {
    this.setupSearch();
    this.currentUsernameLogged = this.auth.getName() ?? 'Admin';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Tab ───────────────────────────────────
  switchTab(tab: 'individual' | 'bulk'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  // ── Individual: Search ────────────────────
  setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        if (query.trim().length < 2) {
          this.searchResults = [];
          this.hasSearched = false;
          return;
        }
        this.runSearch(query);
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  runSearch(query: string): void {
    this.isSearching = true;
    this.hasSearched = true;

    this.staffService
      .getStudentListPaginated(1, 20, query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.searchResults = (res.data || []).map((s: any) => ({
            ...s,
            selected: this.selectedStudents.some((sel) => sel.student_id === s.student_id),
          }));
          this.isSearching = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSearching = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleStudent(student: StudentCredit): void {
    const idx = this.selectedStudents.findIndex((s) => s.student_id === student.student_id);
    if (idx > -1) {
      this.selectedStudents.splice(idx, 1);
      student.selected = false;
    } else {
      this.selectedStudents.push({ ...student, selected: true });
      student.selected = true;
    }
    // sync search results checkboxes
    const inResults = this.searchResults.find((s) => s.student_id === student.student_id);
    if (inResults) inResults.selected = student.selected;
    this.cdr.markForCheck();
  }

  removeSelected(student: StudentCredit): void {
    this.selectedStudents = this.selectedStudents.filter(
      (s) => s.student_id !== student.student_id,
    );
    const inResults = this.searchResults.find((s) => s.student_id === student.student_id);
    if (inResults) inResults.selected = false;
    this.cdr.markForCheck();
  }

  clearAllSelected(): void {
    this.selectedStudents = [];
    this.searchResults.forEach((s) => (s.selected = false));
    this.cdr.markForCheck();
  }

  get allSearchSelected(): boolean {
    return this.searchResults.length > 0 && this.searchResults.every((s) => s.selected);
  }

  toggleSelectAllSearch(): void {
    if (this.allSearchSelected) {
      this.searchResults.forEach((s) => this.removeSelected(s));
    } else {
      this.searchResults.forEach((s) => {
        if (!s.selected) this.toggleStudent(s);
      });
    }
  }

  // Individual: Submit
  openIndividualConfirm(): void {
    this.individualError = '';
    if (this.selectedStudents.length === 0) {
      this.individualError = 'Please select at least one student.';
      return;
    }
    if (!this.creditAmount || this.creditAmount <= 0) {
      this.individualError = 'Please enter a valid amount.';
      return;
    }
    if (!this.creditMonthCredit.trim()) {
      this.individualError = 'Month/credit period is required.';
      return;
    }
    this.showIndividualConfirm = true;
  }

  closeIndividualConfirm(): void {
    this.showIndividualConfirm = false;
  }

  async submitIndividual(): Promise<void> {
    this.showIndividualConfirm = false;
    this.isSubmittingIndividual = true;
    this.individualError = '';
    this.individualSuccess = '';

    const payloads = this.selectedStudents.map((s) => ({
      student_id: s.student_id,
      amount: this.creditAmount,
      remark: this.creditRemark,
      month_credit: this.creditMonthCredit,
      user_update: this.currentUsernameLogged,
    }));

    // Sequential submission with per-student result
    this.showProgress = true;
    this.progressItems = payloads.map((p, i) => ({
      index: i,
      total: payloads.length,
      student_id: p.student_id,
      status: 'pending',
      message: '',
    }));
    this.progressDone = 0;
    this.progressFailed = 0;
    this.isUploading = true;
    this.uploadComplete = false;
    this.cdr.markForCheck();

    for (let i = 0; i < payloads.length; i++) {
      this.progressItems[i].status = 'processing';
      this.cdr.markForCheck();

      await new Promise<void>((resolve) => {
        this.staffService
          .parkvouchertofloat({
            student_id: payloads[i].student_id,
            credit: payloads[i].amount,
            month_credit: payloads[i].month_credit,
            user_update: payloads[i].user_update,
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              if (res?.success !== false) {
                this.progressItems[i].status = 'success';
                this.progressItems[i].message = 'Credited successfully';
                this.progressDone++;
              } else {
                this.progressItems[i].status = 'failed';
                this.progressItems[i].message = res?.message || 'Failed';
                this.progressFailed++;
              }
              this.cdr.markForCheck();
              resolve();
            },
            error: (err: any) => {
              this.progressItems[i].status = 'failed';
              this.progressItems[i].message = err?.error?.message || 'Server error';
              this.progressFailed++;
              this.cdr.markForCheck();
              resolve();
            },
          });
      });

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 120));
    }

    this.isUploading = false;
    this.uploadComplete = true;
    this.isSubmittingIndividual = false;
    this.cdr.markForCheck();
  }

  resetIndividual(): void {
    this.selectedStudents = [];
    this.searchResults.forEach((s) => (s.selected = false));
    this.creditAmount = 0.0;
    this.creditRemark = '';
    this.creditMonthCredit = '';
    this.individualError = '';
    this.individualSuccess = '';
    this.showProgress = false;
    this.progressItems = [];
    this.uploadComplete = false;
    this.cdr.markForCheck();
  }

  // ── Bulk: CSV ─────────────────────────────
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }
  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.handleExcelFile(file);
  }

  onFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.handleExcelFile(file);
  }

  handleExcelFile(file: File): void {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.csvError = 'Only .xlsx or .xls files are accepted.';
      return;
    }
    this.csvFile = file;
    this.csvError = '';
    this.parseExcel(file);
  }

  private formatMonthCredit(serial: number): string {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  parseExcel(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });

        const requiredCols = this.csvTemplateHeaders;
        const actualCols = rows.length > 0 ? Object.keys(rows[0]) : [];
        const missingCols = requiredCols.filter((c) => !actualCols.includes(c));

        if (missingCols.length > 0) {
          this.csvError = `Missing required columns: ${missingCols.join(', ')}`;
          this.csvParsed = false;
          this.csvRows = [];
          this.cdr.markForCheck();
          return;
        }

        this.csvRows = rows.map((row) => {
          const errors: string[] = [];
          const studentId = String(row['student_id'] ?? '').trim();
          const amount = String(row['amount'] ?? '').trim();
          const rawMonthCredit = row['month_credit'];
          const monthCredit =
            typeof rawMonthCredit === 'number'
              ? this.formatMonthCredit(rawMonthCredit)
              : String(rawMonthCredit ?? '').trim();

          if (!studentId) errors.push('student_id required');
          if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
            errors.push('invalid amount');
          if (!monthCredit) errors.push('month_credit required');

          return {
            student_id: studentId,
            amount,
            month_credit: monthCredit,
            user_update: this.currentUsernameLogged,
            _valid: errors.length === 0,
            _errors: errors,
          } as CsvRow;
        });

        this.csvValidRows = this.csvRows.filter((r) => r._valid);
        this.csvInvalidRows = this.csvRows.filter((r) => !r._valid);
        this.csvParsed = true;
        this.csvError = '';
        this.cdr.markForCheck();
      } catch {
        this.csvError = 'Failed to parse Excel file.';
        this.cdr.markForCheck();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  removeCsvRow(index: number): void {
    this.csvRows.splice(index, 1);
    this.csvValidRows = this.csvRows.filter((r) => r._valid);
    this.csvInvalidRows = this.csvRows.filter((r) => !r._valid);
    this.cdr.markForCheck();
  }

  resetCsv(): void {
    this.csvFile = null;
    this.csvRows = [];
    this.csvValidRows = [];
    this.csvInvalidRows = [];
    this.csvParsed = false;
    this.csvError = '';
    this.showProgress = false;
    this.progressItems = [];
    this.uploadComplete = false;
    this.cdr.markForCheck();
  }

  downloadCsvTemplate(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['student_id', 'amount', 'month_credit'],
      ['3511050633', '50.00', 'April 2026'],
    ]);

    // Force month_credit column (C) to text format so Excel won't auto-convert
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let row = 0; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 }); // column C = index 2
      if (ws[cellAddress]) {
        ws[cellAddress].t = 's'; // force type to string
        ws[cellAddress].z = '@'; // cell format = Text
      }
    }

    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Credit Voucher');
    XLSX.writeFile(wb, 'credit_voucher_template.xlsx');
  }
  async submitBulk(): Promise<void> {
    if (this.csvValidRows.length === 0) return;

    this.showProgress = true;
    this.isUploading = true;
    this.uploadComplete = false;
    this.progressDone = 0;
    this.progressFailed = 0;
    this.progressItems = this.csvValidRows.map((row, i) => ({
      index: i,
      total: this.csvValidRows.length,
      student_id: row.student_id,
      status: 'pending',
      message: '',
    }));
    this.cdr.markForCheck();

    for (let i = 0; i < this.csvValidRows.length; i++) {
      const row = this.csvValidRows[i];
      this.progressItems[i].status = 'processing';
      this.cdr.markForCheck();

      await new Promise<void>((resolve) => {
        this.staffService
          .parkvouchertofloat({
            student_id: row.student_id,
            credit: Number(row.amount),
            month_credit: row.month_credit,
            user_update: this.currentUsernameLogged,
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              if (res?.success !== false) {
                this.progressItems[i].status = 'success';
                this.progressItems[i].message = res?.message || 'Success';
                this.progressDone++;
              } else {
                this.progressItems[i].status = 'failed';
                this.progressItems[i].message = res?.message || 'Failed';
                this.progressFailed++;
              }
              this.cdr.markForCheck();
              resolve();
            },
            error: (err: any) => {
              this.progressItems[i].status = 'failed';
              this.progressItems[i].message = err?.error?.message || 'Server error';
              this.progressFailed++;
              this.cdr.markForCheck();
              resolve();
            },
          });
      });

      await new Promise((r) => setTimeout(r, 120));
    }

    this.isUploading = false;
    this.uploadComplete = true;
    this.cdr.markForCheck();
  }

  get progressPercent(): number {
    if (!this.progressItems.length) return 0;
    const done = this.progressItems.filter(
      (p) => p.status === 'success' || p.status === 'failed',
    ).length;
    return Math.round((done / this.progressItems.length) * 100);
  }
}
