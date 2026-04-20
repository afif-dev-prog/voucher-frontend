import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { AddStudent, StudentModel, SubmitStudent } from '../model/student';

@Injectable({
  providedIn: 'root',
})
export class Staff {
  readonly apiUrl = 'https://glossary.sarawakskills.edu.my/gateway/fvs';
  // readonly apiUrl = 'http://localhost:5094/api/voucher';

  private http = inject(HttpClient);

  getFloatListPaginated(page: number, pageSize: number) {
    return this.http
      .get<any>(`${this.apiUrl}/floating/paginated?page=${page}&pageSize=${pageSize}`)
      .pipe(
        catchError((error) => {
          console.error('Error fetching float list:', error);
          return of(error.status);
        }),
      );
  }

  getStudentListPaginated(pageNumber: number, pageSize: number, search: string) {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize)
      .set('search', search); // ← added, empty string by default

    return this.http.get<any>(`${this.apiUrl}/student/paginated`, { params }).pipe(
      catchError((error) => {
        // console.error('Error fetching student list:', error);
        return of(error.status);
      }),
    );
  }

  //manage student
  addStudent(student: SubmitStudent): Observable<any> {
    const headers = { 'content-type': 'application/json' };
    return this.http
      .post<any>(`${this.apiUrl}/usermanagement/addstudent`, JSON.stringify(student), {
        headers: headers,
      })
      .pipe(
        catchError((error) => {
          console.error('Error adding student:', error);
          return of(error.status);
        }),
      );
  }

  updateStudent(student: StudentModel) {
    const headers = { 'content-type': 'application/json' };
    return this.http
      .put<any>(
        `${this.apiUrl}/usermanagement/updatedata/${student.student_id}`,
        JSON.stringify(student),
        {
          headers: headers,
        },
      )
      .pipe(
        catchError((error) => {
          console.error('Error updating student:', error);
          return of(error.status);
        }),
      );
  }

  deleteStudent(studentId: number) {
    return this.http.delete<any>(`${this.apiUrl}/usermanagement/deletedata/${studentId}`).pipe(
      catchError((error) => {
        console.error('Error deleting student:', error);
        return of(error.status);
      }),
    );
  }

  //credit voucher
  creditVoucher(payload: {
    student_id: string;
    amount: number | 0.0;
    remark: string;
    month_credit: string;
    user_update: string;
  }): Observable<any> {
    const headers = { 'content-type': 'application/json' };

    return this.http
      .post<any>(
        `${this.apiUrl}/staff/creditvoucher?studentId=${payload.student_id}&amount=${payload.amount}&userUpdate=${payload.user_update}&monthCredit=${payload.month_credit}`,

        {
          headers: headers,
        },
      )
      .pipe(
        catchError((error) => {
          return of(error.status);
        }),
      );
  }

  parkvouchertofloat(payload: {
    student_id: string;
    credit: number | 0.0;
    month_credit: string;
    user_update: string;
  }): Observable<any> {
    const headers = { 'content-type': 'application/json' };

    return this.http
      .post<any>(`${this.apiUrl}/staff/parkvouchertofloat`, JSON.stringify(payload), {
        headers: headers,
      })
      .pipe(
        catchError((err) => {
          return of(err.status);
        }),
      );
  }
}
