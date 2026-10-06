import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  ProfileResponse,
  ProfileUpdateResponse,
  PublicProfileResponse,
} from '../models/user';
import { Recipe } from '../models/recipe';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiBaseUrl}/profiles`;

  getMyProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiUrl}/me`);
  }

  // Only profession and profilePhoto are editable; an empty photo string
  // clears the saved photo.
  updateMyProfile(
    profilePhoto: string,
    profession: string
  ): Observable<ProfileUpdateResponse> {
    return this.http.patch<ProfileUpdateResponse>(`${this.apiUrl}/me`, {
      profilePhoto,
      profession,
    });
  }

  // Public reads. The auth interceptor still runs, but these endpoints do
  // not require a token, so the creator pages work without logging in.
  getPublicProfile(userId: string): Observable<PublicProfileResponse> {
    return this.http.get<PublicProfileResponse>(`${this.apiUrl}/${userId}`);
  }

  getCreatorRecipes(userId: string): Observable<{ recipes: Recipe[] }> {
    return this.http.get<{ recipes: Recipe[] }>(
      `${this.apiUrl}/${userId}/recipes`
    );
  }
}