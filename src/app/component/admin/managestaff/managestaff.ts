import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Staff } from '../../../services/staff';
import { Auth } from '../../../services/auth';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { StaffModel } from '../../../model/student';

@Component({
  selector: 'app-managestaff',
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './managestaff.html',
  styleUrl: './managestaff.css',
})
export class Managestaff {
  private staffService = inject(Staff);
  // private studentService = inject(Student);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  // Data

  pagedStaffs: StaffModel[] = []; // current page slice

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
  // bulkRows: BulkStudentRow[] = [];
  // bulkValidRows: BulkStudentRow[] = [];
  // bulkInvalidRows: BulkStudentRow[] = [];
  bulkParsed = false;
  bulkError = '';
  isDragging = false;

  // Bulk progress
  showBulkProgress = false;
  // bulkProgressItems: BulkProgress[] = [];
  bulkProgressDone = 0;
  bulkProgressFailed = 0;
  isBulkUploading = false;
  bulkUploadComplete = false;

  ngOnInit(): void {
    this.loadStaffList();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStaffList(): void {
    this.isLoading = true;

    this.staffService
      .getStaffListPaginated(this.currentPage, this.pageSize, this.searchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.pagedStaffs = response.data; // show directly
          console.log(this.pagedStaffs);
          this.totalCount = response.pagination.totalCount;
          this.totalPages = response.pagination.totalPages;
          this.hasPrevious = response.pagination.hasPrevious; // ← this is what
          this.hasNext = response.pagination.hasNext; //   drives the UI
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Failed to load staff list.';
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
        this.loadStaffList();
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
    this.loadStaffList();
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadStaffList();
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

  newStaffForm: any = {
    staff_id: '',
    s_name: '',
    s_nickname: '',
    s_email: '',
    s_location: '',
    s_designation: '',
    lvl_access: '',
    s_hiredate: 0,
    date_update: 0,
    staff_status: 'active',
    s_campus: '',
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
    this.newStaffForm = {
      staff_id: '',
      s_name: '',
      s_nickname: '',
      s_email: '',
      s_location: '',
      s_designation: '',
      lvl_access: '',
      s_hiredate: 0,
      date_update: 0,
      staff_status: 'active',
      s_campus: '',
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

  submitAddStaff(): void {
    // Validation
    if (!this.newStaffForm.staff_id.trim()) {
      this.addErrorMessage = 'Staff ID is required.';
      return;
    }
    if (!this.newStaffForm.s_name.trim()) {
      this.addErrorMessage = 'Full Name is required.';
      return;
    }
    if (!this.newStaffForm.s_nickname.trim()) {
      this.addErrorMessage = 'Nickname is required.';
      return;
    }
    if (!this.newStaffForm.s_email.trim()) {
      this.addErrorMessage = 'Email is required.';
      return;
    }
    if (!this.newStaffForm.intake.trim()) {
      this.addErrorMessage = 'Intake is required.';
      return;
    }
    if (!this.newStaffForm.course_code.trim()) {
      this.addErrorMessage = 'Course Code is required.';
      return;
    }
    if (!this.newStaffForm.s_campus.trim()) {
      this.addErrorMessage = 'Campus is required.';
      return;
    }
    if (!this.newStaffForm.s_hiredate) {
      this.addErrorMessage = 'Hire Date is required.';
      return;
    }

    this.isSubmitting = true;
    this.addErrorMessage = '';

    // Build payload — convert date strings to Unix timestamps here
    const payload = {
      ...this.newStaffForm,
      s_hiredate: this.toUnixTimestamp(this.newStaffForm.s_hiredate)!,
    };

    this.staffService
      .addStaff(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.closeAddModal();
            this.currentPage = 1;
            this.loadStaffList();
          } else {
            this.addErrorMessage = response.message || 'Failed to add staff.';
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
  editStaffForm: any = {};

  // Delete modal state
  showDeleteModal = false;
  isDeleting = false;
  staffToDelete: any = null;
  staffId: string = ''; // assuming student_id is the identifier for update

  // ── EDIT ──────────────────────────────────────────
  openEditModal(staffId: string, staff: any): void {
    this.staffId = staffId;
    this.editStaffForm = {
      ...staff,
      // convert unix timestamps → date string for date picker
      s_hiredate: this.fromUnixTimestamp(staff.s_hiredate),
    };
    this.editErrorMessage = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editStaffForm = {};
    this.editErrorMessage = '';
    this.isUpdating = false;
  }

  onEditBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeEditModal();
    }
  }

  submitEditStaff(): void {
    if (!this.editStaffForm.staff_id?.trim()) {
      this.editErrorMessage = 'Staff ID is required.';
      return;
    }
    if (!this.editStaffForm.s_name?.trim()) {
      this.editErrorMessage = 'Full Name is required.';
      return;
    }
    if (!this.editStaffForm.s_nickname?.trim()) {
      this.editErrorMessage = 'Nickname is required.';
      return;
    }
    if (!this.editStaffForm.s_email?.trim()) {
      this.editErrorMessage = 'Email is required.';
      return;
    }
    if (!this.editStaffForm.s_hiredate) {
      this.editErrorMessage = 'Hire Date is required.';
      return;
    }

    this.isUpdating = true;
    this.editErrorMessage = '';

    const payload = {
      ...this.editStaffForm,
      s_hiredate: this.toUnixTimestamp(this.editStaffForm.s_hiredate)!,
    };

    this.staffService
      .updateStaff(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.closeEditModal();
            this.loadStaffList();
          } else {
            this.editErrorMessage = response.message || 'Failed to update staff.';
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
  openDeleteModal(staff: any): void {
    this.staffToDelete = staff;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.staffToDelete = null;
    this.isDeleting = false;
  }

  onDeleteBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeDeleteModal();
    }
  }

  confirmDelete(): void {
    if (!this.staffToDelete) return;
    this.isDeleting = true;

    this.staffService
      .deleteStaff(this.staffToDelete.staff_id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.closeDeleteModal();
            // Go back to page 1 if last item on current page was deleted
            if (this.pagedStaffs.length === 1 && this.currentPage > 1) {
              this.currentPage--;
            }
            this.loadStaffList();
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
  selectedStaff: any = null;

  // In the component TS
  resetPasswordResult: { userId: string; tempPassword: string } | null = null;
  showResetModal = false;
  isResetting = false;
  resetTargetId = '';
  resetError = '';
  readonly staffUserType = 3;

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
}
