import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { Seller } from '../../../services/seller';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-manageseller',
  imports: [CommonModule, FormsModule],
  templateUrl: './manageseller.html',
  styleUrl: './manageseller.css',
})
export class Manageseller {
  private sellerService = inject(Seller);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private sanitizer = inject(DomSanitizer);
  private rawPdfUrl: string = '';
  // List
  sellers: any[] = [];
  isLoading = false;
  errorMessage = '';
  searchQuery = '';
  currentPage = 1;
  readonly pageSize = 10;
  totalCount = 0;
  totalPages = 0;
  hasPrevious = false;
  hasNext = false;

  // Add modal
  showAddModal = false;
  isSubmitting = false;
  addErrorMessage = '';
  newSeller: any = {};

  // Edit modal
  showEditModal = false;
  isUpdating = false;
  editErrorMessage = '';
  editSellerForm: any = {};

  // Delete modal
  showDeleteModal = false;
  isDeleting = false;
  sellerToDelete: any = null;

  // Transaction modal
  showTxModal = false;
  isLoadingTx = false;
  isLoadingMoreTx = false;
  selectedSeller: any = null;
  transactions: any[] = [];
  txPage = 1;
  readonly txPageSize = 10;
  txTotalCount = 0;
  txHasNext = false;

  txStartDate: string = '';
  txEndDate: string = '';
  isExporting = false;

  showPdfPreview = false;
  pdfPreviewUrl: SafeResourceUrl = '';
  pdfBlob: Blob | null = null;

