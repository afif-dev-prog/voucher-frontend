import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NotificationService } from '../../../services/notification-service';
import { Auth } from '../../../services/auth';
import { interval, Subject, takeUntil } from 'rxjs';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: number;
}
@Component({
  selector: 'app-notification-bell',
  imports: [CommonModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBell implements OnInit, OnDestroy {
  private notifService = inject(NotificationService);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  notifications: NotificationItem[] = [];
  unreadCount = 0;
  showPanel = false;
  isLoading = false;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    this.loadNotifications();

    // Poll every 30 seconds for new notifications
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.notifService.getMyNotifications().subscribe({
      next: (res: any) => {
        this.notifications = res?.data || [];
        this.unreadCount = res?.unreadCount || 0;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  togglePanel(): void {
    this.showPanel = !this.showPanel;
    if (this.showPanel) this.loadNotifications();
  }

  markRead(n: NotificationItem): void {
    if (n.is_read) return;
    n.is_read = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.notifService.markRead(n.id).subscribe();
    this.cdr.markForCheck();
  }

  markAllRead(): void {
    this.notifications.forEach((n) => (n.is_read = true));
    this.unreadCount = 0;
    this.notifService.markAllRead().subscribe();
    this.cdr.markForCheck();
  }

  getIcon(type: string): string {
    if (type === 'PAYMENT_RECEIVED') return '💰';
    if (type === 'PAYMENT_DEDUCTED') return '🧾';
    if (type === 'ANNOUNCEMENT') return '📢';
    return '🔔';
  }

  getIconType(type: string): string {
    if (type === 'PAYMENT_RECEIVED') return 'payment';
    if (type === 'PAYMENT_DEDUCTED') return 'deducted';
    if (type === 'ANNOUNCEMENT') return 'announcement';
    return 'default';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
