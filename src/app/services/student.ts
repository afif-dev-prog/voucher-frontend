import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Student {
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs/student';
  readonly apiUrl2 = 'https://glossary.sarawakskills.edu.my/gateway/fvs/usermanagement';
  // readonly apiUrl = 'http://localhost:5094/api/voucher/student';

  private http = inject(HttpClient);

  getBalance(studentId: string) {
    return this.http.get<any>(`${this.apiUrl}/find/${studentId}`).pipe(
      catchError((error) => {
        console.error('Error fetching balance:', error);
        return of(error.status);
      }),
    );
  }

  getStudentById(studentId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl2}/student/find/${studentId}`).pipe(
      catchError((error) => {
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

  validateSeller(scannedId: string): Observable<any> {
    return this.http
      .get<any>(`${this.apiUrl}/seller/validate/${scannedId}`)
      .pipe(catchError(() => of({ success: false, isSeller: false })));
  }

  studentPay(studentId: string, sellerId: string, amount: number): Observable<any> {
    const headers = { 'content-type': 'application/json' };
    return this.http
      .post<any>(
        `${this.apiUrl}/studentscantopay?studentId=${studentId}&sellerUsername=${sellerId}&amount=${amount}`,
        {
          headers: headers,
        },
      )
      .pipe(
        catchError((error) => {
          console.error('Error during scan to pay:', error);
          throw error; // rethrow the error after logging it
        }),
      );
  }

  // scantoPay(studentId: string, seller: number, amount: number) {
  //   const headers = { 'content-type': 'application/json' };
  //   return this.http
  //     .post<any>(
  //       `${this.apiUrl}/scantopay?studentId=${studentId}&sellerId=${seller}&price=${amount}`,
  //       {
  //         headers: headers,
  //       },
  //     )
  //     .pipe(
  //       catchError((error) => {
  //         console.error('Error during scan to pay:', error);
  //         throw error; // rethrow the error after logging it
  //       }),
  //     );
  // }
}
