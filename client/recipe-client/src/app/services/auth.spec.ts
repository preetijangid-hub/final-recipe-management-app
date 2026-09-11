import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  const loginResponse = {
    message: 'Login successful.',
    token: 'jwt-token-123',
    user: {
      _id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
    },
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('login posts the credentials and stores the session', () => {
    let response: object | null = null;

    service
      .login('test@example.com', 'Test@12345')
      .subscribe((result) => (response = result));

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/api/auth/login`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'test@example.com',
      password: 'Test@12345',
    });

    request.flush(loginResponse);

    expect(response).toEqual(loginResponse);
    expect(localStorage.getItem('token')).toBe('jwt-token-123');
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').name).toBe(
      'Test User'
    );
  });

  it('getCurrentUser loads the logged-in user from the me endpoint', () => {
    let response: object | null = null;

    service.getCurrentUser().subscribe((result) => (response = result));

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/api/auth/me`
    );

    expect(request.request.method).toBe('GET');

    request.flush({ user: loginResponse.user });

    expect(response).toEqual({ user: loginResponse.user });
  });

  it('isLoggedIn and logout reflect the stored token', () => {
    localStorage.setItem('token', 'jwt-token-123');
    expect(service.isLoggedIn()).toBe(true);

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
