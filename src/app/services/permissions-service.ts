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

  addPermission(payload: { code: string; label: string; module: string; description: string }) {
    return this.http.post<any>(`${this.apiUrl}/permission/add`, payload);
  }

  editPermission(
    id: string,
    payload: { code: string; label: string; module: string; description: string },
  ) {
    return this.http.put<any>(`${this.apiUrl}/permission/update/${id}`, payload);
  }

  deletePermission(id: string) {
    return this.http.delete<any>(`${this.apiUrl}/delete/${id}`);
  }

  addRolePermissions(
    dto: { role: string; granted_by: string; granted_at: number },
    permissionIds: string[],
  ) {
    return this.http.post<any>(`${this.apiUrl}/rolepermission/add`, {
      RolePermission: dto,
      PermissionIds: permissionIds,
    });
  }

  updateRolePermissions(
    role: string,
    payload: { role: string; granted_by: string; granted_at: number; permIds: string[] },
  ) {
    return this.http.put<any>(`${this.apiUrl}/rolepermission/update/${role}`, payload);
  }
  deleteRole(role: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/role/${role}`)
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }
}
