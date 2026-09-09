import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Recipe,
  RecipeListResponse,
} from '../models/recipe';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:5000/api/recipes';

  getRecipes(
    page = 1,
    limit = 10,
    search = '',
    category = ''
  ): Observable<RecipeListResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);

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

  createRecipe(
    recipe: {
      title: string;
      ingredients: string[];
      steps: string[];
      category: string;
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
}