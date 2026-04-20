import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Float {
  private http = inject(HttpClient);

  // readonly apiUrl = 'http://localhost:5094/api/voucher/floating';
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/floating';

  getPaginatedFloatList(pageNumber: number, pageSize: number, search: string): Observable<any> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize)
      .set('search', search); // ← added, empty string by default

    return this.http
      .get<any>(`${this.apiUrl}/paginated?pageNumber=${pageNumber}&pageSize=${pageSize}`)
      .pipe(
        catchError((err) => {
          return of(err.status);
        }),
      );
  }

  proceedFloat(param: {
    ids: [''];
    amount: number;
    month_credit: string;
    user_update: string;
  }): Observable<any> {
    const header = { 'content-type': 'application/json' };

    return this.http
      .post<any>(`${this.apiUrl}/proceedCredit`, JSON.stringify(param), {
        headers: header,
      })
      .pipe(
        catchError((err) => {
          return of(err.status);
        }),
      );
  }

  deleteFloat(studentId: string): Observable<any> {
    const header = { 'content-type': 'application/json' };

    return this.http.delete<any>(`${this.apiUrl}/delete/${studentId}`, { headers: header }).pipe(
      catchError((err) => {
        return of(err.status);
      }),
    );
  }
  updateFloat(
    h_id: number,
    payload: {
      student_id: string;
      amount: number;
      pay_date: number;
      user_update: string;
      month_credit: string;
    },
  ) {
    const header = { 'content-type': 'application/json' };

    return this.http
      .put<any>(`${this.apiUrl}/update/${h_id}`, JSON.stringify(payload), {
        headers: header,
      })
      .pipe(
        catchError((err) => {
          return of(err.status);
        }),
      );
  }
}
