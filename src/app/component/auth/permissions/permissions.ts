import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';
import { Subject, takeUntil } from 'rxjs';
import { CountGrantedPipe } from '../../../services/count-granted.pipe';
import { PermissionsService } from '../../../services/permissions-service';

interface Permission {
  id: string;
  code: string;
  label: string;
  module: string;
}

interface PermissionItem extends Permission {
  granted: boolean;
  isOverride?: boolean; // ← add
  fromRole?: boolean; // ← add
}

interface PermissionGroup {
  module: string;
  permissions: PermissionItem[]; // ← use PermissionItem instead of Permission & { granted: boolean }
}

@Component({
  selector: 'app-permissions',
  imports: [CommonModule, FormsModule, CountGrantedPipe],
  templateUrl: './permissions.html',
  styleUrl: './permissions.css',
})
export class Permissions {
  private permService = inject(PermissionsService);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // ── Tabs ──────────────────────────────
  activeTab: 'roles' | 'users' = 'roles';

  // ── All permissions ───────────────────
  allPermissions: Permission[] = [];
  isLoadingPerms = false;

  // ── Role tab ──────────────────────────
  selectedRole = 'STUDENT';
  roleGroups: PermissionGroup[] = [];
  isLoadingRole = false;
  isSavingRole = false;
  roleSaveSuccess = false;
  roleSaveError = '';

  readonly roles = [
    { value: 'STUDENT', label: 'Student', icon: '🎓' },
    { value: 'SELLER', label: 'Seller', icon: '🏪' },
    { value: 'FINANCE', label: 'Finance', icon: '💼' },
    { value: 'SUPERADMIN', label: 'Super Admin', icon: '🔑' },
  ];

  // ── User override tab ─────────────────
  userSearchQuery = '';
  userSearchResults: any[] = [];
  selectedUser: any = null;
  selectedUserType = '';
  userGroups: PermissionGroup[] = [];
  isLoadingUser = false;
  isSavingUser = false;
  userSaveSuccess = false;
  userSaveError = '';

  // ── Seed ──────────────────────────────
  isSeeding = false;
  seedSuccess = false;
  seedError = '';

