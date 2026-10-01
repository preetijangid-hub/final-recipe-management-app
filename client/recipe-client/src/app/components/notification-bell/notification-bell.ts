import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AppNotification } from '../../models/notification';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBell implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // Signals are exposed directly so the template stays easy to read.
  readonly notifications = this.notificationService.notifications;
  readonly unreadCount = this.notificationService.visibleUnreadCount;
  readonly badgeLabel = this.notificationService.badgeLabel;
  readonly loading = this.notificationService.loading;
  readonly toast = this.notificationService.toast;
  readonly toastsEnabled = this.notificationService.toastsEnabled;

  isOpen = false;

  ngOnInit(): void {
    // The bell only exists while the header is shown, which is exactly
    // when the socket should be open and the history loaded.
    this.notificationService.connect();
    this.notificationService.loadNotifications();
  }

  ngOnDestroy(): void {
    // Leaving the header, for example on logout, closes the socket.
    this.notificationService.disconnect();
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }

  // Closes the panel when the user clicks anywhere outside the bell.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }

    const target = event.target as Node | null;

    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  openNotification(notification: AppNotification): void {
    this.notificationService.markAsRead(notification);
    this.close();

    if (notification.recipe?._id) {
      this.router.navigate(['/recipes', notification.recipe._id]);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  toggleToasts(): void {
    this.notificationService.setToastsEnabled(!this.toastsEnabled());
  }

  openToast(): void {
    const notification = this.toast();

    if (!notification) {
      return;
    }

    this.notificationService.dismissToast();

    if (notification.recipe?._id) {
      this.router.navigate(['/recipes', notification.recipe._id]);
    }
  }

  dismissToast(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.dismissToast();
  }

  relativeTime(value: string): string {
    const createdAt = new Date(value).getTime();

    if (Number.isNaN(createdAt)) {
      return '';
    }

    const seconds = Math.floor((Date.now() - createdAt) / 1000);

    if (seconds < 60) {
      return 'just now';
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days}d ago`;
    }

    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}
