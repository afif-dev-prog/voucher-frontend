import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-menubar',
  imports: [RouterLink, RouterLinkActive, RouterModule, CommonModule],
  templateUrl: './menubar.html',
  styleUrl: './menubar.css',
})
export class Menubar {
  public router = inject(Router);
  private auth = inject(Auth);

  role = '';
  userName = '';
  userId = '';

  // ── Role visibility flags ─────────────
  isStudent = false;
  isSeller = false;
  isFinance = false;
  isSuperAdmin = false;

  ngOnInit(): void {
    this.role = this.auth.getRole();
    this.userName = this.auth.getName();
    this.userId = this.auth.getUserId();

    this.isStudent = this.role === 'STUDENT';
    this.isSeller = this.role === 'SELLER';
    this.isFinance = this.role === 'FINANCE';
    this.isSuperAdmin = this.role === 'SUPERADMIN';
  }

  // Permission check helpers
  canView(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  logout(): void {
    this.auth.logout();
  }
}
