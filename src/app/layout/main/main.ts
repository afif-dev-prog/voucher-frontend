import { Component, inject, OnInit } from '@angular/core';
import { Menubar } from '../menubar/menubar';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-main',
  imports: [Menubar, RouterModule, CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnInit {
  title: string = 'Voucher';
  private router = inject(Router);
  private auth = inject(Auth);
  showMenubar = false;

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      const hidden = ['/login', '/unauthorized', '/'];
      this.showMenubar = !hidden.includes(e.urlAfterRedirects);
    });
  }

  ngOnInit(): void {
    // ── On refresh: if logged in, redirect to correct dashboard ──
    const currentUrl = this.router.url;
    if (currentUrl === '/' || currentUrl === '/login') {
      if (this.auth.isLoggedIn()) {
        this.auth.redirectByRole();
      }
    }
  }
}
