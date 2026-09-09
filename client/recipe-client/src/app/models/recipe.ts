export interface Recipe {
  _id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  category: string;
  user: string | {
    _id: string;
    name: string;
    email: string;
  };
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