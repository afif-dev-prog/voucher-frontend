import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { catchError, Observable, of, tap } from 'rxjs';
interface JwtPayload {
  sub: string;
  name: string;
  username: string;
  role: string;
  permissions: string;
  exp: number;
  jti: string;
  location?: string;
  must_change_password?: string; // ← add this
}
@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/auth';
  // readonly apiUrl = 'http://localhost:5094/api/auth';

  // ── Login ──────────────────────────────
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { username, password }).pipe(
      tap((res) => {
        if (res?.success) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('userInfo', JSON.stringify(res.user));
        }
      }),
      catchError(() => of({ success: false, message: 'Unable to connect.' })),
    );
  }

  // ── Logout ─────────────────────────────
  logout(): void {
    const token = this.getToken();

    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');

    if (token) {
      this.http
        .post(
          `${this.apiUrl}/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        .pipe(catchError(() => of(null))) // ← silently swallow ALL errors including 401
        .subscribe();
    }

    this.router.navigate(['/login']);
  }

  resetPassword(userId: string, userType: number, temporaryPassword: string): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/reset-password`, {
        userId,
        userType,
        temporaryPassword,
        // 1=Student, 2=Seller, 3=Staff
      })
      .pipe(catchError((err) => of(err.error)));
  }

  // ── Token ──────────────────────────────
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getPayload(): JwtPayload | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  // ── User info ──────────────────────────
  getRole(): string {
    return this.getPayload()?.role || '';
  }

  getLocation(): string | null {
    return this.getPayload()?.location ?? null;
  }

  getUserId(): string {
    return this.getPayload()?.sub || '';
  }

  getName(): string {
    return this.getPayload()?.name || '';
  }

  getPermissions(): string[] {
    try {
      const raw = this.getPayload()?.permissions;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ── Permission checks ──────────────────
  hasPermission(code: string): boolean {
    if (this.getRole() === 'SUPERADMIN') return true;
    return this.getPermissions().includes(code);
  }

  isRole(...roles: string[]): boolean {
    return roles.includes(this.getRole());
  }
  validate(): Observable<any> {
    return this.http.post(`${this.apiUrl}/validate`, {});
  }

  // ── Redirect after login ───────────────
  // redirectByRole(): void {
  //   const role = this.getRole();
  //   switch (role) {
  //     case 'STUDENT':
  //       this.router.navigate(['/student']);
  //       break;
  //     case 'SELLER':
  //       this.router.navigate(['/seller']);
  //       break;
  //     case 'FINANCE':
  //       this.router.navigate(['/finance']);
  //       break;
  //     case 'SUPERADMIN':
  //       this.router.navigate(['/admin']);
  //       break;
  //     default:
  //       this.router.navigate(['/login']);
  //       break;
  //   }
  // }
  redirectByRole(): void {
    const role = this.getRole();
    switch (role) {
      case 'STUDENT':
        this.router.navigate(['/balance'], { replaceUrl: true });
        break;
      case 'SELLER':
        this.router.navigate(['/scantopay'], { replaceUrl: true });
        break;
      case 'FINANCE':
        this.router.navigate(['/floatmoneylist'], { replaceUrl: true });
        break;
      case 'SUPERADMIN':
        this.router.navigate(['/managestudent'], { replaceUrl: true });
        break;
      case 'ADMIN':
        this.router.navigate(['/managestudent'], { replaceUrl: true });
        break;
      default:
        this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
  changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/change-password`, {
        currentPassword,
        newPassword,
        confirmPassword,
      })
      .pipe(catchError((err) => of(err.error)));
  }

  // In your auth.service.ts
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // convert to ms
    return Date.now() >= exp;
  }
}
