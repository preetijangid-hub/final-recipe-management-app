import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ShoppingListDocument,
  ShoppingListResponse,
  ShoppingListUpdateResponse,
} from '../models/shopping-list';

@Injectable({
  providedIn: 'root',
})
export class ShoppingListService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiBaseUrl}/shopping-lists`;

  getWeekShoppingList(weekStart: string): Observable<ShoppingListResponse> {
    return this.http.get<ShoppingListResponse>(this.apiUrl, {
      params: { weekStart },
    });
  }

  refreshWeekShoppingList(weekStart: string): Observable<ShoppingListUpdateResponse> {
    return this.http.post<ShoppingListUpdateResponse>(`${this.apiUrl}/refresh`, { weekStart });
  }

  toggleShoppingItem(
    shoppingListId: string,
    itemName: string,
    checked: boolean,
  ): Observable<ShoppingListUpdateResponse> {
    return this.http.patch<ShoppingListUpdateResponse>(`${this.apiUrl}/${shoppingListId}/items`, {
      itemName,
      checked,
    });
  }
}
