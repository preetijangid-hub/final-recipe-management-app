import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ReviewService } from './review';
import { environment } from '../../environments/environment';

describe('ReviewService', () => {
  let service: ReviewService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(ReviewService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('getReviews fetches the reviews of a recipe', () => {
    service.getReviews('recipe-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    expect(request.request.method).toBe('GET');

    request.flush({ reviews: [] });
  });

  it('getRatingSummary fetches the aggregated summary', () => {
    service.getRatingSummary('recipe-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews/summary`
    );

    expect(request.request.method).toBe('GET');

    request.flush({ summary: { average: 4.5, count: 2 } });
  });

  it('createReview posts the rating, comment and sentiment', () => {
    service
      .createReview('recipe-1', {
        rating: 4,
        comment: 'Really tasty.',
        sentiment: 'Positive',
      })
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body.rating).toBe(4);
    expect(request.request.body.comment).toBe('Really tasty.');
    expect(request.request.body.sentiment).toBe('Positive');

    request.flush({
      message: 'Review created successfully',
      review: { _id: 'review-1' },
      summary: { average: 4, count: 1 },
    });
  });

  it('deleteReview sends a DELETE to the review URL', () => {
    service.deleteReview('recipe-1', 'review-9').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews/review-9`
    );

    expect(request.request.method).toBe('DELETE');

    request.flush({
      message: 'Review deleted successfully',
      summary: { average: 0, count: 0 },
    });
  });
});