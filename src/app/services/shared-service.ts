import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  private refreshTrigger = new Subject<void>();
  refresh$ = this.refreshTrigger.asObservable();

  trigger(): void {
    this.refreshTrigger.next();
  }
}
