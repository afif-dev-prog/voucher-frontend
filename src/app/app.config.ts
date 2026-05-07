import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';
import { Auth } from './services/auth';
import { firstValueFrom } from 'rxjs';
import { provideServiceWorker } from '@angular/service-worker';
// import { provideServiceWorker } from '@angular/service-worker';

function initSession(auth: Auth) {
  return async () => {
    if (!auth.isLoggedIn()) return;
    try {
      await firstValueFrom(auth.validate());
    } catch {
      // localStorage.removeItem('token');
      // localStorage.removeItem('userInfo');
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initSession,
      deps: [Auth],
      multi: true,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
