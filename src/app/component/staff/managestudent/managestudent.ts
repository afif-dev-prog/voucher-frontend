import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Staff } from '../../../services/staff';
import { Student } from '../../../services/student';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { AddStudent, StudentModel } from '../../../model/student';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';
import * as XLSX from 'xlsx';

interface BulkStudentRow {
  student_id: string;
  student_name: string;
  nric: string;
  email: string;
  intake: string;
  course_code: string;
  campus: string;
  register_date: string; // display string: "05/12/2022"
  complete_date: string; // display string
  register_date_raw: any; // raw Excel value for Unix conversion
  complete_date_raw: any; // raw Excel value for Unix conversion
  _valid: boolean;
  _errors: string[];
}
interface BulkProgress {
  index: number;
  student_id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  message: string;
}

@Component({
  selector: 'app-managestudent',
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './managestudent.html',
  styleUrl: './managestudent.css',
})
export class Managestudent {
  private staffService = inject(Staff);
  private studentService = inject(Student);
  auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  // Data

  pagedStudents: StudentModel[] = []; // current page slice

  // State
  isLoading = false;
  errorMessage = '';
  searchQuery = '';

  // Pagination
  currentPage = 1;
  readonly pageSize = 10;
  totalCount = 0;
  totalPages = 0;

  // Bulk import state
  showBulkModal = false;
  bulkFile: File | null = null;
  bulkRows: BulkStudentRow[] = [];
  bulkValidRows: BulkStudentRow[] = [];
  bulkInvalidRows: BulkStudentRow[] = [];
  bulkParsed = false;
  bulkError = '';
  isDragging = false;

  // Bulk progress
  showBulkProgress = false;
  bulkProgressItems: BulkProgress[] = [];
  bulkProgressDone = 0;
  bulkProgressFailed = 0;
  isBulkUploading = false;
  bulkUploadComplete = false;

