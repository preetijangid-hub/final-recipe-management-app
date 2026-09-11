import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { provideRouter } from '@angular/router';

import { authGuard, publicGuard } from './auth-guard';

const route = {} as ActivatedRouteSnapshot;
const state = { url: '/dashboard' } as RouterStateSnapshot;

describe('authGuard', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('redirects anonymous visitors to the login page', () => {
    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/login');
  });

  it('allows navigation when a token is stored', () => {
    localStorage.setItem('token', 'test-token');

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
  });
});

describe('publicGuard', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('allows anonymous visitors to open public pages', () => {
    const result = TestBed.runInInjectionContext(() =>
      publicGuard(route, state)
    );

    expect(result).toBe(true);
  });

  it('redirects logged-in users to the dashboard', () => {
    localStorage.setItem('token', 'test-token');

    const result = TestBed.runInInjectionContext(() =>
      publicGuard(route, state)
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/dashboard');
  });
});
