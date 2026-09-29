import { Recipe } from './recipe';

export interface FavouriteListResponse {
  favourites: Recipe[];
}

export interface FavouriteActionResponse {
  message: string;
}
