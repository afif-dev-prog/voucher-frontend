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
  permissions: string; // JSON stringified array
  exp: number;
  jti: string;
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
  }
}
