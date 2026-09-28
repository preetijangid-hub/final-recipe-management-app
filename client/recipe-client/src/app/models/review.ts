export type Sentiment = 'Positive' | 'Neutral' | 'Negative' | 'Unknown';

export interface Review {
  _id: string;
  recipe: string;
  user: {
    _id: string;
    name: string;
    role?: 'user' | 'admin';
  };
  rating: number;
  comment: string;
  sentiment: Sentiment;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListResponse {
  reviews: Review[];
}

export interface ReviewSummary {
  average: number;
  count: number;
}

export interface ReviewSummaryResponse {
  summary: ReviewSummary;
}

export interface CreateReviewPayload {
  rating: number;
  comment: string;
  sentiment: Sentiment;
}

export interface CreateReviewResponse {
  message: string;
  review: Review;
  summary: ReviewSummary;
}

export interface DeleteReviewResponse {
  message: string;
  summary: ReviewSummary;
}