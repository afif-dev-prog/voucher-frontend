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

  // PDF Preview
  isGenerating = false;
  showPreview = false;

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

  // Totals
  totalCredit = 0;
  totalDebit = 0;
  netAmount = 0;

  startDate: string = '';
  endDate: string = '';
  dateError = '';

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
    // console.log(this.selectedSeller);
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
          // console.log(res);
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

  // loadMoreTx(): void {
  //   if (!this.txHasNext || this.isLoadingMoreTx) return;
  //   this.isLoadingMoreTx = true;
  //   const nextPage = this.txPage + 1;

  //   this.sellerService
  //     .getSellerTransactions(
  //       this.selectedSeller.s_name,
  //       nextPage,
  //       this.txPageSize,
  //       this.dateToUnix(this.txStartDate),
  //       this.dateToUnixEndOfDay(this.txEndDate),
  //     )
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe({
  //       next: (res: any) => {
  //         this.transactions = [...this.transactions, ...res.data];
  //         this.txHasNext = res.pagination.hasNext;
  //         this.txPage = nextPage;
  //         this.isLoadingMoreTx = false;
  //         this.cdr.markForCheck();
  //       },
  //       error: () => {
  //         this.isLoadingMoreTx = false;
  //         this.cdr.markForCheck();
  //       },
  //     });
  // }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  calcTotals(): void {
    this.totalCredit = this.transactions.reduce((s, t) => s + (t.credit || 0), 0);
    this.totalDebit = this.transactions.reduce((s, t) => s + (t.debit || 0), 0);
    this.netAmount = this.totalDebit;
  }

  getIncome(tx: any): number {
    const isLegacy = !tx.transaction_id || tx.transaction_id === 'No Value';
    return isLegacy ? tx.debit || 0 : tx.credit || 0;
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

  generatePdf(): void {
    this.isGenerating = true;
    this.cdr.markForCheck();

    // Small delay to let UI update
    setTimeout(() => {
      this.showPreview = true;
      this.isGenerating = false;
      this.cdr.markForCheck();
    }, 200);
  }

  // ── Step 1: Generate and PREVIEW (called from button) ──
  // async previewPdf(): Promise<void> {
  //   this.isExporting = true;
  //   this.cdr.markForCheck();

  //   const allTx = await this.fetchAllTxForExport();
  //   const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  //   const pageW = doc.internal.pageSize.getWidth();
  //   const pageH = doc.internal.pageSize.getHeight();

  //   // ── Header band ──
  //   doc.setFillColor(15, 23, 42);
  //   doc.rect(0, 0, pageW, 38, 'F');

  //   doc.setTextColor(255, 255, 255);
  //   doc.setFontSize(18);
  //   doc.setFont('helvetica', 'bold');
  //   doc.text('TRANSACTION STATEMENT', 14, 14);

  //   doc.setFontSize(8);
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(148, 163, 184);
  //   doc.text('Official Transaction Record', 14, 20);

  //   doc.setFontSize(8);
  //   doc.setTextColor(255, 255, 255);
  //   doc.setFont('helvetica', 'bold');
  //   doc.text(this.selectedSeller.name?.toUpperCase() || '', pageW - 14, 12, { align: 'right' });
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(148, 163, 184);
  //   doc.text(`@${this.selectedSeller.username || ''}`, pageW - 14, 17, { align: 'right' });
  //   doc.text(
  //     `Generated: ${new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })}`,
  //     pageW - 14,
  //     22,
  //     { align: 'right' },
  //   );

  //   // ── Summary cards ──
  //   const periodLabel =
  //     this.txStartDate && this.txEndDate
  //       ? `${this.txStartDate} to ${this.txEndDate}`
  //       : this.txStartDate
  //         ? `From ${this.txStartDate}`
  //         : this.txEndDate
  //           ? `Until ${this.txEndDate}`
  //           : 'All Time';

  //   const totalCredit = allTx.reduce((s, t) => s + (t.credit || 0), 0);
  //   const totalDebit = allTx.reduce((s, t) => s + (t.debit || 0), 0);

  //   const cards = [
  //     { label: 'PERIOD', value: periodLabel },
  //     { label: 'TOTAL TRANSACTIONS', value: `${allTx.length}` },
  //     { label: 'TOTAL CREDIT', value: `RM ${totalCredit.toFixed(2)}` },
  //     { label: 'TOTAL DEBIT', value: `RM ${totalDebit.toFixed(2)}` },
  //   ];

  //   const cardY = 43;
  //   const cardW = (pageW - 28 - 9) / 4;
  //   cards.forEach((card, i) => {
  //     const x = 14 + i * (cardW + 3);
  //     doc.setFillColor(241, 245, 249);
  //     doc.roundedRect(x, cardY, cardW, 18, 2, 2, 'F'); // ✅ taller card: 16 → 18

  //     // Label
  //     doc.setFontSize(6);
  //     doc.setFont('helvetica', 'normal');
  //     doc.setTextColor(100, 116, 139);
  //     doc.text(card.label, x + 4, cardY + 5);

  //     // Value — truncate if too long to fit
  //     const maxWidth = cardW - 8;
  //     doc.setFontSize(8); // ✅ smaller value font: 9 → 8
  //     doc.setFont('helvetica', 'bold');
  //     doc.setTextColor(15, 23, 42);
  //     doc.text(card.value, x + 4, cardY + 13, {
  //       maxWidth: maxWidth, // ✅ wraps instead of overflowing
  //     });
  //   });

  //   doc.setDrawColor(226, 232, 240);
  //   doc.line(14, 65, pageW - 14, 65);

  //   // ── Table ──
  //   const rows = allTx.map((tx, i) => [
  //     (i + 1).toString(),
  //     new Date(tx.pay_date * 1000).toLocaleString('en-MY', {
  //       day: '2-digit',
  //       month: 'short',
  //       year: 'numeric',
  //       hour: '2-digit',
  //       minute: '2-digit',
  //     }),
  //     tx.student_id || '—',
  //     tx.debit > 0 ? `- RM ${Number(tx.debit).toFixed(2)}` : '—',
  //     tx.credit > 0 ? `+ RM ${Number(tx.credit).toFixed(2)}` : '—',
  //     tx.status || '—',
  //   ]);

  //   autoTable(doc, {
  //     startY: 68,
  //     tableWidth: 'auto',
  //     margin: { left: 14, right: 14 },
  //     head: [['#', 'DATE & TIME', 'STUDENT ID', 'DEBIT', 'CREDIT', 'STATUS']],
  //     body: rows,
  //     theme: 'plain',
  //     styles: {
  //       fontSize: 8,
  //       cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
  //       textColor: [30, 41, 59],
  //       lineColor: [226, 232, 240],
  //       lineWidth: 0.3,
  //       valign: 'middle',
  //     },
  //     headStyles: {
  //       fillColor: [15, 23, 42],
  //       textColor: [255, 255, 255],
  //       fontStyle: 'bold',
  //       fontSize: 7.5,
  //     },
  //     alternateRowStyles: { fillColor: [248, 250, 252] },
  //     columnStyles: {
  //       0: {
  //         cellWidth: 20, // ✅ wider: 8 → 10
  //         halign: 'center',
  //         valign: 'middle', // ✅ vertically center the number
  //       },
  //       1: { cellWidth: 37 },
  //       2: { cellWidth: 25 },
  //       3: { cellWidth: 26, halign: 'right', textColor: [220, 38, 38] },
  //       4: { cellWidth: 26, halign: 'right', textColor: [22, 163, 74] },
  //       5: { cellWidth: 22, halign: 'center' },
  //     },
  //     didParseCell: (data) => {
  //       if (data.section === 'body' && data.column.index === 5) {
  //         const val = data.cell.raw as string;
  //         if (val === 'SUCCESS' || val === 'COMPLETED') data.cell.styles.textColor = [22, 163, 74];
  //         else if (val === 'PENDING') data.cell.styles.textColor = [161, 98, 7];
  //         else if (val === 'FAILED') data.cell.styles.textColor = [220, 38, 38];
  //       }
  //     },
  //   });

  //   // ── Footer ──
  //   const totalPages = doc.getNumberOfPages();
  //   for (let p = 1; p <= totalPages; p++) {
  //     doc.setPage(p);
  //     const y = doc.internal.pageSize.getHeight();
  //     doc.setDrawColor(226, 232, 240);
  //     doc.line(14, y - 14, pageW - 14, y - 14);
  //     doc.setFontSize(7);
  //     doc.setTextColor(148, 163, 184);
  //     doc.setFont('helvetica', 'normal');
  //     doc.text('This is a system-generated statement. No signature required.', 14, y - 9);
  //     doc.text(`Page ${p} of ${totalPages}`, pageW - 14, y - 9, { align: 'right' });
  //   }

  //   // ── Convert to blob URL for preview (do NOT save yet) ──
  //   this.pdfBlob = doc.output('blob');
  //   // if (this.pdfPreviewUrl) URL.revokeObjectURL(this.pdfPreviewUrl); // cleanup old
  //   // this.pdfPreviewUrl = URL.createObjectURL(this.pdfBlob);
  //   this.rawPdfUrl = URL.createObjectURL(this.pdfBlob!);
  //   this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPdfUrl);

  //   this.isExporting = false;
  //   this.showPdfPreview = true;
  //   this.cdr.markForCheck();
  // }

  // // ── Step 2: User clicks Download in preview modal ──
  // downloadPdf(): void {
  //   if (!this.pdfBlob) return;
  //   const a = document.createElement('a');
  //   a.href = this.rawPdfUrl;
  //   a.download = `statement_${this.selectedSeller.username}_${Date.now()}.pdf`;
  //   a.click();
  // }

  // closePdfPreview(): void {
  //   this.showPdfPreview = false;
  //   if (this.rawPdfUrl) {
  //     URL.revokeObjectURL(this.rawPdfUrl);
  //     this.rawPdfUrl = '';
  //   }
  //   this.pdfPreviewUrl = '';
  //   this.pdfBlob = null;
  // }
  get dailySummary(): { date: string; unix: number; count: number; total: number }[] {
    const map = new Map<string, { unix: number; count: number; total: number }>();

    for (const tx of this.transactions) {
      const d = new Date(tx.pay_date * 1000);
      // Build key manually — don't use toDateString() which expects 'YYYY-MM-DD'
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;

      if (!map.has(key)) {
        map.set(key, {
          unix: new Date(year, d.getMonth(), d.getDate()).getTime() / 1000,
          count: 0,
          total: 0,
        });
      }
      const entry = map.get(key)!;
      entry.count++;
      entry.total += tx.debit || 0;
    }

    return Array.from(map.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.unix - b.unix);
  }
  printReport(): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const daily = this.dailySummary;
    const totalAmount = daily.reduce((s, d) => s + d.total, 0);
    const totalTx = daily.reduce((s, d) => s + d.count, 0);
    const generated = new Date().toLocaleString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rows = daily
      .map((d, i) => {
        const dateLabel = new Date(d.unix * 1000).toLocaleDateString('en-MY', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
        return `
      <tr>
        <td class="col-num">${i + 1}</td>
        <td>${dateLabel}</td>
        <td class="col-center">${d.count}</td>
        <td class="col-right col-amount">RM ${d.total.toFixed(2)}</td>
      </tr>
    `;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Claim Report — ${this.selectedSeller.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

   body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1e293b;
      background: #fff;
      position: relative;
      min-height: 297mm;
      margin: 30px;
    }

    /* ── Header band ── */
    .report-header {
      background: transparent;
      color: #fff;
      padding: 20px 28px 18px;
      position: relative;
    }
    .report-header::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 6px;
      background: #0d6948;
    }
    .report-header-inner {
      // margin-left: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .report-title {
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .report-subtitle {
      font-size: 8.5pt;
      opacity: 0.85;
      margin-top: 3px;
    }
    .content {
      flex: 1; /* pushes footer down */
    }
    .report-generated {
      font-size: 7.5pt;
      opacity: 0.75;
      margin-top: 2px;
    }

    /* ── Info cards ── */
    .info-row {
      display: flex;
      gap: 12px;
      padding: 14px 28px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-card {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      background: #fff;
    }
    .info-card.blue {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .info-card-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .info-card.blue .info-card-label { color: #2563eb; }
    .info-card-value {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .info-card-sub {
      font-size: 7.5pt;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* ── Summary totals ── */
    .summary-row {
      display: flex;
      gap: 10px;
      padding: 12px 28px;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-box {
      flex: 1;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .summary-box.green {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .summary-box.slate {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
    }
    .summary-box-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .summary-box.green .summary-box-label { color: #16a34a; }
    .summary-box-value {
      font-size: 13pt;
      font-weight: 700;
      color: #0f172a;
    }
    .summary-box.green .summary-box-value { color: #16a34a; }

    /* ── Section label ── */
    .section-label {
      padding: 10px 28px 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      border-bottom: 1px solid #e2e8f0;
    }

    /* ── Table ── */
    .tx-table {
      width: 100%;
      border-collapse: collapse;
    }
    .tx-table thead tr {
      background: #9ea3a1;
    }
    .tx-table thead th {
      padding: 8px 14px;
      text-align: left;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #fff;
    }
    .tx-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .tx-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .tx-table td {
      padding: 9px 14px;
      font-size: 9.5pt;
      color: #334155;
    }
    .tx-table tfoot tr {
      background: #f1f5f9;
      border-top: 2px solid #cbd5e1;
    }
    .tx-table tfoot td {
      padding: 10px 14px;
      font-weight: 700;
      font-size: 10pt;
      color: #0f172a;
    }

    .col-num { color: #94a3b8; font-size: 8.5pt; width: 36px; }
    .col-center { text-align: center; }
    .col-right { text-align: right; }
    .col-amount { color: #16a34a; font-weight: 700; }
    .col-total-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }

    /* ── Footer ── */
    .report-footer {
      position: relative;
      bottom: 0;
      left: 0;
      right: 0;
      color: rgba(0, 0, 0, 0.85);
      font-size: 7pt;
      padding: 7px 28px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
    }

    /* ── Signature block ── */
    .signature-block {
      display: flex;
      justify-content: flex-end;
      padding: 24px 28px 12px;
      gap: 40px;
    }
    .sig-item {
      text-align: center;
      min-width: 140px;
    }
    .sig-line {
      border-top: 1px solid #334155;
      margin-bottom: 6px;
    }
    .sig-label {
      font-size: 7.5pt;
      color: #64748b;
    }
    .sig-name {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .report-container{
      height: 280mm;
      padding: 20px;
    }

    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
        position: relative;
      }
      @page { 
        margin: 0; 
        size: A4 portrait; 
      }
    }
  </style>
</head>
<body>
<div class="report-container">
  <!-- Header -->
  <div class="report-header">
    <div class="report-header-inner">
        <img src="PPKS_header.png" style="width: 70%" />
      
      <img
    </div>
  </div>
  <div class="content">
    <!-- Seller + Period info -->
    <div class="info-row">
      <div class="info-card">
        <div class="info-card-label">Seller</div>
        <div class="info-card-value">${this.selectedSeller.s_name}</div>
        <div class="info-card-sub">@${this.selectedSeller.username}</div>
      </div>
      <div class="info-card blue">
        <div class="info-card-label">Claim Period</div>
        <div class="info-card-value">${this.formatDate(this.txStartDate)}</div>
        <div class="info-card-sub">to ${this.formatDate(this.txEndDate)}</div>
      </div>
    </div>

    <!-- Summary totals -->
    <div class="summary-row">
      <div class="summary-box slate">
        <div class="summary-box-label">Total Transactions</div>
        <div class="summary-box-value">${totalTx}</div>
      </div>
      <div class="summary-box slate">
        <div class="summary-box-label">Days with Activity</div>
        <div class="summary-box-value">${daily.length}</div>
      </div>
      <div class="summary-box green">
        <div class="summary-box-label">Net Claimable Amount</div>
        <div class="summary-box-value">RM ${totalAmount.toFixed(2)}</div>
      </div>
    </div>

    <!-- Table -->
    <div class="section-label">Daily Transaction Summary</div>
    <table class="tx-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th style="text-align:center">Transactions</th>
          <th style="text-align:right">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td></td>
          <td class="col-total-label">TOTAL</td>
          <td class="col-center">${totalTx}</td>
          <td class="col-right col-amount">RM ${totalAmount.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

  </div>

  <!-- Footer -->
  <div class="report-footer">
    <span>${this.selectedSeller.s_name} · ${this.selectedSeller.username} · Confidential — For Finance Use Only</span>
    <span>Page 1 of 1</span>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  closePreview(): void {
    this.showPreview = false;
  }
  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const a = document.createElement('a');
    a.href = this.rawPdfUrl;
    a.download = `claim_${this.selectedSeller.username}_${this.txStartDate}_${this.txEndDate}.pdf`;
    a.click();
  }

  get totalTxCount(): number {
    return this.dailySummary.reduce((sum, d) => sum + d.count, 0);
  }
  // ── Export CSV ──
}
