import { Recipe } from './recipe';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanEntry {
  _id: string;
  user?: string;
  date: string;
  mealType: MealType;
  servings: number;
  /** Serving count per recipe id, so recipes sharing a slot stay independent. */
  servingsByRecipe?: Record<string, number>;
  recipe?: Recipe | null;
  recipes?: Recipe[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MealPlansResponse {
  weekStart: string;
  weekEnd: string;
  mealPlans: MealPlanEntry[];
  weekdayNames: string[];
  mealTypes: MealType[];
}

export interface SaveMealPlanRequest {
  date: string;
  mealType: MealType;
  recipe: string;
  servings?: number;
}
