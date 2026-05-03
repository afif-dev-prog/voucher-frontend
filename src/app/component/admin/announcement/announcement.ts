import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../services/notification-service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-announcement',
  imports: [CommonModule, FormsModule],
  templateUrl: './announcement.html',
  styleUrl: './announcement.css',
})
export class Announcement {
  private notifService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // Form
  title = '';
  message = '';
  target = 'ALL';
  sendEmail = false;
  sendPush = true;

  // State
  isSending = false;
  successMsg = '';
  errorMsg = '';

  // History
  announcements: any[] = [];
  isLoadingHistory = false;
  currentPage = 1;
  totalPages = 0;
  totalCount = 0;
  hasNext = false;
  hasPrevious = false;

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  send(): void {
    this.errorMsg = '';
    this.successMsg = '';

    if (!this.title.trim()) {
      this.errorMsg = 'Title is required.';
      return;
    }
    if (!this.message.trim()) {
      this.errorMsg = 'Message is required.';
      return;
    }
    if (!this.sendEmail && !this.sendPush) {
      this.errorMsg = 'Select at least one delivery method.';
      return;
    }

    this.isSending = true;

    this.notifService
      .sendAnnouncement({
        title: this.title,
        message: this.message,
        target: this.target,
        sendEmail: this.sendEmail,
        sendPush: this.sendPush,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.successMsg = `Announcement sent to ${this.target} successfully!`;
            this.title = '';
            this.message = '';
            this.loadHistory();
          } else {
            this.errorMsg = res?.message || 'Failed to send.';
          }
          this.isSending = false;
          this.cdr.markForCheck();
        },
      });
  }

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.notifService
      .getAnnouncements(this.currentPage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.announcements = res?.data || [];
          this.totalPages = res?.pagination?.totalPages || 0;
          this.totalCount = res?.pagination?.totalCount || 0;
          this.hasNext = res?.pagination?.hasNext || false;
          this.hasPrevious = res?.pagination?.hasPrevious || false;
          this.isLoadingHistory = false;
          this.cdr.markForCheck();
        },
      });
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadHistory();
  }

  getTargetLabel(target: string): string {
    if (target === 'ALL') return 'Everyone';
    if (target === 'STUDENT') return 'Students only';
    return 'Sellers only';
  }
}
