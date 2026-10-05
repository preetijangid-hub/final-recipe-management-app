import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { MealPlanEntry, MealPlansResponse, SaveMealPlanRequest } from '../models/meal-plan';

@Injectable({
  providedIn: 'root',
})
export class MealPlanService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiBaseUrl}/meal-plans`;

  getWeekPlan(weekStart: string): Observable<MealPlansResponse> {
    return this.http.get<MealPlansResponse>(this.apiUrl, {
      params: { weekStart },
    });
  }

  saveMealPlan(payload: SaveMealPlanRequest): Observable<{ message: string; mealPlan: MealPlanEntry }> {
    return this.http.post<{ message: string; mealPlan: MealPlanEntry }>(this.apiUrl, payload);
  }

  removeRecipeFromMealPlan(
    id: string,
    recipeId: string,
  ): Observable<{ message: string; emptied: boolean; mealPlan: MealPlanEntry | null }> {
    return this.http.delete<{ message: string; emptied: boolean; mealPlan: MealPlanEntry | null }>(
      `${this.apiUrl}/${id}/recipes/${recipeId}`,
    );
  }

  removeMealPlan(id: string): Observable<{ message: string; id: string }> {
    return this.http.delete<{ message: string; id: string }>(`${this.apiUrl}/${id}`);
  }
}
