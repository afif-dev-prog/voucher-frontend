import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { Auth } from '../../../services/auth';
import { AuthLogService } from '../../../services/auth-log-service';

@Component({
  selector: 'app-authlog',
  imports: [CommonModule, FormsModule],
  templateUrl: './authlog.html',
  styleUrl: './authlog.css',
})
export class Authlog {
  private logService = inject(AuthLogService);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // ── Tabs ──────────────────────────────
  activeTab: 'sessions' | 'logs' = 'sessions';

  // ── Active sessions ───────────────────
  sessions: any[] = [];
  isLoadingSessions = false;
  sessionSearch = '';
  sessionUserType = '';
  killError = '';
  killSuccess = '';

  // ── Kill confirm modal ────────────────
  showKillModal = false;
  killTarget: any = null; // single session
  killAllTarget = ''; // user_id for kill all
  isKilling = false;
  killMode: 'single' | 'all' = 'single';

  // ── Logs ──────────────────────────────
  logs: any[] = [];
  isLoadingLogs = false;
  logSearch = '';
  logAction = '';
  logUserType = '';

  // Pagination
  currentPage = 1;
  readonly pageSize = 20;
  totalCount = 0;
  totalPages = 0;
  hasPrevious = false;
  hasNext = false;

  readonly actionOptions = [
    { value: '', label: 'All Actions' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'LOGOUT', label: 'Logout' },
    { value: 'LOGIN_FAILED', label: 'Failed Login' },
    { value: 'SESSION_KILLED', label: 'Session Killed' },
    { value: 'ALL_SESSIONS_KILLED', label: 'All Killed' },
  ];

  readonly userTypeOptions = [
    { value: '', label: 'All Roles' },
    { value: 'STUDENT', label: 'Student' },
    { value: 'SELLER', label: 'Seller' },
    { value: 'FINANCE', label: 'Finance' },
    { value: 'SUPERADMIN', label: 'Super Admin' },
  ];

  ngOnInit(): void {
    this.loadSessions();
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
        this.loadLogs();
      });
  }

  onLogSearchInput(): void {
    this.searchSubject.next(this.logSearch);
  }

  // ── Sessions ──────────────────────────
  loadSessions(): void {
    this.isLoadingSessions = true;
    this.logService
      .getActiveSessions(this.sessionSearch, this.sessionUserType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.sessions = res.data || [];
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Kill session ──────────────────────
  openKillModal(session: any): void {
    this.killTarget = session;
    this.killMode = 'single';
    this.killError = '';
    this.killSuccess = '';
    this.showKillModal = true;
  }

  openKillAllModal(userId: string): void {
    this.killAllTarget = userId;
    this.killMode = 'all';
    this.killError = '';
    this.killSuccess = '';
    this.showKillModal = true;
  }

  closeKillModal(): void {
    this.showKillModal = false;
    this.killTarget = null;
    this.killAllTarget = '';
    this.isKilling = false;
  }

  confirmKill(): void {
    this.isKilling = true;
    this.killError = '';
    const killedBy = this.auth.getUserId();

    const obs =
      this.killMode === 'single'
        ? this.logService.killSession(this.killTarget.session_id, killedBy)
        : this.logService.killAllSessions(this.killAllTarget, killedBy);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        if (res.success !== false) {
          this.killSuccess = res.message || 'Session terminated.';
          // Remove from UI
          if (this.killMode === 'single') {
            this.sessions = this.sessions.filter(
              (s) => s.session_id !== this.killTarget.session_id,
            );
          } else {
            this.sessions = this.sessions.filter((s) => s.user_id !== this.killAllTarget);
          }
          setTimeout(() => this.closeKillModal(), 1500);
        } else {
          this.killError = res.message || 'Failed to kill session.';
        }
        this.isKilling = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.killError = 'Something went wrong.';
        this.isKilling = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Logs ──────────────────────────────
  loadLogs(): void {
    this.isLoadingLogs = true;
    this.logService
      .getLogs(this.currentPage, this.pageSize, this.logSearch, this.logAction, this.logUserType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.logs = res.data || [];
          this.totalCount = res.pagination?.totalCount || 0;
          this.totalPages = res.pagination?.totalPages || 0;
          this.hasPrevious = res.pagination?.hasPrevious || false;
          this.hasNext = res.pagination?.hasNext || false;
          this.isLoadingLogs = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingLogs = false;
          this.cdr.markForCheck();
        },
      });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadLogs();
  }

  get pageNumbers(): number[] {
    const max = 5;
    const half = Math.floor(max / 2);
    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, start + max - 1);
    if (end - start + 1 < max) start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  // ── Helpers ───────────────────────────
  getActionClass(action: string): string {
    switch (action) {
      case 'LOGIN':
        return 'badge-success';
      case 'LOGOUT':
        return 'badge-neutral';
      case 'LOGIN_FAILED':
        return 'badge-danger';
      case 'SESSION_KILLED':
      case 'ALL_SESSIONS_KILLED':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'STUDENT':
        return 'role-student';
      case 'SELLER':
        return 'role-seller';
      case 'FINANCE':
        return 'role-finance';
      case 'SUPERADMIN':
        return 'role-superadmin';
      default:
        return 'role-unknown';
    }
  }

  formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  getSessionAge(ts: number): string {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }
}
