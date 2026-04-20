import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  private router = inject(Router);

  username = '';
  password = '';
  isLoading = false;
  errorMsg = '';
  showPassword = false;

  login(): void {
    this.errorMsg = '';
    if (!this.username.trim()) {
      this.errorMsg = 'Please enter your ID or username.';
      return;
    }
    if (!this.password.trim()) {
      this.errorMsg = 'Please enter your password.';
      return;
    }

    this.isLoading = true;

    this.auth.login(this.username.trim(), this.password).subscribe({
      next: (res: any) => {
        if (res?.success) {
          // ── Redirect based on role from response ──
          const role = res.user?.role;
          switch (role) {
            case 'STUDENT':
              this.router.navigate(['/balance']);
              break;
            case 'SELLER':
              this.router.navigate(['/scantopay']);
              break;
            case 'FINANCE':
              this.router.navigate(['/floatmoneylist']);
              break;
            case 'SUPERADMIN':
              this.router.navigate(['/managestudent']);
              break;
            default:
              this.router.navigate(['/login']);
              break;
          }
        } else {
          this.errorMsg = res?.message || 'Invalid credentials.';
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMsg = 'Unable to connect. Please try again.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.login();
  }
}
