import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CreateReviewPayload,
  CreateReviewResponse,
  DeleteReviewResponse,
  ReviewListResponse,
  ReviewSummaryResponse,
} from '../models/review';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiBaseUrl}/recipes`;

  getReviews(recipeId: string): Observable<ReviewListResponse> {
    return this.http.get<ReviewListResponse>(
      `${this.apiUrl}/${recipeId}/reviews`
    );
  }

  getRatingSummary(
    recipeId: string
  ): Observable<ReviewSummaryResponse> {
    return this.http.get<ReviewSummaryResponse>(
      `${this.apiUrl}/${recipeId}/reviews/summary`
    );
  }

  createReview(
    recipeId: string,
    payload: CreateReviewPayload
  ): Observable<CreateReviewResponse> {
    return this.http.post<CreateReviewResponse>(
      `${this.apiUrl}/${recipeId}/reviews`,
      payload
    );
  }

  deleteReview(
    recipeId: string,
    reviewId: string
  ): Observable<DeleteReviewResponse> {
    return this.http.delete<DeleteReviewResponse>(
      `${this.apiUrl}/${recipeId}/reviews/${reviewId}`
    );
  }
}