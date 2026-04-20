import { Component, inject } from '@angular/core';
import { Menubar } from '../menubar/menubar';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

@Component({
  selector: 'app-main',
  imports: [Menubar, RouterModule, CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {
  title: string = 'Voucher';
  private router = inject(Router);
  showMenubar = false;

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      const hidden = ['/login', '/unauthorized', '/'];
      this.showMenubar = !hidden.includes(e.urlAfterRedirects);
    });
  }
}
