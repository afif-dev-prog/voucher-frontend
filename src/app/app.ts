import { Component, signal } from '@angular/core';
import { Main } from './layout/main/main';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [Main, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('voucher_webapp2.0');
}
