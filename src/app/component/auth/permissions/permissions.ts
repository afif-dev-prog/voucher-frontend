import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { CountGrantedPipe } from '../../../services/count-granted.pipe';
import { PermissionsService } from '../../../services/permissions-service';

interface Permission {
  id: string;
  code: string;
  label: string;
  module: string;
  description?: string;
}

interface PermissionItem extends Permission {
  granted: boolean;
  isOverride?: boolean;
  fromRole?: boolean;
}

interface PermissionGroup {
  module: string;
  permissions: PermissionItem[];
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
  activeTab: 'roles' | 'users' | 'manage' = 'roles';

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
  selectedUser: any = null;
  selectedUserType = '';
  userGroups: PermissionGroup[] = [];
  isLoadingUser = false;
  isSavingUser = false;
  userSaveSuccess = false;
  userSaveError = '';

  // ── Manage tab ────────────────────────
  allRoles: string[] = [];
  newPerm = { code: '', label: '', module: '', description: '' };
  isSavingPerm = false;
  editingPerm: Permission | null = null;
  permSaveError = '';

  isAddingRole = false;
  newRoleName = '';

  // ── Seed ──────────────────────────────
  isSeeding = false;
  seedSuccess = false;
  seedError = '';

  // ── Modal: Add Permission ─────────────
  showAddPermModal = false;

  openAddPermModal(): void {
    this.editingPerm = null;
    this.newPerm = { code: '', label: '', module: '', description: '' };
    this.permSaveError = '';
    this.showAddPermModal = true;
    this.cdr.markForCheck();
  }

  closeAddPermModal(): void {
    this.showAddPermModal = false;
    this.editingPerm = null;
    this.newPerm = { code: '', label: '', module: '', description: '' };
    this.permSaveError = '';
    this.cdr.markForCheck();
  }

  // ── Modal: Edit Permission ────────────
  showEditModal = false;

  startEditPerm(perm: Permission): void {
    this.editingPerm = perm;
    this.newPerm = {
      code: perm.code,
      label: perm.label,
      module: perm.module,
      description: perm.description || '',
    };
    this.permSaveError = '';
    this.showEditModal = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingPerm = null;
    this.newPerm = { code: '', label: '', module: '', description: '' };
    this.permSaveError = '';
    this.cdr.markForCheck();
  }

  savePerm(): void {
    if (!this.newPerm.code || !this.newPerm.label || !this.newPerm.module) return;
    this.isSavingPerm = true;
    this.permSaveError = '';

    const obs = this.editingPerm
      ? this.permService.editPermission(this.editingPerm.id, this.newPerm)
      : this.permService.addPermission(this.newPerm);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        if (res.success !== false) {
          this.closeEditModal();
          this.closeAddPermModal();
          this.loadAllPermissions();
        } else {
          this.permSaveError = res.message || 'Failed.';
        }
        this.isSavingPerm = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.permSaveError = 'Error saving.';
        this.isSavingPerm = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Modal: Delete Permission ──────────
  showDeleteModal = false;
  deletingPerm: Permission | null = null;
  isConfirmingDelete = false;
  deleteError = '';

  confirmDeletePerm(perm: Permission): void {
    this.deletingPerm = perm;
    this.deleteError = '';
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingPerm = null;
    this.deleteError = '';
    this.isConfirmingDelete = false;
    this.cdr.markForCheck();
  }

  deletePerm(): void {
    if (!this.deletingPerm) return;
    this.isConfirmingDelete = true;
    this.permService
      .deletePermission(this.deletingPerm.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) {
            this.closeDeleteModal();
            this.loadAllPermissions();
          } else {
            this.deleteError = res.message || 'Failed to delete.';
          }
          this.isConfirmingDelete = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.deleteError = 'Something went wrong.';
          this.isConfirmingDelete = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Modal: Delete Role ────────────────
  showDeleteRoleModal = false;
  deletingRole: string | null = null;
  isDeletingRole = false;
  deleteRoleError = '';

  confirmDeleteRole(role: string): void {
    this.deletingRole = role;
    this.deleteRoleError = '';
    this.showDeleteRoleModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteRoleModal(): void {
    this.showDeleteRoleModal = false;
    this.deletingRole = null;
    this.deleteRoleError = '';
    this.isDeletingRole = false;
    this.cdr.markForCheck();
  }

  deleteRole(): void {
    if (!this.deletingRole) return;
    this.isDeletingRole = true;
    this.permService
      .deleteRole(this.deletingRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.success !== false) {
            this.closeDeleteRoleModal();
            this.loadAllPermissions();
          } else {
            this.deleteRoleError = res.message || 'Failed to delete role.';
          }
          this.isDeletingRole = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.deleteRoleError = 'Something went wrong.';
          this.isDeletingRole = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Getter: merged role objects for templates ──
  get allRoleObjects(): { value: string; label: string; icon: string }[] {
    const hardcodedValues = this.roles.map((r) => r.value);
    const extraRoles = this.allRoles.filter((r) => !hardcodedValues.includes(r));
    return [...this.roles, ...extraRoles.map((r) => ({ value: r, label: r, icon: '🏷️' }))];
  }

  // ── Load all permissions + roles ──────
  ngOnInit(): void {
    this.loadAllPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllPermissions(): void {
    this.isLoadingPerms = true;
    forkJoin({
      perms: this.permService.getAllPermissions(),
      roles: this.permService.getAllRoles(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ perms, roles }: any) => {
          this.allPermissions = perms.data || [];
          const dbRoles: string[] = roles.data || [];
          const merged = [...new Set([...this.roles.map((r) => r.value), ...dbRoles])];
          this.allRoles = merged;
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

  // ── Manage tab: roles ─────────────────
  saveNewRole(): void {
    const role = this.newRoleName.trim().toUpperCase();
    if (!role) return;
    this.permService
      .setRolePermissions(role, [], this.auth.getUserId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isAddingRole = false;
          this.newRoleName = '';
          this.loadAllPermissions();
          this.cdr.markForCheck();
        },
      });
  }

  // ── User override tab ─────────────────
  searchUser(): void {
    if (!this.userSearchQuery.trim()) return;
    this.selectedUser = { user_id: this.userSearchQuery.trim() };
    this.selectedUserType = this.detectUserType(this.userSearchQuery.trim());
    this.loadUserPermissions(this.userSearchQuery.trim());
  }

  detectUserType(userId: string): string {
    if (/^\d{10}$/.test(userId)) return 'STUDENT';
    if (/^[a-zA-Z]/.test(userId)) return 'SELLER';
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
