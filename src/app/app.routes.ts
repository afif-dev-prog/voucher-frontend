import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { Login } from './component/auth/login/login';
import { ChangePassword } from './component/all/change-password/change-password';

export const routes: Routes = [
  // ── Public ────────────────────────────
  { path: 'login', component: Login },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./component/auth/unauthorized/unauthorized').then((m) => m.Unauthorized),
  },

  {
    path: 'authlog',
    canActivate: [authGuard],
    data: { roles: ['SUPERADMIN'] },
    loadComponent: () => import('./component/auth/authlog/authlog').then((m) => m.Authlog),
  },

  // ── Student ───────────────────────────
  {
    path: 'balance',
    canActivate: [authGuard],
    data: { roles: ['STUDENT'] },
    loadComponent: () =>
      import('./component/student/viewbalance/viewbalance').then((m) => m.Viewbalance),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    data: { roles: ['STUDENT'] },
    loadComponent: () =>
      import('./component/student/transhistory/transhistory').then((m) => m.Transhistory),
  },
  {
    path: 'scan',
    canActivate: [authGuard],
    data: { roles: ['STUDENT'] },
    loadComponent: () =>
      import('./component/student/studentscan/studentscan').then((m) => m.Studentscan),
  },

  // ── Seller ────────────────────────────
  {
    path: 'scantopay',
    canActivate: [authGuard],
    data: { roles: ['SELLER'] },
    loadComponent: () => import('./component/seller/scantopay/scantopay').then((m) => m.Scantopay),
  },
  {
    path: 'sellerhistory',
    canActivate: [authGuard],
    data: { roles: ['SELLER'] },
    loadComponent: () =>
      import('./component/seller/transhistory/transhistory').then((m) => m.Transhistory),
  },
  {
    path: 'claimvoucher',
    canActivate: [authGuard],
    data: { roles: ['SELLER'] },
    loadComponent: () =>
      import('./component/seller/claimvoucher/claimvoucher').then((m) => m.Claimvoucher),
  },

  // ── Finance / Staff ───────────────────
  {
    path: 'creditvoucher',
    canActivate: [authGuard],
    data: { roles: ['FINANCE', 'SUPERADMIN', 'ADMIN'] },
    loadComponent: () =>
      import('./component/staff/creditvoucher/creditvoucher').then((m) => m.Creditvoucher),
  },
  {
    path: 'floatmoneylist',
    canActivate: [authGuard],
    data: { roles: ['FINANCE', 'SUPERADMIN', 'ADMIN'] },
    loadComponent: () =>
      import('./component/staff/floatmoneylist/floatmoneylist').then((m) => m.Floatmoneylist),
  },
  {
    path: 'managestudent',
    canActivate: [authGuard],
    data: { roles: ['FINANCE', 'SUPERADMIN', 'ADMIN'] },
    loadComponent: () =>
      import('./component/staff/managestudent/managestudent').then((m) => m.Managestudent),
  },

  // ── Admin / Superadmin ────────────────

  {
    path: 'announcements',
    canActivate: [authGuard],
    data: { roles: ['SUPERADMIN'] },
    loadComponent: () =>
      import('./component/admin/announcement/announcement').then((m) => m.Announcement),
  },
  {
    path: 'manageseller',
    canActivate: [authGuard],
    data: { roles: ['SUPERADMIN', 'ADMIN'] },
    loadComponent: () =>
      import('./component/admin/manageseller/manageseller').then((m) => m.Manageseller),
  },

  // Admin - Permissions management
  {
    path: 'permissions',
    canActivate: [authGuard],
    data: { roles: ['SUPERADMIN'] },
    loadComponent: () =>
      import('./component/auth/permissions/permissions').then((m) => m.Permissions),
  },
  {
    path: 'managestaff',
    canActivate: [authGuard],
    data: { roles: ['SUPERADMIN'] },
    loadComponent: () =>
      import('./component/admin/managestaff/managestaff').then((m) => m.Managestaff),
  },

  {
    path: 'change-password',
    canActivate: [authGuard], // must be logged in to access
    loadComponent: () =>
      import('./component/all/change-password/change-password').then((m) => m.ChangePassword),
  },

  {
    path: 'wrong-credit',
    canActivate: [authGuard],
    data: { roles: ['SUPERADMIN'] },
    loadComponent: () =>
      import('./component/staff/wrong-credit/wrong-credit').then((m) => m.WrongCredit),
  },
  // ── Fallback ──────────────────────────
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
