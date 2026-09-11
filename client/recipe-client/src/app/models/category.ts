export interface Category {
  _id: string | null;
  name: string;
  managed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryListResponse {
  categories: Category[];
}

export interface CategoryMutationResponse {
  message: string;
  category: Category;
}

export interface CategoryDeleteResponse {
  message: string;
}