  ngOnInit(): void {
    this.loadAllPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load permissions master list ──────
  loadAllPermissions(): void {
    this.isLoadingPerms = true;
    this.permService
      .getAllPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.allPermissions = res.data || [];
          this.isLoadingPerms = false;
          if (this.allPermissions.length > 0) this.loadRolePermissions(this.selectedRole);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingPerms = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Role tab ──────────────────────────
  selectRole(role: string): void {
    this.selectedRole = role;
    this.roleSaveSuccess = false;
    this.roleSaveError = '';
    this.loadRolePermissions(role);
  }

  loadRolePermissions(role: string): void {
    this.isLoadingRole = true;
    this.permService
      .getRolePermissions(role)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const grantedIds: string[] = res.data || [];
          this.roleGroups = this.buildGroups(grantedIds);
          this.isLoadingRole = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingRole = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleRolePerm(perm: PermissionItem): void {
    perm.granted = !perm.granted;
    this.roleSaveSuccess = false;
    this.cdr.markForCheck();
  }

  selectAllInGroup(group: PermissionGroup, val: boolean): void {
    group.permissions.forEach((p) => (p.granted = val));
    this.cdr.markForCheck();
  }

  get roleGrantedIds(): string[] {
    return this.roleGroups
      .flatMap((g) => g.permissions)
      .filter((p) => p.granted)
      .map((p) => p.id);
  }

  saveRolePermissions(): void {
    this.isSavingRole = true;
    this.roleSaveSuccess = false;
    this.roleSaveError = '';

    this.permService
      .setRolePermissions(this.selectedRole, this.roleGrantedIds, this.auth.getUserId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) this.roleSaveSuccess = true;
          else this.roleSaveError = res.message || 'Failed to save.';
          this.isSavingRole = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.roleSaveError = 'Something went wrong.';
          this.isSavingRole = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── User override tab ─────────────────
  searchUser(): void {
    if (!this.userSearchQuery.trim()) return;
    // Search across student/seller/staff — use your existing student/seller search
    // For now we'll let superadmin type the user_id directly
    this.selectedUser = { user_id: this.userSearchQuery.trim() };
    this.selectedUserType = this.detectUserType(this.userSearchQuery.trim());
    this.loadUserPermissions(this.userSearchQuery.trim());
  }

  detectUserType(userId: string): string {
    // Simple heuristic — adjust to match your ID formats
    if (/^\d{10}$/.test(userId)) return 'STUDENT'; // 10-digit student ID
    if (/^[a-zA-Z]/.test(userId)) return 'SELLER'; // starts with letter
    return 'FINANCE';
  }

  loadUserPermissions(userId: string): void {
    this.isLoadingUser = true;
    this.permService
      .getUserPermissions(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const overrides: any[] = res.data || [];
          // Start from role defaults
          this.permService
            .getRolePermissions(this.selectedUserType)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (roleRes: any) => {
                const roleGranted: string[] = roleRes.data || [];
                this.userGroups = this.buildGroupsWithOverrides(roleGranted, overrides);
                this.isLoadingUser = false;
                this.cdr.markForCheck();
              },
            });
        },
        error: () => {
          this.isLoadingUser = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleUserPerm(perm: any): void {
    perm.granted = !perm.granted;
    perm.isOverride = true;
    this.userSaveSuccess = false;
    this.cdr.markForCheck();
  }

  saveUserPermissions(): void {
    if (!this.selectedUser) return;
    this.isSavingUser = true;
    this.userSaveSuccess = false;
    this.userSaveError = '';

    const overrides = this.userGroups
      .flatMap((g) => g.permissions)
      .filter((p: any) => p.isOverride)
      .map((p: any) => ({ permissionId: p.id, isGranted: p.granted }));

    this.permService
      .setUserPermissions(
        this.selectedUser.user_id,
        this.selectedUserType,
        overrides,
        this.auth.getUserId(),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) this.userSaveSuccess = true;
          else this.userSaveError = res.message || 'Failed to save.';
          this.isSavingUser = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.userSaveError = 'Something went wrong.';
          this.isSavingUser = false;
          this.cdr.markForCheck();
        },
      });
  }

  clearUser(): void {
    this.selectedUser = null;
    this.userGroups = [];
    this.userSearchQuery = '';
    this.userSaveSuccess = false;
    this.userSaveError = '';
    this.cdr.markForCheck();
  }

  // ── Seed ──────────────────────────────
  seedPermissions(): void {
    this.isSeeding = true;
    this.seedSuccess = false;
    this.seedError = '';

    this.permService
      .seedPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) {
            this.seedSuccess = true;
            this.loadAllPermissions();
          } else {
            this.seedError = res.message || 'Already seeded.';
          }
          this.isSeeding = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.seedError = 'Seed failed.';
          this.isSeeding = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Helpers ───────────────────────────
  private buildGroups(grantedIds: string[]): PermissionGroup[] {
    const modules = [...new Set(this.allPermissions.map((p) => p.module))];
    return modules.map((mod) => ({
      module: mod,
      permissions: this.allPermissions
        .filter((p) => p.module === mod)
        .map(
          (p): PermissionItem => ({
            ...p,
            granted: grantedIds.includes(p.id),
            isOverride: false,
            fromRole: false,
          }),
        ),
    }));
  }

  private buildGroupsWithOverrides(roleGranted: string[], overrides: any[]): PermissionGroup[] {
    const modules = [...new Set(this.allPermissions.map((p) => p.module))];
    return modules.map((mod) => ({
      module: mod,
      permissions: this.allPermissions
        .filter((p) => p.module === mod)
        .map((p) => {
          const override = overrides.find((o) => o.permission_id === p.id);
          return {
            ...p,
            granted: override ? override.is_granted : roleGranted.includes(p.id),
            isOverride: !!override,
            fromRole: roleGranted.includes(p.id),
          };
        }),
    }));
  }

  isAllGroupGranted(group: PermissionGroup): boolean {
    return group.permissions.every((p) => p.granted);
  }

  isSomeGroupGranted(group: PermissionGroup): boolean {
    return group.permissions.some((p) => p.granted) && !this.isAllGroupGranted(group);
  }

  getModuleIcon(module: string): string {
    const icons: Record<string, string> = {
      STUDENT: '🎓',
      SELLER: '🏪',
      VOUCHER: '🎫',
      REPORTS: '📊',
      SYSTEM: '⚙️',
    };
    return icons[module] || '📦';
  }
}
