import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { SellerModel } from '../model/seller';

@Injectable({
  providedIn: 'root',
})
export class Seller {
  private http = inject(HttpClient);
  readonly apiUrl = 'http://localhost:5094/api/voucher/seller';

  scantoPay(studentId: string, seller: number, amount: number) {
    const headers = { 'content-type': 'application/json' };
    return this.http
      .post<any>(
        `${this.apiUrl}/scantopay?studentId=${studentId}&sellerId=${seller}&price=${amount}`,
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

  // getSellerTransactions(
  //   sellerName: string,
  //   pageNumber: number,
  //   pageSize: number,
  //   startDate?: number,
  //   endDate?: number,
  // ): Observable<any> {
  //   let params = new HttpParams()
  //     .set('sellerName', sellerName)
  //     .set('pageNumber', pageNumber)
  //     .set('pageSize', pageSize);

  //   if (startDate) params = params.set('startDate', startDate);
  //   if (endDate) params = params.set('endDate', endDate);

  //   return this.http.get<any>(`${this.apiUrl}/transaction`, { params }).pipe(
  //     catchError((error) => {
  //       console.error('Error fetching seller transactions:', error);
  //       throw error;
  //     }),
  //   );
  // }

  getSellerTransactions(
    sellerName: string,
    pageNumber: number,
    pageSize: number,
    startDate?: number,
    endDate?: number,
  ): Observable<any> {
    console.log('getSellerTransactions called with:', {
      sellerName,
      pageNumber,
      pageSize,
      startDate,
      endDate,
    });

    let params = new HttpParams()
      .set('sellerName', sellerName)
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    console.log('Final query params:', params.toString());

    return this.http.get<any>(`${this.apiUrl}/transaction`, { params }).pipe(
      catchError((error) => {
        console.error('Error fetching seller transactions:', error);
        throw error;
      }),
    );
  }
  getSellerList(pageNumber: number, pageSize: number, search: string): Observable<any> {
    // const headers = { 'content-type': 'application/json' };
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize)
      .set('search', search);
    return this.http.get<any>(`${this.apiUrl}/list/pagination`, { params }).pipe(
      catchError((error) => {
        console.error('Error fetching seller list:', error);
        return of(error.status);
      }),
    );
  }

  addSeller(seller: SellerModel) {
    const headers = { 'content-type': 'application/json' };

    return this.http
      .post<any>(`${this.apiUrl}/add`, JSON.stringify(seller), { headers: headers })
      .pipe(
        catchError((error) => {
          return of(error.status);
        }),
      );
  }

  updateSeller(seller: SellerModel, sellerId: number) {
    const headers = { 'content-type': 'application/json' };

    return this.http
      .put<any>(`${this.apiUrl}/seller/update/${sellerId}`, JSON.stringify(seller), {
        headers: headers,
      })
      .pipe(
        catchError((error) => {
          return of(error.status);
        }),
      );
  }

  deleteSeller(sellerId: number) {
    const headers = { 'content-type': 'application/json' };

    return this.http.delete<any>(`${this.apiUrl}/delete/${sellerId}`, { headers: headers }).pipe(
      catchError((error) => {
        return of(error.status);
      }),
    );
  }
}
