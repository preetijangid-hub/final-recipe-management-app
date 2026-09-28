import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { vi } from 'vitest';

import { ReviewSection } from './review-section';
import { SentimentService } from '../../services/sentiment';
import { ToxicityService } from '../../services/toxicity';
import { environment } from '../../../environments/environment';

describe('ReviewSection', () => {
  let httpTesting: HttpTestingController;

  const createComponent = () =>
    TestBed.createComponent(ReviewSection);

  // Each test creates its own section so that every HTTP request it
  // makes belongs to the test that flushes it.
  const createLoadedSection = () => {
    const sectionFixture = createComponent();
    sectionFixture.componentRef.setInput('recipeId', 'recipe-1');
    sectionFixture.componentRef.setInput('recipeOwnerId', '');
    sectionFixture.detectChanges();

    return sectionFixture;
  };

  const flushReviewRequests = () => {
    const reviewsRequest = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    reviewsRequest.flush({
      reviews: [
        {
          _id: 'review-1',
          recipe: 'recipe-1',
          user: { _id: 'user-1', name: 'Ana', role: 'user' },
          rating: 5,
          comment: 'Great recipe.',
          sentiment: 'Positive',
          createdAt: '2026-01-10T10:00:00.000Z',
          updatedAt: '2026-01-10T10:00:00.000Z',
        },
      ],
    });

    const summaryRequest = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews/summary`
    );

    summaryRequest.flush({ summary: { average: 5, count: 1 } });
  };

  beforeEach(async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'user-9', name: 'Tester', role: 'user' })
    );

    await TestBed.configureTestingModule({
      imports: [ReviewSection],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem('user');
    httpTesting.verify();
  });

  it('loads the reviews and the aggregated rating summary', () => {
    const fixture = createLoadedSection();
    flushReviewRequests();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Great recipe.');
    expect(compiled.textContent).toContain('Ana');
    expect(fixture.componentInstance.summary).toEqual({
      average: 5,
      count: 1,
    });
  });

  it('requires a star rating before submitting', () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    fixture.componentInstance.comment = 'Tasty!';
    fixture.componentInstance.submitReview();

    expect(fixture.componentInstance.submitError).toContain(
      'star rating'
    );
  });

  it('saves the text sentiment even with a 5-star rating', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockResolvedValue(
      false
    );
    const sentimentSpy = vi
      .spyOn(TestBed.inject(SentimentService), 'analyze')
      .mockResolvedValue('Negative');

    fixture.componentInstance.selectedRating = 5;
    fixture.componentInstance.comment = 'worst';

    const submission = fixture.componentInstance.submitReview();

    // Give the fake AI checks a moment before the request is asserted.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    expect(sentimentSpy).toHaveBeenCalledWith('worst');
    expect(request.request.body).toEqual({
      rating: 5,
      comment: 'worst',
      sentiment: 'Negative',
    });

    request.flush({
      message: 'Review created successfully',
      review: {
        _id: 'review-2',
        recipe: 'recipe-1',
        user: { _id: 'user-9', name: 'Tester', role: 'user' },
        rating: 5,
        comment: 'worst',
        sentiment: 'Negative',
        createdAt: '2026-01-11T10:00:00.000Z',
        updatedAt: '2026-01-11T10:00:00.000Z',
      },
      summary: { average: 5, count: 2 },
    });

    await submission;

    expect(fixture.componentInstance.submitError).toBe('');
    expect(fixture.componentInstance.reviews[0].sentiment).toBe(
      'Negative'
    );
  });

  it('saves the text sentiment even with a 1-star rating', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockResolvedValue(
      false
    );
    vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    ).mockResolvedValue('Positive');

    fixture.componentInstance.selectedRating = 1;
    fixture.componentInstance.comment = 'I loved this recipe';

    const submission = fixture.componentInstance.submitReview();

    await new Promise((resolve) => setTimeout(resolve, 0));

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    expect(request.request.body).toEqual({
      rating: 1,
      comment: 'I loved this recipe',
      sentiment: 'Positive',
    });

    request.flush({
      message: 'Review created successfully',
      review: {
        _id: 'review-3',
        recipe: 'recipe-1',
        user: { _id: 'user-9', name: 'Tester', role: 'user' },
        rating: 1,
        comment: 'I loved this recipe',
        sentiment: 'Positive',
        createdAt: '2026-01-11T10:00:00.000Z',
        updatedAt: '2026-01-11T10:00:00.000Z',
      },
      summary: { average: 3, count: 2 },
    });

    await submission;
  });

  it('lets a normal review pass moderation and submit', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockResolvedValue(
      false
    );
    vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    ).mockResolvedValue('Positive');

    fixture.componentInstance.selectedRating = 4;
    fixture.componentInstance.comment = 'Really tasty recipe!';

    const submission = fixture.componentInstance.submitReview();

    await new Promise((resolve) => setTimeout(resolve, 0));

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    expect(request.request.body).toEqual({
      rating: 4,
      comment: 'Really tasty recipe!',
      sentiment: 'Positive',
    });

    request.flush({
      message: 'Review created successfully',
      review: {
        _id: 'review-4',
        recipe: 'recipe-1',
        user: { _id: 'user-9', name: 'Tester', role: 'user' },
        rating: 4,
        comment: 'Really tasty recipe!',
        sentiment: 'Positive',
        createdAt: '2026-01-12T10:00:00.000Z',
        updatedAt: '2026-01-12T10:00:00.000Z',
      },
      summary: { average: 4.5, count: 2 },
    });

    await submission;

    expect(fixture.componentInstance.submitError).toBe('');
    expect(fixture.componentInstance.reviews.length).toBe(2);
  });

  it('blocks a toxic review without sending it to the API', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockResolvedValue(
      true
    );
    const sentimentSpy = vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    );

    fixture.componentInstance.selectedRating = 2;
    fixture.componentInstance.comment = 'you are all idiots';

    await fixture.componentInstance.submitReview();

    expect(fixture.componentInstance.submitError).toContain(
      'not submitted'
    );
    expect(fixture.componentInstance.reviews.length).toBe(1);
    expect(sentimentSpy).not.toHaveBeenCalled();
  });

  it('shows the checking state and prevents duplicate submissions', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    let resolveCheck!: (value: boolean | null) => void;
    const pendingCheck = new Promise<boolean | null>((resolve) => {
      resolveCheck = resolve;
    });

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockReturnValue(
      pendingCheck
    );
    vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    ).mockResolvedValue('Positive');

    fixture.componentInstance.selectedRating = 4;
    fixture.componentInstance.comment = 'Really tasty recipe!';

    const submission = fixture.componentInstance.submitReview();

    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.primary-btn'
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Checking review');

    // A second submit attempt while checking must not queue a request.
    fixture.componentInstance.submitReview();

    resolveCheck(false);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    request.flush({
      message: 'Review created successfully',
      review: {
        _id: 'review-5',
        recipe: 'recipe-1',
        user: { _id: 'user-9', name: 'Tester', role: 'user' },
        rating: 4,
        comment: 'Really tasty recipe!',
        sentiment: 'Positive',
        createdAt: '2026-01-12T10:00:00.000Z',
        updatedAt: '2026-01-12T10:00:00.000Z',
      },
      summary: { average: 4.5, count: 2 },
    });

    await submission;
  });

  it('does not submit the review when moderation is unavailable', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockResolvedValue(
      null
    );
    const sentimentSpy = vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    );

    fixture.componentInstance.selectedRating = 3;
    fixture.componentInstance.comment = 'Decent pasta, would make again.';

    await fixture.componentInstance.submitReview();

    // An unchecked review must not reach the API, and the user is told
    // to retry instead of the review silently posting.
    expect(fixture.componentInstance.aiNotice).toContain('unavailable');
    expect(fixture.componentInstance.aiNotice).toContain('try again');
    expect(sentimentSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.reviews.length).toBe(1);
    expect(fixture.componentInstance.submitting).toBe(false);
  });

  it('lets the user retry after moderation fails and submit when it works', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    const checkSpy = vi
      .spyOn(TestBed.inject(ToxicityService), 'check')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(false);
    vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    ).mockResolvedValue('Positive');

    fixture.componentInstance.selectedRating = 4;
    fixture.componentInstance.comment = 'Really tasty recipe!';

    // First attempt: moderation is unavailable, so nothing is submitted.
    await fixture.componentInstance.submitReview();

    expect(fixture.componentInstance.aiNotice).toContain('try again');
    expect(fixture.componentInstance.reviews.length).toBe(1);

    // Second attempt: moderation worked this time and the review goes out.
    const submission = fixture.componentInstance.submitReview();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(checkSpy).toHaveBeenCalledTimes(2);

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/recipes/recipe-1/reviews`
    );

    request.flush({
      message: 'Review created successfully',
      review: {
        _id: 'review-6',
        recipe: 'recipe-1',
        user: { _id: 'user-9', name: 'Tester', role: 'user' },
        rating: 4,
        comment: 'Really tasty recipe!',
        sentiment: 'Positive',
        createdAt: '2026-01-12T10:00:00.000Z',
        updatedAt: '2026-01-12T10:00:00.000Z',
      },
      summary: { average: 4.5, count: 2 },
    });

    await submission;

    expect(fixture.componentInstance.reviews.length).toBe(2);
  });

  it('does not submit when the moderation check throws unexpectedly', async () => {
    const fixture = createLoadedSection();
    flushReviewRequests();

    vi.spyOn(TestBed.inject(ToxicityService), 'check').mockRejectedValue(
      new Error('model crashed')
    );
    const sentimentSpy = vi.spyOn(
      TestBed.inject(SentimentService),
      'analyze'
    );

    fixture.componentInstance.selectedRating = 3;
    fixture.componentInstance.comment = 'Decent pasta, would make again.';

    await fixture.componentInstance.submitReview();

    expect(fixture.componentInstance.submitError).toContain('try again');
    expect(sentimentSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.reviews.length).toBe(1);
  });

  it('hides the delete action from users who cannot delete the review', () => {
    const fixture = createLoadedSection();
    flushReviewRequests();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      fixture.componentInstance.canDeleteReview(
        fixture.componentInstance.reviews[0]
      )
    ).toBe(false);
    expect(compiled.querySelector('.delete-review-btn')).toBeNull();
  });

  it('shows the delete action to the review author', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'user-1', name: 'Ana', role: 'user' })
    );

    const fixture = createLoadedSection();
    flushReviewRequests();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      fixture.componentInstance.canDeleteReview(
        fixture.componentInstance.reviews[0]
      )
    ).toBe(true);
    expect(compiled.querySelector('.delete-review-btn')).toBeTruthy();
  });

  it('shows the delete action to an admin', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'admin-1', name: 'Root', role: 'admin' })
    );

    const fixture = createLoadedSection();
    flushReviewRequests();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      fixture.componentInstance.canDeleteReview(
        fixture.componentInstance.reviews[0]
      )
    ).toBe(true);
    expect(compiled.querySelector('.delete-review-btn')).toBeTruthy();
  });

  it('deletes the own review and updates the summary', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'user-1', name: 'Ana', role: 'user' })
    );

    const fixture = createLoadedSection();
    flushReviewRequests();

    const targetReview = fixture.componentInstance.reviews[0];

    window.confirm = vi.fn(
      () => true
    ) as unknown as typeof window.confirm;

    const deletion =
      fixture.componentInstance.deleteReview(targetReview);

    httpTesting
      .expectOne(
        `${environment.apiBaseUrl}/recipes/recipe-1/reviews/review-1`
      )
      .flush({
        message: 'Review deleted successfully',
        summary: { average: 0, count: 0 },
      });

    await deletion;

    expect(fixture.componentInstance.reviews.length).toBe(0);
    expect(fixture.componentInstance.summary).toEqual({
      average: 0,
      count: 0,
    });
    expect(fixture.componentInstance.deletingReviewId).toBe('');
  });
});