import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { vi } from 'vitest';

// Captured socket event handlers, keyed by event name.
const socketHandlers = new Map<string, (...args: unknown[]) => void>();

const socketMock = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers.set(event, handler);
  }),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
  auth: {} as Record<string, unknown>,
  connected: true,
};

const { ioMock } = vi.hoisted(() => ({ ioMock: vi.fn() }));

// The real socket opens a network connection, so the packaged client is
// replaced with the stand-in above.
vi.mock('socket.io-client', () => ({ io: ioMock }));

import { NotificationService } from './notification';
import { AppNotification } from '../models/notification';
import { environment } from '../../environments/environment';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpTesting: HttpTestingController;

  const notificationsUrl = `${environment.apiBaseUrl}/notifications`;
  const socketUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '');

  const owner = {
    _id: 'user-1',
    id: 'user-1',
    name: 'Owner',
    email: 'owner@example.com',
    role: 'user',
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

  const emitNotification = (payload: AppNotification): void => {
    const handler = socketHandlers.get('notification:new');

    expect(handler).toBeTruthy();

    handler?.(payload);
  };

  beforeEach(async () => {
    socketHandlers.clear();

    ioMock.mockReset();
    ioMock.mockReturnValue(socketMock);

    socketMock.on.mockClear();
    socketMock.disconnect.mockClear();
    socketMock.removeAllListeners.mockClear();

    localStorage.clear();
    localStorage.setItem('token', 'jwt-token-123');
    localStorage.setItem('user', JSON.stringify(owner));

    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(NotificationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Also clears the toast timer.
    service.reset();
    httpTesting.verify();
    localStorage.clear();
  });

  it('connects to the socket with the stored JWT token', () => {
    service.connect();

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock.mock.calls[0][0]).toBe(socketUrl);
    expect(ioMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ auth: { token: 'jwt-token-123' } })
    );
  });

  it('does not open a second socket for the same user', () => {
    service.connect();
    service.connect();

    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('receives a socket notification and updates list and unread count', () => {
    service.connect();

    emitNotification(sampleNotification);

    expect(service.notifications()).toHaveLength(1);
    expect(service.unreadCount()).toBe(1);
    expect(service.toast()?._id).toBe('notification-1');
  });

  it('ignores a duplicate socket notification', () => {
    service.connect();

    emitNotification(sampleNotification);
    emitNotification(sampleNotification);

    expect(service.notifications()).toHaveLength(1);
    expect(service.unreadCount()).toBe(1);
  });

  it('loads notifications and the unread count from the API', () => {
    service.loadNotifications();

    const request = httpTesting.expectOne((req) => req.url === notificationsUrl);
    expect(request.request.method).toBe('GET');

    request.flush({
      notifications: [sampleNotification],
      unreadCount: 3,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(service.notifications()).toHaveLength(1);
    expect(service.unreadCount()).toBe(3);
  });

  it('marks one notification as read and updates the count', () => {
    service.loadNotifications();
    httpTesting.expectOne((req) => req.url === notificationsUrl).flush({
      notifications: [sampleNotification],
      unreadCount: 1,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(service.unreadCount()).toBe(1);

    service.markAsRead(sampleNotification);

    const request = httpTesting.expectOne(
      `${notificationsUrl}/notification-1/read`
    );
    expect(request.request.method).toBe('PATCH');

    request.flush({
      message: 'Notification marked as read.',
      notification: { ...sampleNotification, read: true },
      unreadCount: 0,
    });

    expect(service.unreadCount()).toBe(0);
    expect(service.notifications()[0].read).toBe(true);
  });

  it('marks all notifications as read', () => {
    service.loadNotifications();
    httpTesting.expectOne((req) => req.url === notificationsUrl).flush({
      notifications: [
        sampleNotification,
        { ...sampleNotification, _id: 'notification-2' },
      ],
      unreadCount: 2,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    expect(service.unreadCount()).toBe(2);

    service.markAllAsRead();

    const request = httpTesting.expectOne(`${notificationsUrl}/read-all`);
    expect(request.request.method).toBe('PATCH');

    request.flush({
      message: 'All notifications marked as read.',
      modifiedCount: 2,
      unreadCount: 0,
    });

    expect(service.unreadCount()).toBe(0);
    expect(service.notifications().every((item) => item.read)).toBe(true);
  });

  it('caps the badge at 9+ and never shows a negative count', () => {
    service.loadNotifications();
    httpTesting.expectOne((req) => req.url === notificationsUrl).flush({
      notifications: [],
      unreadCount: 12,
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    expect(service.badgeLabel()).toBe('9+');

    service.loadNotifications(true);
    httpTesting.expectOne((req) => req.url === notificationsUrl).flush({
      notifications: [],
      unreadCount: -5,
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    expect(service.visibleUnreadCount()).toBe(0);
    expect(service.badgeLabel()).toBe('0');
  });

  it('tracks the bell without toasting when alerts are switched off', () => {
    service.setToastsEnabled(false);

    expect(localStorage.getItem('savore.toasts.enabled')).toBe('false');

    service.connect();
    emitNotification(sampleNotification);

    expect(service.toast()).toBeNull();
    expect(service.notifications()).toHaveLength(1);
    expect(service.unreadCount()).toBe(1);
  });

  it('disconnects and clears all state on logout', () => {
    service.connect();
    emitNotification(sampleNotification);

    expect(service.unreadCount()).toBe(1);

    service.reset();

    expect(socketMock.removeAllListeners).toHaveBeenCalled();
    expect(socketMock.disconnect).toHaveBeenCalled();
    expect(service.notifications()).toHaveLength(0);
    expect(service.unreadCount()).toBe(0);
    expect(service.toast()).toBeNull();
  });
});
