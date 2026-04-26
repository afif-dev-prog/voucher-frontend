import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Auth } from '../../../services/auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-change-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword {
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  isLoading = false;
  errorMsg = '';
  successMsg = '';

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  get isMustChange(): boolean {
    return this.auth.getPayload()?.must_change_password === 'true';
  }

  get userName(): string {
    return this.auth.getName();
  }

  submit(): void {
    this.errorMsg = '';
    this.successMsg = '';

    if (!this.currentPassword.trim()) {
      this.errorMsg = 'Please enter your current password.';
      return;
    }
    if (!this.newPassword.trim() || this.newPassword.length < 8) {
      this.errorMsg = 'New password must be at least 8 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMsg = 'New passwords do not match.';
      return;
    }
    if (this.currentPassword === this.newPassword) {
      this.errorMsg = 'New password must be different from current password.';
      return;
    }

    this.isLoading = true;

    this.auth
      .changePassword(this.currentPassword, this.newPassword, this.confirmPassword)
      .subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.successMsg = 'Password changed successfully. Please login again...';
            this.cdr.markForCheck();
            setTimeout(() => {
              this.auth.logout(); // clear token, redirect to login
            }, 2000);
          } else {
            this.errorMsg = res?.message || 'Failed to change password.';
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }
}
