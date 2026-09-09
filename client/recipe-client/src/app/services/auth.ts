import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { AuthResponse } from '../models/auth-response';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:5000/api/auth';

  private readonly tokenKey = 'token';
  private readonly userKey = 'user';

  register(
    name: string,
    email: string,
    password: string
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/register`,
        {
          name,
          email,
          password,
        }
      )
      .pipe(
        tap((response) => {
          this.saveAuthData(response);
        })
      );
  }

  login(
    email: string,
    password: string
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/login`,
        {
          email,
          password,
        }
      )
      .pipe(
        tap((response) => {
          this.saveAuthData(response);
        })
      );
  }

  getCurrentUser(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(
      `${this.apiUrl}/me`
    );
  }

  getToken(): string | null {
    return localStorage.getItem(
      this.tokenKey
    );
  }

  getStoredUser(): User | null {
    const user =
      localStorage.getItem(this.userKey);

    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user) as User;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return (
      this.getStoredUser()?.role === 'admin'
    );
  }

  logout(): void {
    localStorage.removeItem(
      this.tokenKey
    );

    localStorage.removeItem(
      this.userKey
    );
  }

  private saveAuthData(
    response: AuthResponse
  ): void {
    localStorage.setItem(
      this.tokenKey,
      response.token
    );

    localStorage.setItem(
      this.userKey,
      JSON.stringify(response.user)
    );
  }
}