import { inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private swUpdate = inject(SwUpdate);

  checkForUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    // Listen for new version ready
    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        // Dispatch a custom event so any component can listen
        window.dispatchEvent(new CustomEvent('app-update-available'));
      });

    // Actively check on call (useful on app open/login)
    this.swUpdate.checkForUpdate();
  }

  applyUpdate(): void {
    this.swUpdate.activateUpdate().then(() => {
      window.location.reload();
    });
  }
}
