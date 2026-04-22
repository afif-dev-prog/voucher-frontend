import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Staff } from '../../../services/staff';
import { Student } from '../../../services/student';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { AddStudent, StudentModel } from '../../../model/student';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-managestudent',
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './managestudent.html',
  styleUrl: './managestudent.css',
})
export class Managestudent {
  private staffService = inject(Staff);
  private studentService = inject(Student);
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

  ngOnInit(): void {
    this.loadStudentList();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
}
