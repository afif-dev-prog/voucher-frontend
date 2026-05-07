import { Component, inject, OnInit, signal } from '@angular/core';
import { Main } from './layout/main/main';
import { NavigationStart, Router, RouterModule } from '@angular/router';
import { Auth } from './services/auth';
import { filter } from 'rxjs';

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
    // Token expiry check
    setInterval(() => {
      if (this.authService.isTokenExpired()) {
        this.authService.logout();
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    }, 60000);

    // ── Block back-navigation to /login when already logged in ──
    this.router.events.pipe(filter((e) => e instanceof NavigationStart)).subscribe((e: any) => {
      if (
        e.url === '/login' &&
        this.authService.isLoggedIn() &&
        e.navigationTrigger === 'popstate' // only for back/forward button
      ) {
        this.authService.redirectByRole();
      }
    });
  }
  protected readonly title = signal('voucher_webapp2.0');
}
