import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CollectionDetailResponse,
  CollectionListResponse,
  CollectionMutationResponse,
  CollectionUpdateResponse,
  CreateCollectionDetails,
  CreateCollectionResponse,
  SharedCollectionResponse,
} from '../models/collection';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CollectionService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiBaseUrl}/collections`;

  // Public share links live outside the authenticated collection routes.
  private readonly publicUrl =
    `${environment.apiBaseUrl}/public/collections`;

  getMyCollections(
    page = 1,
    limit = 9
  ): Observable<CollectionListResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);

    return this.http.get<CollectionListResponse>(
      this.apiUrl,
      { params }
    );
  }

  getCollectionById(
    id: string
  ): Observable<CollectionDetailResponse> {
    return this.http.get<CollectionDetailResponse>(
      `${this.apiUrl}/${id}`
    );
  }

  createCollection(
    name: string,
    details: CreateCollectionDetails = {}
  ): Observable<CreateCollectionResponse> {
    return this.http.post<CreateCollectionResponse>(
      this.apiUrl,
      {
        name,
        description: details.description ?? '',
        coverImage: details.coverImage ?? '',
      }
    );
  }

  updateCoverImage(
    collectionId: string,
    coverImage: string
  ): Observable<CollectionUpdateResponse> {
    return this.http.patch<CollectionUpdateResponse>(
      `${this.apiUrl}/${collectionId}/cover`,
      { coverImage }
    );
  }

  // Switches public sharing on. The collection stays private until the
  // owner calls this.
  enableSharing(
    collectionId: string
  ): Observable<CollectionUpdateResponse> {
    return this.http.post<CollectionUpdateResponse>(
      `${this.apiUrl}/${collectionId}/share`,
      {}
    );
  }

  // Replaces the token, which invalidates the previous link.
  regenerateShareLink(
    collectionId: string
  ): Observable<CollectionUpdateResponse> {
    return this.http.post<CollectionUpdateResponse>(
      `${this.apiUrl}/${collectionId}/share/regenerate`,
      {}
    );
  }

  disableSharing(
    collectionId: string
  ): Observable<CollectionUpdateResponse> {
    return this.http.delete<CollectionUpdateResponse>(
      `${this.apiUrl}/${collectionId}/share`
    );
  }

  // Used by the public page, which is opened without a login.
  getSharedCollection(
    token: string
  ): Observable<SharedCollectionResponse> {
    return this.http.get<SharedCollectionResponse>(
      `${this.publicUrl}/${token}`
    );
  }

  addRecipe(
    collectionId: string,
    recipeId: string
  ): Observable<CollectionMutationResponse> {
    return this.http.post<CollectionMutationResponse>(
      `${this.apiUrl}/${collectionId}/recipes`,
      { recipeId }
    );
  }

  removeRecipe(
    collectionId: string,
    recipeId: string
  ): Observable<CollectionMutationResponse> {
    return this.http.delete<CollectionMutationResponse>(
      `${this.apiUrl}/${collectionId}/recipes/${recipeId}`
    );
  }
}
