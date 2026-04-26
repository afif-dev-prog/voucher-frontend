import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { Auth } from './auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const token = auth.getToken();

  const cloned = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      const skipAutoLogout =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/validate') ||
        req.url.includes('/auth/logout') ||
        req.url.includes('/auth/change-password'); // ← add all these

      if (err.status === 401 && !skipAutoLogout) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
