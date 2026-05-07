import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { isDevMode } from '@angular/core';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

if ('serviceWorker' in navigator && !isDevMode()) {
  navigator.serviceWorker
    .register('/sw-push-handler.js', { scope: '/' })
    .then((reg) => console.log('Custom SW registered:', reg.scope))
    .catch((err) => console.error('Custom SW failed:', err));
}
