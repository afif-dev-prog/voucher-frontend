// count-granted.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'countGranted', standalone: true, pure: false })
export class CountGrantedPipe implements PipeTransform {
  transform(permissions: any[]): number {
    return permissions?.filter((p) => p.granted).length || 0;
  }
}
