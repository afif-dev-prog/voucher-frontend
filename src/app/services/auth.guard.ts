import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Not logged in
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // Check allowed roles
  const allowedRoles: string[] = route.data?.['roles'] || [];
  if (allowedRoles.length > 0 && !auth.isRole(...allowedRoles)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  // Check required permission
  const requiredPermission: string = route.data?.['permission'] || '';
  if (requiredPermission && !auth.hasPermission(requiredPermission)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};
