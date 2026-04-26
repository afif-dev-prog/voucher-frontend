import { Component, inject, OnInit, signal } from '@angular/core';
import { Main } from './layout/main/main';
import { Router, RouterModule } from '@angular/router';
import { Auth } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [Main, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private authService = inject(Auth);
  private router = inject(Router);
  ngOnInit(): void {
    // In app.component.ts ngOnInit
    setInterval(() => {
      if (this.authService.isTokenExpired()) {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    }, 60000); // check every 60 seconds
  }
  protected readonly title = signal('voucher_webapp2.0');
}
