import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private http = inject(HttpClient);
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/permissions';
  // readonly apiUrl = 'http://localhost:5094/api/permissions';

  getAllPermissions(): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/list`)
      .pipe(catchError(() => of({ success: false, data: [] })));
  }

  getRolePermissions(role: string): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/role/${role}`)
      .pipe(catchError(() => of({ success: false, data: [] })));
  }

  setRolePermissions(role: string, permissionIds: string[], grantedBy: string): Observable<any> {
    return this.http
      .put<any>(`${this.apiUrl}/role/${role}`, {
        permissionIds,
        grantedBy,
      })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }

  getUserPermissions(userId: string): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/user/${userId}`)
      .pipe(catchError(() => of({ success: false, data: [] })));
  }

  setUserPermissions(
    userId: string,
    userType: string,
    overrides: { permissionId: string; isGranted: boolean }[],
    setBy: string,
  ): Observable<any> {
    return this.http
      .put<any>(`${this.apiUrl}/user/${userId}`, {
        userType,
        setBy,
        overrides,
      })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }

  seedPermissions(): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/seed`, {})
      .pipe(catchError(() => of({ success: false })));
  }

  getAllRoles(): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/roles`)
      .pipe(catchError(() => of({ success: false, data: [] })));
  }

  addPermission(data: {
    code: string;
    label: string;
    module: string;
    description: string;
  }): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}`, data)
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }

  editPermission(
    id: string,
    data: { label: string; module: string; description: string },
  ): Observable<any> {
    return this.http
      .put<any>(`${this.apiUrl}/${id}`, data)
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }

  deletePermission(id: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/${id}`)
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }

  deleteRole(role: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/role/${role}`)
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }
}
