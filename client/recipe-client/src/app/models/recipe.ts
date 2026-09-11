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