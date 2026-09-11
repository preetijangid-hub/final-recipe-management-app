import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CategoryDeleteResponse,
  CategoryListResponse,
  CategoryMutationResponse,
} from '../models/category';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiBaseUrl}/categories`;

  getCategories(): Observable<CategoryListResponse> {
    return this.http.get<CategoryListResponse>(this.apiUrl);
  }

  createCategory(name: string): Observable<CategoryMutationResponse> {
    return this.http.post<CategoryMutationResponse>(this.apiUrl, { name });
  }

  updateCategory(id: string, name: string): Observable<CategoryMutationResponse> {
    return this.http.put<CategoryMutationResponse>(
      `${this.apiUrl}/${id}`,
      { name }
    );
  }

  deleteCategory(id: string): Observable<CategoryDeleteResponse> {
    return this.http.delete<CategoryDeleteResponse>(`${this.apiUrl}/${id}`);
  }
}