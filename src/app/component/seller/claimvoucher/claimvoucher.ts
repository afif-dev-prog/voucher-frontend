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

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  // ── Generate PDF ──────────────────────────

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
  <title>Claim Report — ${this.seller.name}</title>
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
        <div class="info-card-value">${this.seller.name}</div>
        <div class="info-card-sub">@${this.seller.username}</div>
      </div>
      <div class="info-card blue">
        <div class="info-card-label">Claim Period</div>
        <div class="info-card-value">${this.formatDate(this.startDate)}</div>
        <div class="info-card-sub">to ${this.formatDate(this.endDate)}</div>
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
    <span>${this.seller.name} · ${this.seller.username} · Confidential — For Finance Use Only</span>
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

  get totalTxCount(): number {
    return this.dailySummary.reduce((sum, d) => sum + d.count, 0);
  }
  // async generatePdf(): Promise<void> {
  //   this.isGenerating = true;
  //   // this.claimRef = this.generateClaimRef();
  //   this.cdr.markForCheck();

  //   const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  //   const pageW = doc.internal.pageSize.getWidth();
  //   const pageH = doc.internal.pageSize.getHeight();
  //   const margin = 14;

  //   // ── Dark header band ──────────────────
  //   doc.setFillColor(20, 184, 126);
  //   doc.rect(0, 0, pageW, 46, 'F');

  //   // Accent stripe
  //   doc.setFillColor(13, 105, 72);
  //   doc.rect(0, 0, 4, 46, 'F');

  //   // Title
  //   doc.setTextColor(255, 255, 255);
  //   doc.setFontSize(20);
  //   doc.setFont('helvetica', 'bold');
  //   doc.text('VOUCHER CLAIM REPORT', margin + 4, 16);

  //   doc.setFontSize(8.5);
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(237, 242, 240);
  //   doc.text('Official Weekly Claim Submission', margin + 4, 23);

  //   // Generated date
  //   doc.setFontSize(7.5);
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(237, 242, 240);
  //   doc.text(
  //     `Generated: ${new Date().toLocaleString('en-MY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
  //     pageW - margin,
  //     30,
  //     { align: 'right' },
  //   );

  //   // ── Seller info + Period cards ────────
  //   const cardTop = 52;
  //   const cardH = 22;

  //   // Seller card
  //   doc.setFillColor(248, 250, 252);
  //   doc.roundedRect(margin, cardTop, 88, cardH, 2, 2, 'F');
  //   doc.setDrawColor(226, 232, 240);
  //   doc.roundedRect(margin, cardTop, 88, cardH, 2, 2, 'S');

  //   doc.setFontSize(6.5);
  //   doc.setFont('helvetica', 'bold');
  //   doc.setTextColor(100, 116, 139);
  //   doc.text('SELLER', margin + 4, cardTop + 6);

  //   doc.setFontSize(10);
  //   doc.setFont('helvetica', 'bold');
  //   doc.setTextColor(15, 23, 42);
  //   doc.text(this.seller.name, margin + 4, cardTop + 13);

  //   doc.setFontSize(7.5);
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(100, 116, 139);
  //   // doc.text(`@${this.seller.username}  ·  ${this.seller.phone}`, margin + 4, cardTop + 19);

  //   // Period card
  //   const periodX = margin + 92;
  //   doc.setFillColor(239, 246, 255);
  //   doc.roundedRect(periodX, cardTop, 88, cardH, 2, 2, 'F');
  //   doc.setDrawColor(191, 219, 254);
  //   doc.roundedRect(periodX, cardTop, 88, cardH, 2, 2, 'S');

  //   doc.setFontSize(6.5);
  //   doc.setFont('helvetica', 'bold');
  //   doc.setTextColor(37, 99, 235);
  //   doc.text('CLAIM PERIOD', periodX + 4, cardTop + 6);

  //   doc.setFontSize(9);
  //   doc.setFont('helvetica', 'bold');
  //   doc.setTextColor(15, 23, 42);
  //   doc.text(`${this.formatDate(this.startDate)}`, periodX + 4, cardTop + 13);

  //   doc.setFontSize(7.5);
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(100, 116, 139);
  //   doc.text(`to  ${this.formatDate(this.endDate)}`, periodX + 4, cardTop + 19);

  //   // ── Summary totals row ────────────────
  //   const sumTop = cardTop + cardH + 8;
  //   const sumW = (pageW - margin * 2 - 8) / 3;

  //   const summaries = [
  //     {
  //       label: 'TOTAL CREDIT',
  //       value: `RM ${this.totalCredit.toFixed(2)}`,
  //       color: [22, 163, 74] as [number, number, number],
  //       bg: [240, 253, 244] as [number, number, number],
  //       border: [187, 247, 208] as [number, number, number],
  //     },
  //     {
  //       label: 'TOTAL DEBIT',
  //       value: `RM ${this.totalDebit.toFixed(2)}`,
  //       color: [220, 38, 38] as [number, number, number],
  //       bg: [255, 241, 242] as [number, number, number],
  //       border: [254, 202, 202] as [number, number, number],
  //     },
  //     {
  //       label: 'NET CLAIMABLE',
  //       value: `RM ${this.netAmount.toFixed(2)}`,
  //       color:
  //         this.netAmount >= 0
  //           ? ([15, 23, 42] as [number, number, number])
  //           : ([220, 38, 38] as [number, number, number]),
  //       bg: [241, 245, 249] as [number, number, number],
  //       border: [226, 232, 240] as [number, number, number],
  //     },
  //   ];

  //   summaries.forEach((s, i) => {
  //     const x = margin + i * (sumW + 4);
  //     doc.setFillColor(...s.bg);
  //     doc.roundedRect(x, sumTop, sumW, 18, 2, 2, 'F');
  //     doc.setDrawColor(...s.border);
  //     doc.roundedRect(x, sumTop, sumW, 18, 2, 2, 'S');

  //     doc.setFontSize(6.5);
  //     doc.setFont('helvetica', 'bold');
  //     doc.setTextColor(100, 116, 139);
  //     doc.text(s.label, x + 5, sumTop + 6);

  //     doc.setFontSize(11);
  //     doc.setFont('helvetica', 'bold');
  //     doc.setTextColor(...s.color);
  //     doc.text(s.value, x + 5, sumTop + 14);
  //   });

  //   // Transaction count badge
  //   doc.setFontSize(7.5);
  //   doc.setFont('helvetica', 'normal');
  //   doc.setTextColor(100, 116, 139);
  //   // doc.text(
  //   //   `${this.transactions.length} transaction${this.transactions.length !== 1 ? 's' : ''} in this period`,
  //   //   pageW - margin,
  //   //   sumTop + 10,
  //   //   { align: 'left' },
  //   // );

  //   // ── Divider ───────────────────────────
  //   const tableTop = sumTop + 26;
  //   doc.setDrawColor(226, 232, 240);
  //   doc.setLineWidth(0.4);
  //   doc.line(margin, tableTop - 4, pageW - margin, tableTop - 4);

  //   doc.setFontSize(7.5);
  //   doc.setFont('helvetica', 'bold');
  //   doc.setTextColor(100, 116, 139);
  //   doc.text('TRANSACTION DETAILS', margin, tableTop - 1);

  //   // ── Transaction table ─────────────────
  //   // const rows = this.transactions.map((tx, i) => [
  //   //   (i + 1).toString(),
  //   //   new Date(tx.pay_date * 1000).toLocaleString('en-MY', {
  //   //     day: '2-digit',
  //   //     month: 'short',
  //   //     year: 'numeric',
  //   //     hour: '2-digit',
  //   //     minute: '2-digit',
  //   //   }),
  //   //   tx.student_id || '—',
  //   //   tx.debit > 0 ? `- RM ${Number(tx.debit).toFixed(2)}` : '—',
  //   //   tx.credit > 0 ? `+ RM ${Number(tx.credit).toFixed(2)}` : '—',
  //   //   tx.status || '—',
  //   // ]);

  //   const rows = this.transactions.map((tx, i) => {
  //     // const isLegacy = !tx.transaction_id || tx.transaction_id === 'No Value';
  //     const income = tx.debit || 0;
  //     return [
  //       (i + 1).toString(),
  //       new Date(tx.pay_date * 1000).toLocaleString('en-MY', {
  //         day: '2-digit',
  //         month: 'short',
  //         year: 'numeric',
  //         hour: '2-digit',
  //         minute: '2-digit',
  //       }),
  //       tx.student_id || '—',
  //       `RM ${income.toFixed(2)}`, // ← single "Amount Received" column
  //       tx.remark || '—',
  //     ];
  //   });

  //   autoTable(doc, {
  //     startY: tableTop + 2,
  //     margin: { left: margin, right: margin },
  //     // head: [['#', 'DATE & TIME', 'STUDENT ID', 'DEBIT', 'CREDIT', 'STATUS']],
  //     head: [['#', 'DATE & TIME', 'STUDENT ID', 'AMOUNT RECEIVED', 'REMARK']],
  //     body: rows,
  //     theme: 'plain',
  //     styles: {
  //       fontSize: 7.5,
  //       cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
  //       textColor: [30, 41, 59],
  //       lineColor: [226, 232, 240],
  //       lineWidth: 0.3,
  //       valign: 'middle',
  //     },
  //     headStyles: {
  //       fillColor: [158, 163, 161],
  //       textColor: [255, 255, 255],
  //       fontStyle: 'bold',
  //       fontSize: 7,
  //     },
  //     alternateRowStyles: { fillColor: [248, 250, 252] },
  //     // columnStyles: {
  //     //   0: { cellWidth: 10, halign: 'center' },
  //     //   1: { cellWidth: 40 },
  //     //   2: { cellWidth: 34 },
  //     //   3: { cellWidth: 27, halign: 'right', textColor: [220, 38, 38] },
  //     //   4: { cellWidth: 27, halign: 'right', textColor: [22, 163, 74] },
  //     //   5: { cellWidth: 22, halign: 'center' },
  //     // },

  //     columnStyles: {
  //       0: { cellWidth: 20, halign: 'center' },
  //       1: { cellWidth: 42 },
  //       2: { cellWidth: 25 },
  //       3: { cellWidth: 32, halign: 'right', textColor: [22, 163, 74] },
  //       4: { cellWidth: 36 },
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

  //   // ── Footer on all pages ───────────────
  //   const totalPages = doc.getNumberOfPages();
  //   for (let p = 1; p <= totalPages; p++) {
  //     doc.setPage(p);
  //     doc.setFillColor(20, 184, 126);
  //     doc.rect(0, pageH - 10, pageW, 10, 'F');
  //     doc.setFontSize(6.5);
  //     doc.setFont('helvetica', 'normal');
  //     doc.setTextColor(237, 242, 240);
  //     doc.text(
  //       `${this.seller.name}  ·  ${this.seller.username}  ·  Confidential — For Finance Use Only`,
  //       margin,
  //       pageH - 4,
  //     );
  //     doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
  //   }

  //   // ── Preview ───────────────────────────
  //   this.pdfBlob = doc.output('blob');
  //   if (this.rawPdfUrl) URL.revokeObjectURL(this.rawPdfUrl);
  //   this.rawPdfUrl = URL.createObjectURL(this.pdfBlob);
  //   this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPdfUrl);

  //   this.isGenerating = false;
  //   this.showPreview = true;
  //   this.cdr.markForCheck();
  // }

  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const a = document.createElement('a');
    a.href = this.rawPdfUrl;
    a.download = `claim_${this.seller.username}_${this.startDate}_${this.endDate}.pdf`;
    a.click();
  }

  // closePreview(): void {
  //   this.showPreview = false;
  //   if (this.rawPdfUrl) URL.revokeObjectURL(this.rawPdfUrl);
  //   this.rawPdfUrl = '';
  //   this.pdfPreviewUrl = '';
  //   this.pdfBlob = null;
  // }
}
