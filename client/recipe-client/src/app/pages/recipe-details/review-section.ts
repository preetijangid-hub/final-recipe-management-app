import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { Review } from '../../models/review';
import { Sentiment } from '../../models/review';
import { AuthService } from '../../services/auth';
import { ReviewService } from '../../services/review';
import { SentimentService } from '../../services/sentiment';
import { ToxicityService } from '../../services/toxicity';

@Component({
  selector: 'app-review-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-section.html',
  styleUrl: './review-section.css',
})
export class ReviewSection implements OnInit {
  @Input({ required: true }) recipeId!: string;

  @Input() recipeOwnerId = '';

  private readonly reviewService = inject(ReviewService);
  private readonly authService = inject(AuthService);
  private readonly sentimentService = inject(SentimentService);
  private readonly toxicityService = inject(ToxicityService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly currentUser = this.authService.getStoredUser();

  readonly starValues = [1, 2, 3, 4, 5];

  reviews: Review[] = [];

  summary = { average: 0, count: 0 };

  loadingReviews = true;

  loadError = '';

  selectedRating = 0;

  hoverRating = 0;

  comment = '';

  submitting = false;

  checkingReview = false;

  submitError = '';

  aiNotice = '';

  sentimentPreview: Sentiment | null = null;

  deletingReviewId = '';

  deleteError = '';

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.loadingReviews = true;
    this.loadError = '';

    forkJoin({
      reviews: this.reviewService.getReviews(this.recipeId),
      summary: this.reviewService.getRatingSummary(this.recipeId),
    })
      .pipe(
        catchError(() => {
          this.loadError = 'Unable to load the reviews right now.';

          return of(null);
        }),
        finalize(() => {
          this.loadingReviews = false;
          this.changeDetector.detectChanges();
        })
      )
      .subscribe((result) => {
        if (result) {
          this.reviews = result.reviews.reviews;
          this.summary = result.summary.summary;
        }
      });
  }

  get myReview(): Review | null {
    const currentUser = this.currentUser;

    if (!currentUser) {
      return null;
    }

    return (
      this.reviews.find(
        (review) => review.user._id === currentUser._id
      ) ?? null
    );
  }

  selectRating(value: number): void {
    this.selectedRating = value;
  }

  async submitReview(): Promise<void> {
    if (this.submitting) {
      return;
    }

    if (!this.selectedRating) {
      this.submitError = 'Please select a star rating first.';

      return;
    }

    if (this.comment.trim().length < 3) {
      this.submitError =
        'Please write a short review (at least 3 characters).';

      return;
    }

    this.submitting = true;
    this.checkingReview = true;
    this.submitError = '';
    this.aiNotice = '';
    this.sentimentPreview = null;
    this.changeDetector.detectChanges();

    try {
      const toxic = await this.toxicityService.check(this.comment);

      if (toxic === true) {
        this.submitError =
          'This review was flagged as inappropriate and was not submitted. Please rewrite it in a friendlier tone.';

        return;
      }

      if (toxic === null) {
        this.aiNotice =
          'AI moderation is temporarily unavailable, so this review was not checked. Please try again.';

        return;
      }

      this.checkingReview = false;
      this.changeDetector.detectChanges();

      const sentiment = await this.sentimentService.analyze(this.comment);

      this.sentimentPreview = sentiment;

      const response = await firstValueFrom(
        this.reviewService.createReview(this.recipeId, {
          rating: this.selectedRating,
          comment: this.comment.trim(),
          sentiment,
        })
      );

      this.reviews = [response.review, ...this.reviews];
      this.summary = response.summary;
      this.selectedRating = 0;
      this.comment = '';
      this.sentimentPreview = null;
    } catch (error: any) {
      this.submitError =
        error?.error?.message ||
        'Unable to submit your review. Please try again.';
    } finally {
      this.submitting = false;
      this.checkingReview = false;
      this.changeDetector.detectChanges();
    }
  }

  // The auth API stores the user id under "id", while reviews and recipe
  // owners expose it as "_id", so both fields have to be checked here.
  getCurrentUserId(): string {
    const currentUser = this.currentUser;

    if (!currentUser) {
      return '';
    }

    return currentUser.id ?? currentUser._id ?? '';
  }

  canDeleteReview(review: Review): boolean {
    const currentUserId = this.getCurrentUserId();

    if (!this.currentUser || !currentUserId) {
      return false;
    }

    if (this.currentUser.role === 'admin') {
      return true;
    }

    if (review.user._id === currentUserId) {
      return true;
    }

    return (
      !!this.recipeOwnerId &&
      this.recipeOwnerId === currentUserId
    );
  }

  async deleteReview(review: Review): Promise<void> {
    if (!window.confirm('Delete this review?')) {
      return;
    }

    this.deletingReviewId = review._id;
    this.deleteError = '';
    this.changeDetector.detectChanges();

    try {
      const response = await firstValueFrom(
        this.reviewService.deleteReview(this.recipeId, review._id)
      );

      this.reviews = this.reviews.filter(
        (item) => item._id !== review._id
      );

      this.summary = response.summary;
    } catch (error: any) {
      this.deleteError =
        error?.error?.message || 'Unable to delete this review.';
    } finally {
      this.deletingReviewId = '';
      this.changeDetector.detectChanges();
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}