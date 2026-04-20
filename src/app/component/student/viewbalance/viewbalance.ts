import { AfterViewInit, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Student } from '../../../services/student';
import { CommonModule, DatePipe } from '@angular/common';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-viewbalance',
  imports: [DatePipe, CommonModule],
  templateUrl: './viewbalance.html',
  styleUrl: './viewbalance.css',
})
export class Viewbalance implements OnInit, AfterViewInit {
  // private studentService = inject(Student);
  studentId = '';
  private auth = inject(Auth);
  constructor(
    private studentService: Student,
    private cdr: ChangeDetectorRef,
  ) {
    // this.getBalance();
    this.studentId = this.auth.getUserId();
  }
  ngAfterViewInit(): void {
    this.getBalance();
  }

  apiRes: any = [];
  ngOnInit(): void {
    this.getBalance();
    this.studentId = this.auth.getUserId();
    console.log(this.studentId);
  }

  getBalance() {
    this.studentService.getBalance(this.studentId).subscribe((res) => {
      this.apiRes = res.data;
      this.cdr.markForCheck();
      console.log(this.apiRes);
    });
  }
}
