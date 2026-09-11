import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CompatibilityResponse,
  OrderResponse,
  RateResponse,
  Recipe,
  RecipeListResponse,
  RecipeStatsResponse,
} from '../models/recipe';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiBaseUrl}/recipes`;

  getRecipes(
    page = 1,
    limit = 10,
    search = '',
    category = '',
    sort = 'newest',
    mealCategory = ''
  ): Observable<RecipeListResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit)
      .set('sort', sort);

    if (search.trim()) {
      params = params.set(
        'search',
        search.trim()
      );
    }

    if (category.trim()) {
      params = params.set(
        'category',
        category.trim()
      );
    }

    if (mealCategory.trim()) {
      params = params.set(
        'mealCategory',
        mealCategory.trim()
      );
    }

    return this.http.get<RecipeListResponse>(
      this.apiUrl,
      { params }
    );
  }

  getRecipeById(
    id: string
  ): Observable<{ recipe: Recipe }> {
    return this.http.get<{ recipe: Recipe }>(
      `${this.apiUrl}/${id}`
    );
  }

  getRecipeStats(): Observable<RecipeStatsResponse> {
    return this.http.get<RecipeStatsResponse>(
      `${this.apiUrl}/stats`
    );
  }

  getMyRecipes(): Observable<{ recipes: Recipe[] }> {
    return this.http.get<{ recipes: Recipe[] }>(
      `${this.apiUrl}/mine`
    );
  }

  getRecipeCompatibility(
    id: string
  ): Observable<CompatibilityResponse> {
    return this.http.get<CompatibilityResponse>(
      `${this.apiUrl}/${id}/compatibility`
    );
  }

  createRecipe(
    recipe: {
      title: string;
      ingredients: string[];
      steps: string[];
      category: string;
      mealCategory: string;
      image?: string;
      spiceLevel?: string;
      sweetnessLevel?: string;
    }
  ): Observable<{ recipe: Recipe }> {
    return this.http.post<{ recipe: Recipe }>(
      this.apiUrl,
      recipe
    );
  }

  updateRecipe(
    id: string,
    recipe: {
      title: string;
      ingredients: string[];
      steps: string[];
      category: string;
      mealCategory: string;
      image?: string;
      spiceLevel?: string;
      sweetnessLevel?: string;
    }
  ): Observable<{ recipe: Recipe }> {
    return this.http.put<{ recipe: Recipe }>(
      `${this.apiUrl}/${id}`,
      recipe
    );
  }

  deleteRecipe(
    id: string
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${id}`
    );
  }

  rateRecipe(
    id: string,
    value: number
  ): Observable<RateResponse> {
    return this.http.post<RateResponse>(
      `${this.apiUrl}/${id}/rating`,
      { value }
    );
  }

  orderRecipe(id: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(
      `${this.apiUrl}/${id}/order`,
      {}
    );
  }

  parseAssistant(message: string): Observable<{
    reply: string;
    preferences: any;
    matches: Array<{
      recipeId: string;
      title: string;
      level: string;
      reasons: string[];
      spiceLevel?: string;
      sweetnessLevel?: string;
    }>;
  }> {
    return this.http.post<any>(
      `${environment.apiBaseUrl}/assistant/chat`,
      { message }
    );
  }

  getPreferences(): Observable<{ preferences: any }> {
    return this.http.get<{ preferences: any }>(
      `${environment.apiBaseUrl}/preferences`
    );
  }

  updatePreferences(payload: any): Observable<{ preferences: any; message: string }> {
    return this.http.put<{ preferences: any; message: string }>(
      `${environment.apiBaseUrl}/preferences`,
      payload
    );
  }
}