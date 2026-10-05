export interface ShoppingListItem {
  _id?: string;
  name: string;
  quantity: number;
  unit: string;
  kind: 'count' | 'weight' | 'volume' | 'unknown';
  checked: boolean;
  normalizedName?: string;
  usedIn?: string[];
}

export interface ShoppingListDocument {
  _id: string;
  user: string;
  weekStart: string;
  items: ShoppingListItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ShoppingListResponse {
  weekStart: string;
  weekEnd: string;
  shoppingList: ShoppingListDocument;
}

export interface ShoppingListUpdateResponse {
  message: string;
  shoppingList: ShoppingListDocument;
}
