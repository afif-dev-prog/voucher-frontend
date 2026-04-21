import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthLogService {
  private http = inject(HttpClient);
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/auth';

  getLogs(
    pageNumber: number,
    pageSize: number,
    search = '',
    action = '',
    userType = '',
  ): Observable<any> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize)
      .set('search', search)
      .set('action', action)
      .set('userType', userType);
    return this.http
      .get<any>(`${this.apiUrl}/list`, { params })
      .pipe(catchError(() => of({ success: false, data: [], pagination: {} })));
  }

  getActiveSessions(search = '', userType = ''): Observable<any> {
    const params = new HttpParams().set('search', search).set('userType', userType);
    return this.http
      .get<any>(`${this.apiUrl}/active-sessions`, { params })
      .pipe(catchError(() => of({ success: false, data: [], count: 0 })));
  }

  killSession(sessionId: string, killedBy: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/kill-session/${sessionId}`, { killedBy })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }

  killAllSessions(userId: string, killedBy: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/kill-all/${userId}`, { killedBy })
      .pipe(catchError((err) => of({ success: false, message: err?.error?.message })));
  }
}