  ngOnInit(): void {
    this.loadSellers();
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
        this.loadSellers();
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }
  onClearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadSellers();
  }

  loadSellers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.sellerService
      .getSellerList(this.currentPage, this.pageSize, this.searchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.sellers = res.data;
          this.totalCount = res.pagination.totalCount;
          this.totalPages = res.pagination.totalPages;
          this.hasPrevious = res.pagination.hasPrevious;
          this.hasNext = res.pagination.hasNext;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Failed to load sellers.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadSellers();
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
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  // ── ADD ──────────────────────────────────────
  openAddModal(): void {
    this.newSeller = { name: '', email: '', phone: '', password: '', status: 'active' };
    this.addErrorMessage = '';
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.addErrorMessage = '';
    this.isSubmitting = false;
  }

  onAddBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) this.closeAddModal();
  }

  submitAddSeller(): void {
    if (!this.newSeller.s_name.trim()) {
      this.addErrorMessage = 'Name is required.';
      return;
    }
    if (!this.newSeller.s_email.trim()) {
      this.addErrorMessage = 'Email is required.';
      return;
    }
    // if (!this.newSeller.password.trim()) {
    //   this.addErrorMessage = 'Password is required.';
    //   return;
    // }

    this.isSubmitting = true;
    this.addErrorMessage = '';

    this.sellerService
      .addSeller(this.newSeller)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.closeAddModal();
            this.currentPage = 1;
            this.loadSellers();
          } else {
            this.addErrorMessage = res.message || 'Failed to add seller.';
          }
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.addErrorMessage = 'Something went wrong.';
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── EDIT ─────────────────────────────────────
  openEditModal(seller: any): void {
    this.editSellerForm = { ...seller, password: '' };
    this.editErrorMessage = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editErrorMessage = '';
    this.isUpdating = false;
  }

  onEditBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) this.closeEditModal();
  }

  submitEditSeller(): void {
    if (!this.editSellerForm.name?.trim()) {
      this.editErrorMessage = 'Name is required.';
      return;
    }
    if (!this.editSellerForm.email?.trim()) {
      this.editErrorMessage = 'Email is required.';
      return;
    }

    this.isUpdating = true;
    this.editErrorMessage = '';

    // Pass both the form data and the seller's ID separately
    this.sellerService
      .updateSeller(this.editSellerForm, this.editSellerForm.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.closeEditModal();
            this.loadSellers();
          } else {
            this.editErrorMessage = res.message || 'Failed to update seller.';
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

  // ── DELETE ───────────────────────────────────
  openDeleteModal(seller: any): void {
    this.sellerToDelete = seller;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.sellerToDelete = null;
    this.isDeleting = false;
  }

  onDeleteBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) this.closeDeleteModal();
  }

  confirmDelete(): void {
    if (!this.sellerToDelete) return;
    this.isDeleting = true;

    this.sellerService
      .deleteSeller(this.sellerToDelete.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.closeDeleteModal();
            if (this.sellers.length === 1 && this.currentPage > 1) this.currentPage--;
            this.loadSellers();
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

  // ── TRANSACTIONS ─────────────────────────────
  openTxModal(seller: any): void {
    this.selectedSeller = seller;
    console.log(this.selectedSeller);
    this.transactions = [];
    this.txPage = 1;
    this.txTotalCount = 0;
    this.txHasNext = false;
    this.showTxModal = true;
    this.loadTx();
  }

  closeTxModal(): void {
    this.showTxModal = false;
    this.selectedSeller = null;
    this.transactions = [];
  }

  onTxBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) this.closeTxModal();
  }

  loadTx(): void {
    this.isLoadingTx = true;

    this.sellerService
      .getSellerTransactions(
        this.selectedSeller.s_name,
        1,
        this.txPageSize,
        this.dateToUnix(this.txStartDate),
        this.dateToUnixEndOfDay(this.txEndDate),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.transactions = res.data || [];
          console.log(res);
          this.txTotalCount = res.pagination?.totalCount || 0;
          this.txHasNext = res.pagination?.hasNext ?? false;
          this.txPage = 1;
          this.isLoadingTx = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingTx = false;
          this.cdr.markForCheck();
        },
      });
  }

  dateToUnix(dateStr: string): number | undefined {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.split('-').map(Number);
    return Math.floor(new Date(year, month - 1, day).getTime() / 1000);
  }

  dateToUnixEndOfDay(dateStr: string): number | undefined {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.split('-').map(Number);
    return Math.floor(new Date(year, month - 1, day).getTime() / 1000) + 86399;
  }

  loadMoreTx(): void {
    if (!this.txHasNext || this.isLoadingMoreTx) return;
    this.isLoadingMoreTx = true;
    const nextPage = this.txPage + 1;

    this.sellerService
      .getSellerTransactions(
        this.selectedSeller.s_name,
        nextPage,
        this.txPageSize,
        this.dateToUnix(this.txStartDate),
        this.dateToUnixEndOfDay(this.txEndDate),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.transactions = [...this.transactions, ...res.data];
          this.txHasNext = res.pagination.hasNext;
          this.txPage = nextPage;
          this.isLoadingMoreTx = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingMoreTx = false;
          this.cdr.markForCheck();
        },
      });
  }

  applyDateFilter(): void {
    this.txPage = 1;
    this.transactions = [];
    this.loadTx();
  }

  clearDateFilter(): void {
    this.txStartDate = '';
    this.txEndDate = '';
    this.txPage = 1;
    this.transactions = [];
    this.loadTx();
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'status-success';
      case 'INACTIVE':
        return 'status-failed';
      default:
        return 'status-default';
    }
  }

  getTxStatusClass(status: string): string {
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

  // ── Fetch ALL transactions for export (bypasses pagination) ──
  private async fetchAllTxForExport(): Promise<any[]> {
    return new Promise((resolve) => {
      this.sellerService
        .getSellerTransactions(
          this.selectedSeller.s_name,
          1,
          9999,
          this.dateToUnix(this.txStartDate),
          this.dateToUnixEndOfDay(this.txEndDate),
        )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => resolve(res.data || []),
          error: () => resolve([]),
        });
    });
  }

  // ── Step 1: Generate and PREVIEW (called from button) ──
  async previewPdf(): Promise<void> {
    this.isExporting = true;
    this.cdr.markForCheck();

    const allTx = await this.fetchAllTxForExport();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ── Header band ──
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSACTION STATEMENT', 14, 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Official Transaction Record', 14, 20);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(this.selectedSeller.name?.toUpperCase() || '', pageW - 14, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`@${this.selectedSeller.username || ''}`, pageW - 14, 17, { align: 'right' });
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      pageW - 14,
      22,
      { align: 'right' },
    );

    // ── Summary cards ──
    const periodLabel =
      this.txStartDate && this.txEndDate
        ? `${this.txStartDate} to ${this.txEndDate}`
        : this.txStartDate
          ? `From ${this.txStartDate}`
          : this.txEndDate
            ? `Until ${this.txEndDate}`
            : 'All Time';

    const totalCredit = allTx.reduce((s, t) => s + (t.credit || 0), 0);
    const totalDebit = allTx.reduce((s, t) => s + (t.debit || 0), 0);

    const cards = [
      { label: 'PERIOD', value: periodLabel },
      { label: 'TOTAL TRANSACTIONS', value: `${allTx.length}` },
      { label: 'TOTAL CREDIT', value: `RM ${totalCredit.toFixed(2)}` },
      { label: 'TOTAL DEBIT', value: `RM ${totalDebit.toFixed(2)}` },
    ];

    const cardY = 43;
    const cardW = (pageW - 28 - 9) / 4;
    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + 3);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x, cardY, cardW, 18, 2, 2, 'F'); // ✅ taller card: 16 → 18

      // Label
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(card.label, x + 4, cardY + 5);

      // Value — truncate if too long to fit
      const maxWidth = cardW - 8;
      doc.setFontSize(8); // ✅ smaller value font: 9 → 8
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(card.value, x + 4, cardY + 13, {
        maxWidth: maxWidth, // ✅ wraps instead of overflowing
      });
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 65, pageW - 14, 65);

    // ── Table ──
    const rows = allTx.map((tx, i) => [
      (i + 1).toString(),
      new Date(tx.pay_date * 1000).toLocaleString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      tx.student_id || '—',
      tx.debit > 0 ? `- RM ${Number(tx.debit).toFixed(2)}` : '—',
      tx.credit > 0 ? `+ RM ${Number(tx.credit).toFixed(2)}` : '—',
      tx.status || '—',
    ]);

    autoTable(doc, {
      startY: 68,
      tableWidth: 'auto',
      margin: { left: 14, right: 14 },
      head: [['#', 'DATE & TIME', 'STUDENT ID', 'DEBIT', 'CREDIT', 'STATUS']],
      body: rows,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: {
          cellWidth: 20, // ✅ wider: 8 → 10
          halign: 'center',
          valign: 'middle', // ✅ vertically center the number
        },
        1: { cellWidth: 37 },
        2: { cellWidth: 25 },
        3: { cellWidth: 26, halign: 'right', textColor: [220, 38, 38] },
        4: { cellWidth: 26, halign: 'right', textColor: [22, 163, 74] },
        5: { cellWidth: 22, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw as string;
          if (val === 'SUCCESS' || val === 'COMPLETED') data.cell.styles.textColor = [22, 163, 74];
          else if (val === 'PENDING') data.cell.styles.textColor = [161, 98, 7];
          else if (val === 'FAILED') data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    // ── Footer ──
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const y = doc.internal.pageSize.getHeight();
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y - 14, pageW - 14, y - 14);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text('This is a system-generated statement. No signature required.', 14, y - 9);
      doc.text(`Page ${p} of ${totalPages}`, pageW - 14, y - 9, { align: 'right' });
    }

    // ── Convert to blob URL for preview (do NOT save yet) ──
    this.pdfBlob = doc.output('blob');
    // if (this.pdfPreviewUrl) URL.revokeObjectURL(this.pdfPreviewUrl); // cleanup old
    // this.pdfPreviewUrl = URL.createObjectURL(this.pdfBlob);
    this.rawPdfUrl = URL.createObjectURL(this.pdfBlob!);
    this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPdfUrl);

    this.isExporting = false;
    this.showPdfPreview = true;
    this.cdr.markForCheck();
  }

  // ── Step 2: User clicks Download in preview modal ──
  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const a = document.createElement('a');
    a.href = this.rawPdfUrl;
    a.download = `statement_${this.selectedSeller.username}_${Date.now()}.pdf`;
    a.click();
  }

  closePdfPreview(): void {
    this.showPdfPreview = false;
    if (this.rawPdfUrl) {
      URL.revokeObjectURL(this.rawPdfUrl);
      this.rawPdfUrl = '';
    }
    this.pdfPreviewUrl = '';
    this.pdfBlob = null;
  }

  // ── Export CSV ──
  async exportCsv(): Promise<void> {
    this.isExporting = true;
    this.cdr.markForCheck();

    const allTx = await this.fetchAllTxForExport();

    const headers = ['No', 'Date & Time', 'Student ID', 'Debit (RM)', 'Credit (RM)', 'Status'];
    const rows = allTx.map((tx, i) => [
      i + 1,
      new Date(tx.pay_date * 1000).toLocaleString('en-MY'),
      tx.student_id || '',
      tx.debit > 0 ? Number(tx.debit).toFixed(2) : '0.00',
      tx.credit > 0 ? Number(tx.credit).toFixed(2) : '0.00',
      tx.status || '',
    ]);

    const totalCredit = allTx.reduce((s, t) => s + (t.credit || 0), 0);
    const totalDebit = allTx.reduce((s, t) => s + (t.debit || 0), 0);

    const csvLines = [
      [`TRANSACTION STATEMENT - ${this.selectedSeller.name}`],
      [`Username: ${this.selectedSeller.username}`],
      [`Generated: ${new Date().toLocaleString('en-MY')}`],
      this.txStartDate || this.txEndDate
        ? [`Period: ${this.txStartDate || 'All'} to ${this.txEndDate || 'All'}`]
        : [`Period: All Time`],
      [],
      headers,
      ...rows,
      [],
      ['', '', 'TOTALS', totalDebit.toFixed(2), totalCredit.toFixed(2), ''],
    ];

    const csv = csvLines
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_${this.selectedSeller.username}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.isExporting = false;
    this.cdr.markForCheck();
  }
}
