import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { Recipe } from '../models/recipe';
import {
  FavouriteActionResponse,
  FavouriteListResponse,
} from '../models/favourite';

/**
 * Keeps the current user's favourites in one place so the favourite state
 * on recipe cards, the details page and the favourites page stays in sync.
 */
@Injectable({
  providedIn: 'root',
})
export class FavouritesService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiBaseUrl}/favourites`;

  // The ids answer the "is this recipe favourited?" question asked by the
  // hearts; the recipes themselves are listed on the favourites page.
  private readonly favouriteIds = signal<string[]>([]);

  readonly favouriteRecipes = signal<Recipe[]>([]);

  private readonly loaded = signal(false);

  readonly loading = signal(false);

  // The recipe a toggle request is currently running for. Blocks a
  // second click on the same control from sending another request.
  private readonly pendingRecipeId = signal<string | null>(null);

  readonly lastError = signal('');

  readonly lastSuccess = signal('');

  isFavourite(recipeId: string): boolean {
    return this.favouriteIds().includes(recipeId);
  }

  isToggling(recipeId: string): boolean {
    return this.pendingRecipeId() === recipeId;
  }

  hasPendingToggle(): boolean {
    return this.pendingRecipeId() !== null;
  }

  /**
   * Loads the favourites list once per session. Safe to call from every
   * page that shows a favourite control; later calls are ignored while
   * the list is already loaded or still being fetched. Pass reload = true
   * to fetch the list again, for example when the favourites page opens.
   */
  loadFavourites(reload = false): void {
    if (this.loading() || (!reload && this.loaded())) {
      return;
    }

    this.loading.set(true);

    // The API answers with the saved recipes themselves, so their own
    // _id is the favourite id.
    this.http
      .get<FavouriteListResponse>(this.apiUrl)
      .subscribe({
        next: (response) => {
          const recipes = (response?.favourites ?? []).filter(
            (recipe) => !!recipe?._id
          );

          this.favouriteRecipes.set(recipes);
          this.favouriteIds.set(
            recipes.map((recipe) => recipe._id)
          );

          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          // Leave the list unloaded so the next page visit retries.
          this.loading.set(false);
          this.lastError.set(
            'Unable to load your favourites. Please try again.'
          );
        },
      });
  }

  /**
   * Adds or removes a recipe depending on its current state and updates
   * the local list only after the request succeeds.
   */
  toggleFavourite(recipeId: string): void {
    if (this.pendingRecipeId()) {
      return;
    }

    const wasFavourite = this.isFavourite(recipeId);

    this.pendingRecipeId.set(recipeId);
    this.lastError.set('');
    this.lastSuccess.set('');

    const request = wasFavourite
      ? this.http.delete<FavouriteActionResponse>(
          `${this.apiUrl}/${recipeId}`
        )
      : this.http.post<FavouriteActionResponse>(
          `${this.apiUrl}/${recipeId}`,
          {}
        );

    request.subscribe({
      next: (response) => {
        this.favouriteIds.update((ids) =>
          wasFavourite
            ? ids.filter((id) => id !== recipeId)
            : [...ids, recipeId]
        );

        // A recipe that is no longer a favourite also leaves the list.
        if (wasFavourite) {
          this.favouriteRecipes.update((recipes) =>
            recipes.filter((recipe) => recipe._id !== recipeId)
          );
        }

        this.lastSuccess.set(
          response?.message ??
            (wasFavourite
              ? 'Recipe removed from favourites.'
              : 'Recipe added to favourites.')
        );

        this.pendingRecipeId.set(null);
      },
      error: (error) => {
        this.lastError.set(
          error?.error?.message ||
            'Unable to update favourites. Please try again.'
        );

        this.pendingRecipeId.set(null);
      },
    });
  }

  clearMessages(): void {
    this.lastError.set('');
    this.lastSuccess.set('');
  }

  /**
   * Clears the cached list when the user signs out, so the next user
   * always starts with a clean state.
   */
  reset(): void {
    this.favouriteIds.set([]);
    this.favouriteRecipes.set([]);
    this.loaded.set(false);
    this.loading.set(false);
    this.pendingRecipeId.set(null);
    this.clearMessages();
  }
}
