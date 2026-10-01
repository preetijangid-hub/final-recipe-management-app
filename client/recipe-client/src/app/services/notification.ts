import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Socket, io } from 'socket.io-client';

import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import {
  AppNotification,
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationListResponse,
} from '../models/notification';

// Event the backend pushes to the owner's private room.
const NEW_NOTIFICATION_EVENT = 'notification:new';

// Where the "show toast alerts" switch is remembered between sessions.
const TOAST_PREFERENCE_KEY = 'savore.toasts.enabled';

/**
 * Single source of truth for the notification bell. It owns the Socket.IO
 * connection for the signed-in user, keeps the notification list and the
 * unread count in signals and talks to the REST API for history and read
 * state.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly apiUrl = `${environment.apiBaseUrl}/notifications`;

  // The Socket.IO server lives at the API origin without the /api suffix.
  private readonly socketUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '');

  private socket: Socket | null = null;
  private socketUserId: string | null = null;

  private readonly notificationsState = signal<AppNotification[]>([]);
  readonly notifications = this.notificationsState.asReadonly();

  private readonly unreadCountState = signal(0);
  readonly unreadCount = this.unreadCountState.asReadonly();

  private readonly loadingState = signal(false);
  readonly loading = this.loadingState.asReadonly();

  private readonly toastState = signal<AppNotification | null>(null);
  readonly toast = this.toastState.asReadonly();

  private readonly toastsEnabledState = signal(this.readToastPreference());
  readonly toastsEnabled = this.toastsEnabledState.asReadonly();

  // The badge never dips below zero and is capped so a big number cannot
  // break the layout.
  readonly visibleUnreadCount = computed(() =>
    Math.max(0, this.unreadCountState())
  );

  readonly badgeLabel = computed(() =>
    this.visibleUnreadCount() > 9 ? '9+' : String(this.visibleUnreadCount())
  );

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly shownToastIds = new Set<string>();

  private currentUserId(): string {
    const user = this.authService.getStoredUser();

    return user?.id ?? user?._id ?? '';
  }

  // ---- Socket.IO lifecycle -------------------------------------------------

  /**
   * Opens one socket for the signed-in user. Calling it again for the same
   * user is ignored, so the header cannot open a second connection.
   */
  connect(): void {
    const token = this.authService.getToken();
    const userId = this.currentUserId();

    if (!token || !userId) {
      return;
    }

    if (this.socket && this.socketUserId === userId) {
      return;
    }

    this.disconnect();

    this.socketUserId = userId;
    this.socket = io(this.socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on(NEW_NOTIFICATION_EVENT, (payload: AppNotification) => {
      this.handleIncoming(payload);
    });

    // Socket.IO reconnects on its own after a drop. The stored token is
    // re-read so an expired session stops retrying with a stale token.
    this.socket.on('reconnect_attempt', () => {
      const freshToken = this.authService.getToken();

      if (this.socket && freshToken) {
        this.socket.auth = { token: freshToken };
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socketUserId = null;
  }

  private handleIncoming(payload: AppNotification): void {
    if (!payload?._id) {
      return;
    }

    let isNewNotification = false;

    this.notificationsState.update((list) => {
      // A re-delivered event must not appear twice in the list.
      if (list.some((item) => item._id === payload._id)) {
        return list;
      }

      isNewNotification = true;

      return [payload, ...list];
    });

    if (!isNewNotification) {
      return;
    }

    if (!payload.read) {
      this.unreadCountState.update((count) => count + 1);
    }

    this.showToast(payload);
  }

  // ---- Toast ---------------------------------------------------------------

  private showToast(notification: AppNotification): void {
    if (
      !this.toastsEnabledState() ||
      this.shownToastIds.has(notification._id)
    ) {
      return;
    }

    this.shownToastIds.add(notification._id);
    this.toastState.set(notification);

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => this.dismissToast(), 6000);
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.toastState.set(null);
  }

  setToastsEnabled(enabled: boolean): void {
    this.toastsEnabledState.set(enabled);

    try {
      localStorage.setItem(TOAST_PREFERENCE_KEY, enabled ? 'true' : 'false');
    } catch {
      // Without storage the choice still applies for this session.
    }

    if (!enabled) {
      this.dismissToast();
    }
  }

  private readToastPreference(): boolean {
    try {
      return localStorage.getItem(TOAST_PREFERENCE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  // ---- REST API ------------------------------------------------------------

  /**
   * Loads the first page of notifications. Later calls are ignored unless
   * reload is true, so opening the bell repeatedly does not spam the API.
   */
  loadNotifications(reload = false): void {
    if (this.loadingState() || (!reload && this.notificationsState().length)) {
      return;
    }

    this.loadingState.set(true);

    this.http
      .get<NotificationListResponse>(this.apiUrl, {
        params: { page: 1, limit: 20 },
      })
      .subscribe({
        next: (response) => {
          this.notificationsState.set(response?.notifications ?? []);
          this.unreadCountState.set(Math.max(0, response?.unreadCount ?? 0));
          this.loadingState.set(false);
        },
        error: () => {
          this.loadingState.set(false);
        },
      });
  }

  markAsRead(notification: AppNotification): void {
    if (notification.read) {
      return;
    }

    this.http
      .patch<MarkReadResponse>(`${this.apiUrl}/${notification._id}/read`, {})
      .subscribe({
        next: (response) => {
          this.notificationsState.update((list) =>
            list.map((item) =>
              item._id === notification._id ? { ...item, read: true } : item
            )
          );

          this.unreadCountState.set(
            Math.max(0, response?.unreadCount ?? this.unreadCountState() - 1)
          );
        },
        error: () => {
          // Leave the state untouched so the user can try again.
        },
      });
  }

  markAllAsRead(): void {
    this.http
      .patch<MarkAllReadResponse>(`${this.apiUrl}/read-all`, {})
      .subscribe({
        next: () => {
          this.notificationsState.update((list) =>
            list.map((item) => (item.read ? item : { ...item, read: true }))
          );

          this.unreadCountState.set(0);
        },
        error: () => {
          // Leave the state untouched so the user can retry.
        },
      });
  }

  /**
   * Clears everything when the user signs out so private notifications are
   * never shown to the next person using the browser.
   */
  reset(): void {
    this.disconnect();
    this.dismissToast();
    this.notificationsState.set([]);
    this.unreadCountState.set(0);
    this.loadingState.set(false);
    this.shownToastIds.clear();
  }
}
