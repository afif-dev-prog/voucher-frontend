import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';
import { filter } from 'rxjs';

@Component({
  selector: 'app-menubar',
  imports: [RouterLink, RouterLinkActive, RouterModule, CommonModule],
  templateUrl: './menubar.html',
  styleUrl: './menubar.css',
})
export class Menubar implements OnInit {
  public router = inject(Router);
  private auth = inject(Auth);
  role = '';
  userName = '';
  userId = '';
  activeIndex = 0;

  isStudent = false;
  isSeller = false;
  isFinance = false;
  isSuperAdmin = false;

  // ── Route → index maps per role ───────
  private readonly routeIndexMap: Record<string, Record<string, number>> = {
    STUDENT: { '/balance': 0, '/scan': 1, '/history': 2 },
    SELLER: { '/scantopay': 0, '/sellerhistory': 1, '/claimvoucher': 2 },
    FINANCE: { '/floatmoneylist': 0, '/creditvoucher': 1, '/managestudent': 2 },
    SUPERADMIN: {
      '/managestudent': 0,
      '/manageseller': 1,
      '/floatmoneylist': 2,
      '/creditvoucher': 3,
      '/permissions': 4,
      '/authlog': 5,
    },
  };

  private scrollOffset = 0;
  ngOnInit(): void {
    this.role = this.auth.getRole();
    this.userName = this.auth.getName();
    this.userId = this.auth.getUserId();
    this.isStudent = this.role === 'STUDENT';
    this.isSeller = this.role === 'SELLER';
    this.isFinance = this.role === 'FINANCE';
    this.isSuperAdmin = this.role === 'SUPERADMIN';

    // Set initial active index from current URL
    this.syncGliderFromUrl(this.router.url);

    // Keep glider in sync on navigation
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => this.syncGliderFromUrl(e.urlAfterRedirects));

    setTimeout(() => {
      const pill = document.querySelector('.nav-pill');
      if (pill) {
        pill.addEventListener('scroll', () => {
          this.scrollOffset = pill.scrollLeft;
        });
      }
    }, 100);
  }

  syncGliderFromUrl(url: string): void {
    const map = this.routeIndexMap[this.role] || {};
    const path = url.split('?')[0];
    const index = map[path];
    if (index !== undefined) {
      this.activeIndex = index;
      // ── Scroll active item into view ──
      setTimeout(() => {
        const pill = document.querySelector('.nav-pill');
        const items = document.querySelectorAll('.nav-item');
        if (pill && items[index]) {
          const item = items[index] as HTMLElement;
          const itemLeft = item.offsetLeft;
          const itemWidth = item.offsetWidth;
          const pillWidth = (pill as HTMLElement).offsetWidth;
          pill.scrollTo({
            left: itemLeft - pillWidth / 2 + itemWidth / 2,
            behavior: 'smooth',
          });
        }
      }, 50);
    }
  }

  setActive(index: number): void {
    this.activeIndex = index;
  }

  get gliderTransform(): string {
    const isMobile = window.innerWidth <= 700;
    if (isMobile) {
      return `translateX(${this.activeIndex * 100}%)`;
    } else {
      return `translateY(${this.activeIndex * 100}%)`;
    }
  }
  canView(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  logout(): void {
    this.auth.logout();
  }
}
