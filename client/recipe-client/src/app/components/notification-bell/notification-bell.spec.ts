import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { NotificationBell } from './notification-bell';
import { NotificationService } from '../../services/notification';
import { AppNotification } from '../../models/notification';

describe('NotificationBell', () => {
  const notificationsSignal = signal<AppNotification[]>([]);
  const unreadSignal = signal(0);
  const loadingSignal = signal(false);
  const toastSignal = signal<AppNotification | null>(null);
  const toastsEnabledSignal = signal(true);

  const notificationServiceMock = {
    notifications: notificationsSignal.asReadonly(),
    visibleUnreadCount: computed(() => Math.max(0, unreadSignal())),
    badgeLabel: computed(() => {
      const count = Math.max(0, unreadSignal());

      return count > 9 ? '9+' : String(count);
    }),
    loading: loadingSignal.asReadonly(),
    toast: toastSignal.asReadonly(),
    toastsEnabled: toastsEnabledSignal.asReadonly(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    loadNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    setToastsEnabled: vi.fn((enabled: boolean) =>
      toastsEnabledSignal.set(enabled)
    ),
    dismissToast: vi.fn(() => toastSignal.set(null)),
  };

  const routerMock = {
    navigate: vi.fn(() => Promise.resolve(true)),
  };

  const sampleNotification: AppNotification = {
    _id: 'notification-1',
    type: 'review',
    read: false,
    message: 'Sam reviewed "Pasta"',
    createdAt: new Date().toISOString(),
    actor: { _id: 'user-2', name: 'Sam' },
    recipe: { _id: 'recipe-1', title: 'Pasta' },
  };

  let fixture: ComponentFixture<NotificationBell>;

  const openPanel = (): void => {
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.bell-button'
    ) as HTMLButtonElement;

    button.click();

    fixture.detectChanges();
  };

  beforeEach(async () => {
    notificationsSignal.set([]);
    unreadSignal.set(0);
    loadingSignal.set(false);
    toastSignal.set(null);
    toastsEnabledSignal.set(true);

    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationBell);
  });

  it('connects the socket and loads notifications on init', () => {
    fixture.detectChanges();

    expect(notificationServiceMock.connect).toHaveBeenCalled();
    expect(notificationServiceMock.loadNotifications).toHaveBeenCalled();
  });

  // Socket cleanup on logout: the header is removed, so the bell is
  // destroyed and its socket has to be closed.
  it('disconnects the socket when destroyed', () => {
    fixture.detectChanges();

    fixture.destroy();

    expect(notificationServiceMock.disconnect).toHaveBeenCalled();
  });

  it('shows the unread count on the badge', () => {
    unreadSignal.set(3);

    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.bell-badge');

    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('3');
  });

  it('caps a large unread count at 9+', () => {
    unreadSignal.set(15);

    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.bell-badge');

    expect(badge.textContent.trim()).toBe('9+');
  });

  it('never shows a negative count and hides the badge at zero', () => {
    unreadSignal.set(-4);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bell-badge')).toBeNull();
  });

  it('opens the dropdown and shows the empty state when there is nothing to read', () => {
    openPanel();

    expect(fixture.nativeElement.querySelector('.bell-panel')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bell-empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bell-list')).toBeNull();
  });

  it('lists the notifications with actor, recipe and time', () => {
    notificationsSignal.set([sampleNotification]);

    openPanel();

    const items = fixture.nativeElement.querySelectorAll('.bell-item');

    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Sam reviewed');
    expect(items[0].textContent).toContain('Pasta');
    expect(items[0].classList.contains('unread')).toBe(true);
  });

  it('navigates to the recipe and marks it read when clicked', () => {
    notificationsSignal.set([sampleNotification]);

    openPanel();

    const item = fixture.nativeElement.querySelector(
      '.bell-item'
    ) as HTMLElement;

    item.click();

    fixture.detectChanges();

    expect(notificationServiceMock.markAsRead).toHaveBeenCalledWith(
      sampleNotification
    );
    expect(routerMock.navigate).toHaveBeenCalledWith(['/recipes', 'recipe-1']);

    // The panel closes after opening a notification.
    expect(fixture.nativeElement.querySelector('.bell-panel')).toBeNull();
  });

  it('marks all notifications as read from the dropdown', () => {
    unreadSignal.set(2);
    notificationsSignal.set([sampleNotification]);

    openPanel();

    const markAll = fixture.nativeElement.querySelector(
      '.mark-all-button'
    ) as HTMLButtonElement;

    expect(markAll).toBeTruthy();

    markAll.click();

    expect(notificationServiceMock.markAllAsRead).toHaveBeenCalled();
  });

  it('hides the mark all action when nothing is unread', () => {
    unreadSignal.set(0);

    openPanel();

    expect(fixture.nativeElement.querySelector('.mark-all-button')).toBeNull();
  });

  it('shows a toast for a new notification and dismisses it', () => {
    toastSignal.set(sampleNotification);

    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.notification-toast');

    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Sam reviewed');

    const close = toast.querySelector('.toast-close') as HTMLButtonElement;

    close.click();

    expect(notificationServiceMock.dismissToast).toHaveBeenCalled();
  });

  it('navigates to the recipe when the toast is clicked', () => {
    toastSignal.set(sampleNotification);

    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector(
      '.notification-toast'
    ) as HTMLElement;

    toast.click();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/recipes', 'recipe-1']);
  });

  it('toggles the toast alerts preference', () => {
    openPanel();

    const preference = fixture.nativeElement.querySelector(
      '.bell-preference'
    ) as HTMLButtonElement;

    preference.click();

    expect(notificationServiceMock.setToastsEnabled).toHaveBeenCalledWith(
      false
    );
  });
});
