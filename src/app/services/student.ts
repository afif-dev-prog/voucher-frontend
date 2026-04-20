import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Student {
  readonly apiUrl = 'http://localhost:5094/api/voucher/student';

  private http = inject(HttpClient);

  getBalance(studentId: string) {
    return this.http.get<any>(`${this.apiUrl}/find/${studentId}`).pipe(
      catchError((error) => {
        console.error('Error fetching balance:', error);
        return of(error.status);
      }),
    );
  }

  getTransactionsPaginated(studentId: string, page: number, pageSize: number) {
    return this.http
      .get<any>(
        `${this.apiUrl}/transaction/paginated/${studentId}?PageNumber=${page}&PageSize=${pageSize}`,
      )
      .pipe(
        catchError((error) => {
          console.error('Error fetching transactions:', error);
          return of(error.status);
        }),
      );
  }
}
