import { Directive, HostListener, Output, EventEmitter, ElementRef } from '@angular/core';

@Directive({ selector: '[appPullToRefresh]', standalone: true })
export class PullToRefreshDirective {
  @Output() pullToRefresh = new EventEmitter<void>();

  private startY = 0;
  private threshold = 80;
  private isPulling = false;

  constructor(private el: ElementRef) {}

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    // Check if any scrollable parent is at the top
    const scrollable = this.getScrollableParent(e.target as HTMLElement);
    const scrollTop = scrollable ? scrollable.scrollTop : window.scrollY;

    if (scrollTop <= 0) {
      this.startY = e.touches[0].clientY;
      this.isPulling = true;
    } else {
      this.isPulling = false;
    }
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent) {
    if (!this.isPulling) return;

    const deltaY = e.changedTouches[0].clientY - this.startY;
    if (deltaY > this.threshold) {
      this.pullToRefresh.emit();
    }
    this.isPulling = false;
  }

  private getScrollableParent(el: HTMLElement | null): HTMLElement | null {
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const overflow = style.overflow + style.overflowY;
      if (/(auto|scroll)/.test(overflow) && el.scrollHeight > el.clientHeight) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }
}
