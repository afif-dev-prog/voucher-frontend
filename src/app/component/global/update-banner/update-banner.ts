import { Component, inject, signal } from '@angular/core';
import { AppUpdateService } from '../../../services/app-update-service';

@Component({
  selector: 'app-update-banner',
  imports: [],
  templateUrl: './update-banner.html',
  styleUrl: './update-banner.css',
})
export class UpdateBanner {
  private updateService = inject(AppUpdateService);
  showBanner = signal(false);

  ngOnInit(): void {
    window.addEventListener('app-update-available', () => {
      this.showBanner.set(true);
    });
  }

  update(): void {
    this.updateService.applyUpdate();
  }

  dismiss(): void {
    this.showBanner.set(false);
  }
}
