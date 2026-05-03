// pull-to-refresh.directive.ts
import { Directive, HostListener, Output, EventEmitter } from '@angular/core';

@Directive({ selector: '[appPullToRefresh]' })
export class PullToRefreshDirective {
  @Output() pullToRefresh = new EventEmitter<void>();

  private startY = 0;
  private threshold = 80;

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    this.startY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - this.startY;
    const scrollTop = (e.target as HTMLElement).scrollTop ?? window.scrollY;

    if (deltaY > this.threshold && scrollTop === 0) {
      this.pullToRefresh.emit();
    }
  }
}
