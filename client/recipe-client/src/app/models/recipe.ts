export interface RatingSummary {
  average: number;
  count: number;
  mine: number | null;
}

export const CUISINES = [
  'Indian',
  'Italian',
  'Mexican',
  'Thai',
  'Chinese',
  'Japanese',
  'Korean',
  'French',
  'American',
  'Mediterranean',
];

export const MEAL_CATEGORIES = [
  'Breakfast',
  'Brunch',
  'Lunch',
  'Dinner',
  'Dessert',
  'Snacks',
  'Mocktails',
  'Drinks',
];

export interface Recipe {
  _id: string;
  title: string;
  description?: string;
  cookingTime?: number | null;
  ingredients: string[];
  steps: string[];
  category: string;
  mealCategory: string;
  image?: string;
  spiceLevel?: string;
  sweetnessLevel?: string;
  user: string | {
    _id: string;
    name: string;
    email: string;
    role?: 'user' | 'admin';
  };
  orderCount?: number;
  rating?: RatingSummary;
  createdAt?: string;
  updatedAt?: string;
}

// Extra values the filters of the smart search bar can send to the API.
export interface RecipeSearchFilters {
  ingredients?: string[];
  maxCookingTime?: number | null;
  minRating?: number | null;
}

// The weekly activity attached to a recipe of the Trending This Week list.
export interface RecipeWeeklyStats {
  reviews: number;
  averageRating: number;
  lastReviewAt: string;
}

export interface TrendingRecipe extends Recipe {
  weekly: RecipeWeeklyStats;
}

export interface TrendingResponse {
  trending: TrendingRecipe[];
  weekStart: string;
  weekEnd: string;
}

export const SORT_CHOICES = [
  { value: 'newest', label: 'Newest first' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'reviewed', label: 'Most reviewed' },
  { value: 'cookingTimeAsc', label: 'Cooking time: low to high' },
  { value: 'cookingTimeDesc', label: 'Cooking time: high to low' },
  { value: 'popular', label: 'Most cooked' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A to Z' },
] as const;

// Options for the "under X minutes" filter.
export const COOKING_TIME_CHOICES = [15, 30, 45, 60, 90, 120];

export const MIN_RATING_CHOICES = [3, 4, 4.5];

export interface RecipeListResponse {
  recipes: Recipe[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RecipeStatsResponse {
  totals: {
    recipes: number;
    orders: number;
    averageRating: number;
    mine: number;
  };
  mostOrdered: Recipe[];
  highestRated: Recipe[];
  trending: Recipe[];
  spicyFavorites: Recipe[];
  sweetFavorites: Recipe[];
  recentlyAdded: Recipe[];
}

export interface CompatibilityResponse {
  compatibility: {
    level: 'good' | 'match' | 'caution' | 'conflict';
    reasons: string[];
  };
}

export interface RateResponse {
  message: string;
  rating: RatingSummary;
}

export interface OrderResponse {
  message: string;
  orderCount: number;
} 