  ngOnInit(): void {
    this.loadStudentList();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  canView(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  loadStudentList(): void {
    this.isLoading = true;

    this.staffService
      .getStudentListPaginated(this.currentPage, this.pageSize, this.searchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.pagedStudents = response.data; // show directly
          this.totalCount = response.pagination.totalCount;
          this.totalPages = response.pagination.totalPages;
          this.hasPrevious = response.pagination.hasPrevious; // ← this is what
          this.hasNext = response.pagination.hasNext; //   drives the UI
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Failed to load student list.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private formatDateDisplay(value: any): string {
    if (!value && value !== 0) return '';

    // Excel serial number → format as dd/MM/yyyy
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }

    const str = String(value).trim();
    if (!str) return '';

    // Already in dd/MM/yyyy — return as-is
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return str;

    // ISO or other parseable string → reformat
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}/${m}/${y}`;
    }

    return str; // fallback: show whatever it is
  }

  setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(400), // wait 400ms after user stops typing
        distinctUntilChanged(), // don't call if same value
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.currentPage = 1; // reset to page 1
        this.loadStudentList();
      });
  }

  // Called on every keystroke — filters then paginates
  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  onClearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    // this.applyFilterAndPaginate();
    this.loadStudentList();
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadStudentList();
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }
  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  hasPrevious: boolean = false;
  hasNext: boolean = false;

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

  // Global row number across pages
  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  // Add these new properties alongside your existing ones
  showAddModal = false;
  isSubmitting = false;
  addErrorMessage = '';
  addSuccessMessage = '';

  newStudentForm: any = {
    student_id: '',
    student_name: '',
    nric: '',
    email: '',
    balance: 0,
    password: '',
    register_date: 0,
    complete_date: 0,
    date_update: 0,
    month_credit: '',
    status: 'active',
    last_password_change: 0,
    firstTime: 'yes',
    intake: '',
    course_code: '',
    campus: '',
  };

  // Open / Close modal
  openAddModal(): void {
    this.resetForm();
    this.showAddModal = true;
    this.isSubmitting = false;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newStudentForm = {
      student_id: '',
      student_name: '',
      nric: '',
      email: '',
      balance: 0,
      password: '',
      register_date: 0,
      complete_date: 0,
      date_update: 0,
      month_credit: '',
      status: 'active',
      last_password_change: 0,
      firstTime: 'yes',
      intake: '',
      course_code: '',
      campus: '',
    }; // reset to empty object
    this.addErrorMessage = '';
    this.addSuccessMessage = '';
    this.isSubmitting = false;
  }

  // Close modal when clicking backdrop
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeAddModal();
    }
  }
  toUnixTimestamp(dateStr: string): number | null {
    if (!dateStr) return null;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  }

  // Convert Unix timestamp → "yyyy-MM-dd" for date picker (if you need reverse)
  fromUnixTimestamp(unix: number): string {
    if (!unix) return '';
    return new Date(unix * 1000).toISOString().split('T')[0];
  }

  submitAddStudent(): void {
    // Validation
    if (!this.newStudentForm.student_id.trim()) {
      this.addErrorMessage = 'Student ID is required.';
      return;
    }
    if (!this.newStudentForm.student_name.trim()) {
      this.addErrorMessage = 'Full Name is required.';
      return;
    }
    if (!this.newStudentForm.nric.trim()) {
      this.addErrorMessage = 'IC Number is required.';
      return;
    }
    if (!this.newStudentForm.email.trim()) {
      this.addErrorMessage = 'Email is required.';
      return;
    }
    if (!this.newStudentForm.intake.trim()) {
      this.addErrorMessage = 'Intake is required.';
      return;
    }
    if (!this.newStudentForm.course_code.trim()) {
      this.addErrorMessage = 'Course Code is required.';
      return;
    }
    if (!this.newStudentForm.campus.trim()) {
      this.addErrorMessage = 'Campus is required.';
      return;
    }
    if (!this.newStudentForm.register_date) {
      this.addErrorMessage = 'Register Date is required.';
      return;
    }

    this.isSubmitting = true;
    this.addErrorMessage = '';

    // Build payload — convert date strings to Unix timestamps here
    const payload = {
      ...this.newStudentForm,
      register_date: this.toUnixTimestamp(this.newStudentForm.register_date)!,
      complete_date: this.toUnixTimestamp(this.newStudentForm.complete_date)!,
    };

    this.staffService
      .addStudent(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.closeAddModal();
            this.currentPage = 1;
            this.loadStudentList();
          } else {
            this.addErrorMessage = response.message || 'Failed to add student.';
          }
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.addErrorMessage = 'Something went wrong. Please try again.';
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  // Edit modal state
  showEditModal = false;
  isUpdating = false;
  editErrorMessage = '';
  editStudentForm: any = {};

  // Delete modal state
  showDeleteModal = false;
  isDeleting = false;
  studentToDelete: any = null;
  studentId: string = ''; // assuming student_id is the identifier for update

  // ── EDIT ──────────────────────────────────────────
  openEditModal(studentId: string, student: any): void {
    this.studentId = studentId;
    this.editStudentForm = {
      ...student,
      // convert unix timestamps → date string for date picker
      register_date: this.fromUnixTimestamp(student.register_date),
      complete_date: this.fromUnixTimestamp(student.complete_date),
    };
    this.editErrorMessage = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editStudentForm = {};
    this.editErrorMessage = '';
    this.isUpdating = false;
  }

  onEditBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeEditModal();
    }
  }

  submitEditStudent(): void {
    if (!this.editStudentForm.student_id?.trim()) {
      this.editErrorMessage = 'Student ID is required.';
      return;
    }
    if (!this.editStudentForm.student_name?.trim()) {
      this.editErrorMessage = 'Full Name is required.';
      return;
    }
    if (!this.editStudentForm.nric?.trim()) {
      this.editErrorMessage = 'IC Number is required.';
      return;
    }
    if (!this.editStudentForm.email?.trim()) {
      this.editErrorMessage = 'Email is required.';
      return;
    }
    if (!this.editStudentForm.register_date) {
      this.editErrorMessage = 'Register Date is required.';
      return;
    }

    this.isUpdating = true;
    this.editErrorMessage = '';

    const payload = {
      ...this.editStudentForm,
      register_date: this.toUnixTimestamp(this.editStudentForm.register_date)!,
      complete_date: this.toUnixTimestamp(this.editStudentForm.complete_date),
    };

    this.staffService
      .updateStudent(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.closeEditModal();
            this.loadStudentList();
          } else {
            this.editErrorMessage = response.message || 'Failed to update student.';
          }
          this.isUpdating = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.editErrorMessage = 'Something went wrong. Please try again.';
          this.isUpdating = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── DELETE ────────────────────────────────────────
  openDeleteModal(student: any): void {
    this.studentToDelete = student;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.studentToDelete = null;
    this.isDeleting = false;
  }

  onDeleteBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeDeleteModal();
    }
  }

  confirmDelete(): void {
    if (!this.studentToDelete) return;
    this.isDeleting = true;

    this.staffService
      .deleteStudent(this.studentToDelete.student_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.closeDeleteModal();
            // Go back to page 1 if last item on current page was deleted
            if (this.pagedStudents.length === 1 && this.currentPage > 1) {
              this.currentPage--;
            }
            this.loadStudentList();
          } else {
            this.isDeleting = false;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isDeleting = false;
          this.cdr.markForCheck();
        },
      });
  }

  // Transaction modal state
  showTransactionModal = false;
  isLoadingTransactions = false;
  isLoadingMoreTransactions = false;
  transactions: any[] = [];
  transactionPage = 1;
  readonly transactionPageSize = 10;
  transactionTotalCount = 0;
  transactionHasNext = false;
  selectedStudent: any = null;

  // Open transaction modal
  openTransactionModal(student: any): void {
    this.selectedStudent = student;
    this.transactions = [];
    this.transactionPage = 1;
    this.transactionTotalCount = 0;
    this.transactionHasNext = false;
    this.showTransactionModal = true;
    this.loadTransactions();
  }

  closeTransactionModal(): void {
    this.showTransactionModal = false;
    this.selectedStudent = null;
    this.transactions = [];
    this.isLoadingTransactions = false;
    this.isLoadingMoreTransactions = false;
  }

  onTransactionBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeTransactionModal();
    }
  }

  loadTransactions(): void {
    this.isLoadingTransactions = true;

    this.studentService
      .getTransactionsPaginated(this.selectedStudent.student_id, 1, this.transactionPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.transactions = response?.data;
          // console.log(this.transactions);
          this.transactionTotalCount = response?.pagination?.totalCount;
          this.transactionHasNext = response?.pagination?.hasNext;
          this.transactionPage = 1;
          this.isLoadingTransactions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingTransactions = false;
          this.cdr.markForCheck();
        },
      });
  }

  loadMoreTransactions(): void {
    if (!this.transactionHasNext || this.isLoadingMoreTransactions) return;

    this.isLoadingMoreTransactions = true;
    const nextPage = this.transactionPage + 1;

    this.studentService
      .getTransactionsPaginated(this.selectedStudent.student_id, nextPage, this.transactionPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.transactions = [...this.transactions, ...response.data]; // append
          this.transactionHasNext = response.pagination.hasNext;
          this.transactionPage = nextPage;
          this.isLoadingMoreTransactions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingMoreTransactions = false;
          this.cdr.markForCheck();
        },
      });
  }
  // In the component TS
  resetPasswordResult: { userId: string; tempPassword: string } | null = null;
  showResetModal = false;
  isResetting = false;
  resetTargetId = '';
  resetError = '';
  readonly studentUserType = 1;

  openResetModal(userId: string): void {
    this.resetTargetId = userId;
    this.resetPasswordResult = null;
    this.resetError = '';
    this.showResetModal = true;
  }

  closeResetModal(): void {
    this.showResetModal = false;
    this.resetPasswordResult = null;
    this.resetError = '';
  }

  confirmReset(userId: string, userType: number): void {
    this.isResetting = true;
    this.resetError = '';

    this.auth.resetPassword(userId, userType, '').subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.resetPasswordResult = {
            userId,
            tempPassword: res.temporary_password,
          };
        } else {
          this.resetError = res?.message || 'Failed to reset password.';
        }
        this.isResetting = false;
        this.cdr.markForCheck();
      },
    });
  }

  readonly bulkTemplateHeaders = [
    'student_id',
    'student_name',
    'nric',
    'email',
    'intake',
    'course_code',
    'campus',
    'register_date',
    'complete_date',
  ];

  get bulkProgressPercent(): number {
    if (!this.bulkProgressItems.length) return 0;
    const done = this.bulkProgressItems.filter(
      (p) => p.status === 'success' || p.status === 'failed',
    ).length;
    return Math.round((done / this.bulkProgressItems.length) * 100);
  }

  openBulkModal(): void {
    this.resetBulk();
    this.showBulkModal = true;
  }

  closeBulkModal(): void {
    if (this.isBulkUploading) return;
    this.showBulkModal = false;
    this.resetBulk();
  }

  resetBulk(): void {
    this.bulkFile = null;
    this.bulkRows = [];
    this.bulkValidRows = [];
    this.bulkInvalidRows = [];
    this.bulkParsed = false;
    this.bulkError = '';
    this.showBulkProgress = false;
    this.bulkProgressItems = [];
    this.bulkUploadComplete = false;
    this.isBulkUploading = false;
    this.cdr.markForCheck();
  }

  onBulkDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onBulkDragLeave(): void {
    this.isDragging = false;
  }

  onBulkDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.handleBulkFile(file);
  }

  onBulkFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.handleBulkFile(file);
  }

  handleBulkFile(file: File): void {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.bulkError = 'Only .xlsx or .xls files are accepted.';
      return;
    }
    this.bulkFile = file;
    this.bulkError = '';
    this.parseBulkExcel(file);
  }

  parseBulkExcel(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });

        // Filter empty rows — also skip the hint row
        const dataRows = rows.filter((row) => {
          const id = String(row['student_id'] ?? '').trim();
          const name = String(row['student_name'] ?? '').trim();
          // Skip hint row (where student_id is empty and register_date contains 'dd/MM')
          const regDate = String(row['register_date'] ?? '').trim();
          if (!id && !name) return false;
          if (regDate.toLowerCase().includes('dd/mm')) return false;
          return true;
        });

        const actualCols = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
        const missingCols = this.bulkTemplateHeaders
          .filter((c) => !['complete_date'].includes(c)) // complete_date is optional
          .filter((c) => !actualCols.includes(c));

        if (missingCols.length > 0) {
          this.bulkError = `Missing required columns: ${missingCols.join(', ')}`;
          this.bulkParsed = false;
          this.bulkRows = [];
          this.cdr.markForCheck();
          return;
        }

        this.bulkRows = dataRows.map((row) => {
          const errors: string[] = [];
          const studentId = String(row['student_id'] ?? '').trim();
          const studentName = String(row['student_name'] ?? '').trim();
          const nric = String(row['nric'] ?? '').trim();
          const email = String(row['email'] ?? '').trim();
          const intake = String(row['intake'] ?? '').trim();
          const courseCode = String(row['course_code'] ?? '').trim();
          const campus = String(row['campus'] ?? '').trim();
          const registerDateRaw = row['register_date'];
          const completeDateRaw = row['complete_date'];

          const registerDateDisplay = this.formatDateDisplay(registerDateRaw);
          const completeDateDisplay = this.formatDateDisplay(completeDateRaw);

          if (!studentId) errors.push('student_id required');
          if (!studentName) errors.push('student_name required');
          if (!nric) errors.push('nric required');
          if (!email || !email.includes('@')) errors.push('valid email required');
          if (!intake) errors.push('intake required');
          if (!courseCode) errors.push('course_code required');
          if (!campus) errors.push('campus required');

          if (!registerDateDisplay) {
            errors.push('register_date required');
          } else if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(registerDateDisplay)) {
            errors.push('register_date must be dd/MM/yyyy');
          }

          return {
            student_id: studentId,
            student_name: studentName,
            nric,
            email,
            intake,
            course_code: courseCode,
            campus,
            register_date: registerDateDisplay, // shown in preview
            complete_date: completeDateDisplay, // shown in preview
            register_date_raw: registerDateRaw, // used for Unix conversion
            complete_date_raw: completeDateRaw, // used for Unix conversion
            _valid: errors.length === 0,
            _errors: errors,
          } as BulkStudentRow;
        });

        // Duplicate check
        const seenIds = new Set<string>();
        this.bulkRows = this.bulkRows.map((row) => {
          if (seenIds.has(row.student_id)) {
            return { ...row, _valid: false, _errors: [...row._errors, 'duplicate student_id'] };
          }
          seenIds.add(row.student_id);
          return row;
        });

        this.bulkValidRows = this.bulkRows.filter((r) => r._valid);
        this.bulkInvalidRows = this.bulkRows.filter((r) => !r._valid);
        this.bulkParsed = true;
        this.bulkError = '';
        this.cdr.markForCheck();
      } catch {
        this.bulkError = 'Failed to parse Excel file.';
        this.cdr.markForCheck();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  removeBulkRow(index: number): void {
    this.bulkRows.splice(index, 1);
    this.bulkValidRows = this.bulkRows.filter((r) => r._valid);
    this.bulkInvalidRows = this.bulkRows.filter((r) => !r._valid);
    this.cdr.markForCheck();
  }

  downloadBulkTemplate(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'student_id',
        'student_name',
        'nric',
        'email',
        'intake',
        'course_code',
        'campus',
        'register_date',
        'complete_date',
      ],
      ['', '', '', '', '', '', '', 'dd/MM/yyyy', 'dd/MM/yyyy (optional)'], // format hint row
    ]);

    // Force date columns (H and I) to text so Excel doesn't convert them
    for (let row = 0; row <= 1; row++) {
      ['H', 'I'].forEach((col) => {
        const cell = ws[`${col}${row + 1}`];
        if (cell) {
          cell.t = 's';
          cell.z = '@';
        }
      });
    }

    // Pre-fill rows 3-100 in date columns as text
    for (let row = 2; row <= 100; row++) {
      ['H', 'I'].forEach((col) => {
        ws[`${col}${row + 1}`] = { t: 's', v: '', z: '@' };
      });
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 100, c: 8 } });
    ws['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_bulk_template.xlsx');
  }
  private parseDateDMY(value: any): number {
    if (!value && value !== 0) return 0;

    // Excel serial number
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return Math.floor(date.getTime() / 1000);
    }

    const str = String(value).trim();
    if (!str) return 0;

    // dd/MM/yyyy format
    const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return Math.floor(date.getTime() / 1000);
    }

    // Fallback: ISO or any other parseable format
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }

    return 0;
  }

  async submitBulkStudents(): Promise<void> {
    if (this.bulkValidRows.length === 0) return;

    this.showBulkProgress = true;
    this.isBulkUploading = true;
    this.bulkUploadComplete = false;
    this.bulkProgressDone = 0;
    this.bulkProgressFailed = 0;
    this.bulkProgressItems = this.bulkValidRows.map((row, i) => ({
      index: i,
      student_id: row.student_id,
      status: 'pending',
      message: '',
    }));
    this.cdr.markForCheck();

    for (let i = 0; i < this.bulkValidRows.length; i++) {
      const row = this.bulkValidRows[i];
      this.bulkProgressItems[i].status = 'processing';
      this.cdr.markForCheck();

      await new Promise<void>((resolve) => {
        const payload = {
          student_id: row.student_id,
          student_name: row.student_name,
          nric: row.nric,
          email: row.email,
          intake: row.intake,
          course_code: row.course_code,
          campus: row.campus,
          register_date: this.parseDateDMY(row.register_date_raw), // ← raw value
          complete_date: this.parseDateDMY(row.complete_date_raw), // ← raw value
        };

        this.staffService
          .addStudent(payload)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              if (res?.success === true) {
                this.bulkProgressItems[i].status = 'success';
                this.bulkProgressItems[i].message = res?.message || 'Added successfully';
                this.bulkProgressDone++;
              } else {
                this.bulkProgressItems[i].status = 'failed';
                this.bulkProgressItems[i].message = res?.message || 'Failed';
                this.bulkProgressFailed++;
              }
              this.cdr.markForCheck();
              resolve();
            },
            error: (err: any) => {
              this.bulkProgressItems[i].status = 'failed';
              this.bulkProgressItems[i].message = err?.error?.message || 'Server error';
              this.bulkProgressFailed++;
              this.cdr.markForCheck();
              resolve();
            },
          });
      });

      await new Promise((r) => setTimeout(r, 100));
    }

    this.isBulkUploading = false;
    this.bulkUploadComplete = true;
    this.loadStudentList(); // refresh the table
    this.cdr.markForCheck();
  }
}
