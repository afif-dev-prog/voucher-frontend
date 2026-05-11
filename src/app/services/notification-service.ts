import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  // readonly apiUrl = 'http://localhost:5094/api/voucher/announcements';
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/announcements';
  selectedNotif = signal<any | null>(null);

  open(notif: any): void {
    this.selectedNotif.set(notif);
  }

  close(): void {
    this.selectedNotif.set(null);
  }
  getMyNotifications(page = 1, pageSize = 20): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/my?pageNumber=${page}&pageSize=${pageSize}`)
      .pipe(catchError((err) => of(err.error)));
  }

  markRead(id: string): Observable<any> {
    return this.http
      .patch(`${this.apiUrl}/${id}/read`, {})
      .pipe(catchError((err) => of(err.error)));
  }

  markAllRead(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/read-all`, {}).pipe(catchError((err) => of(err.error)));
  }

  // Superadmin
  sendAnnouncement(data: {
    title: string;
    message: string;
    target: string;
    sendEmail: boolean;
    sendPush: boolean;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}`, data).pipe(catchError((err) => of(err.error)));
  }

  getAnnouncements(page = 1): Observable<any> {
    return this.http
      .get(`${this.apiUrl}?pageNumber=${page}`)
      .pipe(catchError((err) => of(err.error)));
  }
}
