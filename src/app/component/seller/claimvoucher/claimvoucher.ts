import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Seller } from '../../../services/seller';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-claimvoucher',
  imports: [CommonModule, FormsModule],
  templateUrl: './claimvoucher.html',
  styleUrl: './claimvoucher.css',
})
export class Claimvoucher implements OnInit, OnDestroy {
  private sellerService = inject(Seller); // your seller service
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth);
  private destroy$ = new Subject<void>();

  // Seller info — replace with actual auth
  seller = {
    id: '13',
    name: 'Koperasi Sarawak Skills 2',
    username: 'ahmad_cafe',
    email: 'ahmad@cafe.com',
    phone: '0123456789',
  };

  // Date range — keep as string for datepicker binding
  startDate: string = '';
  endDate: string = '';
  dateError = '';

  // Transactions
  transactions: any[] = [];
  isLoading = false;
  hasFetched = false;
  fetchError = '';

  // Totals
  totalCredit = 0;
  totalDebit = 0;
  netAmount = 0;

  // PDF Preview
  isGenerating = false;
  showPreview = false;
  pdfPreviewUrl: SafeResourceUrl = '';
  private rawPdfUrl = '';
  private pdfBlob: Blob | null = null;

  // Claim ref
  // claimRef = '';
  loggedSeller = '';

  ngOnInit(): void {
    const today = new Date();
    const day = today.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(today);
    mon.setDate(today.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    this.startDate = this.toDateString(mon); // already returns 'YYYY-MM-DD'
    this.endDate = this.toDateString(sun);
    this.seller.username = this.auth.getUserId();
    this.seller.name = this.auth.getName();
    // this.seller.email =
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.rawPdfUrl) URL.revokeObjectURL(this.rawPdfUrl);
  }

  toDateString(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  setWeek(offset: number): void {
    const today = new Date();
    const day = today.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(today);
    mon.setDate(today.getDate() + diffToMon + offset * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    this.startDate = this.toDateString(mon);
    this.endDate = this.toDateString(sun);
    this.hasFetched = false;
    this.transactions = [];
    this.cdr.markForCheck();
  }
  legacyOpeningBalance: number | null = null;
  cutoverDate: number | null = null;
  // ── Fetch transactions ────────────────────
  // fetchTransactions(): void {
  //   console.log(this.startDate, this.endDate);
  //   this.dateError = '';
  //   if (!this.startDate) {
  //     this.dateError = 'Please select a start date.';
  //     return;
  //   }
  //   if (!this.endDate) {
  //     this.dateError = 'Please select an end date.';
  //     return;
  //   }
  //   if (this.startDate > this.endDate) {
  //     this.dateError = 'Start date cannot be after end date.';
  //     return;
  //   }

  //   const start = this.dateToUnix(this.startDate);
  //   const end = this.dateToUnix(this.endDate);
  //   const endOfDay = end ? end + 86399 : undefined; // +23h 59m 59s

  //   this.isLoading = true;
  //   this.hasFetched = false;
  //   this.fetchError = '';
  //   this.transactions = [];
  //   this.cdr.markForCheck();

  //   console.log(start, endOfDay);

  //   // Fetch ALL (pageSize 9999) for the selected range
  //   // this.sellerService
  //   //   .getSellerTransactions('SOCC Sribima Offshore Catering Co', 1, 20, start, endOfDay)
  //   //   .pipe(takeUntil(this.destroy$))
  //   //   .subscribe({
  //   //     next: (res: any) => {
  //   //       this.transactions = res.data || [];
  //   //       this.calcTotals();
  //   //       this.isLoading = false;
  //   //       this.hasFetched = true;
  //   //       this.cdr.markForCheck();
  //   //     },
  //   //     error: () => {
  //   //       this.fetchError = 'Failed to load transactions. Please try again.';
  //   //       this.isLoading = false;
  //   //       this.cdr.markForCheck();
  //   //     },
  //   //   });
  //   this.sellerService
  //     .getSellerTransactions('SOCC Sribima Offshore Catering Co', 1, 20, start, endOfDay)
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe((res) => {
  //       console.log(res.data);
  //     });
  // }
  fetchTransactions(): void {
    this.isLoading = true;
    this.hasFetched = false;
    this.fetchError = '';
    this.transactions = [];
    this.cdr.markForCheck();
    // console.log(this.loggedSeller);
    // const start = this.dateToUnix(this.startDate);
    // const end = this.dateToUnix(this.endDate);
    const cleanSellerName = this.seller.name || '';
    this.sellerService
      .getSellerTransactions(
        cleanSellerName,
        1,
        9999,
        this.dateToUnix(this.startDate),
        this.dateToUnixEndOfDay(this.endDate),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.transactions = res.data || [];
          // console.log(this.transactions);
          // this.txTotalCount = res.pagination?.totalCount || 0;
          // this.txHasNext = res.pagination?.hasNext ?? false;
          // this.txPage = 1;
          this.calcTotals();
          this.isLoading = false;
          this.hasFetched = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
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
  calcTotals(): void {
    this.totalCredit = this.transactions.reduce((s, t) => s + (t.credit || 0), 0);
    this.totalDebit = this.transactions.reduce((s, t) => s + (t.debit || 0), 0);
    this.netAmount = this.totalDebit;
  }

  getIncome(tx: any): number {
    const isLegacy = !tx.transaction_id || tx.transaction_id === 'No Value';
    return isLegacy ? tx.debit || 0 : tx.credit || 0;
  }

  // calcTotals(): void {
  //   this.totalCredit = this.transactions.reduce((s, t) => s + this.getIncome(t), 0);
  //   this.totalDebit = 0;
  //   this.netAmount = this.totalCredit;
  // }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  // ── Generate PDF ──────────────────────────
  async generatePdf(): Promise<void> {
    this.isGenerating = true;
    // this.claimRef = this.generateClaimRef();
    this.cdr.markForCheck();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ── Dark header band ──────────────────
    doc.setFillColor(20, 184, 126);
    doc.rect(0, 0, pageW, 46, 'F');

    // Accent stripe
    doc.setFillColor(13, 105, 72);
    doc.rect(0, 0, 4, 46, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('VOUCHER CLAIM REPORT', margin + 4, 16);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(237, 242, 240);
    doc.text('Official Weekly Claim Submission', margin + 4, 23);

    // Generated date
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(237, 242, 240);
    doc.text(
      `Generated: ${new Date().toLocaleString('en-MY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      pageW - margin,
      30,
      { align: 'right' },
    );

    // ── Seller info + Period cards ────────
    const cardTop = 52;
    const cardH = 22;

    // Seller card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, cardTop, 88, cardH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cardTop, 88, cardH, 2, 2, 'S');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('SELLER', margin + 4, cardTop + 6);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.seller.name, margin + 4, cardTop + 13);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    // doc.text(`@${this.seller.username}  ·  ${this.seller.phone}`, margin + 4, cardTop + 19);

    // Period card
    const periodX = margin + 92;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(periodX, cardTop, 88, cardH, 2, 2, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(periodX, cardTop, 88, cardH, 2, 2, 'S');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('CLAIM PERIOD', periodX + 4, cardTop + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${this.formatDate(this.startDate)}`, periodX + 4, cardTop + 13);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`to  ${this.formatDate(this.endDate)}`, periodX + 4, cardTop + 19);

    // ── Summary totals row ────────────────
    const sumTop = cardTop + cardH + 8;
    const sumW = (pageW - margin * 2 - 8) / 3;

    const summaries = [
      {
        label: 'TOTAL CREDIT',
        value: `RM ${this.totalCredit.toFixed(2)}`,
        color: [22, 163, 74] as [number, number, number],
        bg: [240, 253, 244] as [number, number, number],
        border: [187, 247, 208] as [number, number, number],
      },
      {
        label: 'TOTAL DEBIT',
        value: `RM ${this.totalDebit.toFixed(2)}`,
        color: [220, 38, 38] as [number, number, number],
        bg: [255, 241, 242] as [number, number, number],
        border: [254, 202, 202] as [number, number, number],
      },
      {
        label: 'NET CLAIMABLE',
        value: `RM ${this.netAmount.toFixed(2)}`,
        color:
          this.netAmount >= 0
            ? ([15, 23, 42] as [number, number, number])
            : ([220, 38, 38] as [number, number, number]),
        bg: [241, 245, 249] as [number, number, number],
        border: [226, 232, 240] as [number, number, number],
      },
    ];

    summaries.forEach((s, i) => {
      const x = margin + i * (sumW + 4);
      doc.setFillColor(...s.bg);
      doc.roundedRect(x, sumTop, sumW, 18, 2, 2, 'F');
      doc.setDrawColor(...s.border);
      doc.roundedRect(x, sumTop, sumW, 18, 2, 2, 'S');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(s.label, x + 5, sumTop + 6);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...s.color);
      doc.text(s.value, x + 5, sumTop + 14);
    });

    // Transaction count badge
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    // doc.text(
    //   `${this.transactions.length} transaction${this.transactions.length !== 1 ? 's' : ''} in this period`,
    //   pageW - margin,
    //   sumTop + 10,
    //   { align: 'left' },
    // );

    // ── Divider ───────────────────────────
    const tableTop = sumTop + 26;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, tableTop - 4, pageW - margin, tableTop - 4);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('TRANSACTION DETAILS', margin, tableTop - 1);

    // ── Transaction table ─────────────────
    // const rows = this.transactions.map((tx, i) => [
    //   (i + 1).toString(),
    //   new Date(tx.pay_date * 1000).toLocaleString('en-MY', {
    //     day: '2-digit',
    //     month: 'short',
    //     year: 'numeric',
    //     hour: '2-digit',
    //     minute: '2-digit',
    //   }),
    //   tx.student_id || '—',
    //   tx.debit > 0 ? `- RM ${Number(tx.debit).toFixed(2)}` : '—',
    //   tx.credit > 0 ? `+ RM ${Number(tx.credit).toFixed(2)}` : '—',
    //   tx.status || '—',
    // ]);

    const rows = this.transactions.map((tx, i) => {
      const isLegacy = !tx.transaction_id || tx.transaction_id === 'No Value';
      const income = isLegacy ? tx.debit || 0 : tx.credit || 0;
      return [
        (i + 1).toString(),
        new Date(tx.pay_date * 1000).toLocaleString('en-MY', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        tx.student_id || '—',
        `RM ${income.toFixed(2)}`, // ← single "Amount Received" column
        tx.remark || '—',
      ];
    });

    autoTable(doc, {
      startY: tableTop + 2,
      margin: { left: margin, right: margin },
      // head: [['#', 'DATE & TIME', 'STUDENT ID', 'DEBIT', 'CREDIT', 'STATUS']],
      head: [['#', 'DATE & TIME', 'STUDENT ID', 'AMOUNT RECEIVED', 'REMARK']],
      body: rows,
      theme: 'plain',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [158, 163, 161],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // columnStyles: {
      //   0: { cellWidth: 10, halign: 'center' },
      //   1: { cellWidth: 40 },
      //   2: { cellWidth: 34 },
      //   3: { cellWidth: 27, halign: 'right', textColor: [220, 38, 38] },
      //   4: { cellWidth: 27, halign: 'right', textColor: [22, 163, 74] },
      //   5: { cellWidth: 22, halign: 'center' },
      // },

      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 25 },
        3: { cellWidth: 32, halign: 'right', textColor: [22, 163, 74] },
        4: { cellWidth: 36 },
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

    // ── Footer on all pages ───────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(20, 184, 126);
      doc.rect(0, pageH - 10, pageW, 10, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(237, 242, 240);
      doc.text(
        `${this.seller.name}  ·  ${this.seller.username}  ·  Confidential — For Finance Use Only`,
        margin,
        pageH - 4,
      );
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    // ── Preview ───────────────────────────
    this.pdfBlob = doc.output('blob');
    if (this.rawPdfUrl) URL.revokeObjectURL(this.rawPdfUrl);
    this.rawPdfUrl = URL.createObjectURL(this.pdfBlob);
    this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPdfUrl);

    this.isGenerating = false;
    this.showPreview = true;
    this.cdr.markForCheck();
  }

  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const a = document.createElement('a');
    a.href = this.rawPdfUrl;
    a.download = `claim_${this.seller.username}_${this.startDate}_${this.endDate}.pdf`;
    a.click();
  }

  closePreview(): void {
    this.showPreview = false;
    if (this.rawPdfUrl) URL.revokeObjectURL(this.rawPdfUrl);
    this.rawPdfUrl = '';
    this.pdfPreviewUrl = '';
    this.pdfBlob = null;
  }
}
