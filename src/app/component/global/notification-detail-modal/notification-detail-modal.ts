import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../services/notification-service';

@Component({
  selector: 'app-notification-detail-modal',
  imports: [CommonModule],
  templateUrl: './notification-detail-modal.html',
  styleUrl: './notification-detail-modal.css',
})
export class NotificationDetailModal {
  svc = inject(NotificationService);

  getIcon(type: string): string {
    if (type === 'PAYMENT_RECEIVED') return '💰';
    if (type === 'PAYMENT_DEDUCTED') return '🧾';
    if (type === 'ANNOUNCEMENT') return '📢';
    return '🔔';
  }

  getIconType(type: string): string {
    if (type === 'PAYMENT_RECEIVED') return 'payment';
    if (type === 'PAYMENT_DEDUCTED') return 'deducted';
    if (type === 'ANNOUNCEMENT') return 'announcement';
    return 'default';
  }

  parseAmount(message: string): string | null {
    const match = message.match(/RM\s?([\d.]+)/i);
    return match ? `RM ${parseFloat(match[1]).toFixed(2)}` : null;
  }

  parseSeller(message: string): string | null {
    const toMatch = message.match(/to\s+(?:seller\s+)?(\S+)/i);
    const fromMatch = message.match(/from\s+(?:seller\s+)?(\S+)/i);
    return toMatch?.[1] || fromMatch?.[1] || null;
  }
}
