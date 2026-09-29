import { Recipe } from './recipe';

// A collection card as returned by the paginated list endpoint.
export interface CollectionSummary {
  _id: string;
  name: string;
  recipeCount: number;
  coverImage: string | null;
  description?: string;
  // Only returned on the owner's own requests, so the owner can copy the
  // public link of a collection they shared.
  shareToken?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CollectionListResponse {
  collections: CollectionSummary[];
  pagination: PaginationMeta;
}

// A single collection with its recipes populated as references.
export interface CollectionDetail {
  _id: string;
  name: string;
  recipeCount: number;
  recipes: Recipe[];
}

export interface CollectionDetailResponse {
  collection: CollectionDetail;
}

export interface CreateCollectionDetails {
  description?: string;
  coverImage?: string;
}

export interface CreateCollectionResponse {
  message: string;
  collection: CollectionSummary;
}

export interface CollectionMutationResponse {
  message: string;
  recipeCount: number;
}

export interface CollectionUpdateResponse {
  message: string;
  collection: CollectionSummary;
}

// A recipe as shown on the public share page. Only display fields are
// sent by the API.
export interface SharedRecipe {
  _id: string;
  title: string;
  image: string;
  category: string;
}

export interface SharedCollection {
  name: string;
  description: string;
  coverImage: string | null;
  recipeCount: number;
  recipes: SharedRecipe[];
}

export interface SharedCollectionResponse {
  collection: SharedCollection;
}
