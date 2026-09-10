import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { Recipe, RecipeStatsResponse } from '../../models/recipe';
import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly recipeService = inject(RecipeService);

  readonly currentUser = this.authService.getStoredUser();

  statsLoading = true;
  errorMessage = '';

  stats: RecipeStatsResponse['totals'] = {
    recipes: 0,
    orders: 0,
    averageRating: 0,
    mine: 0,
  };

  mostOrdered: Recipe[] = [];
  highestRated: Recipe[] = [];
  trending: Recipe[] = [];
  spicyFavorites: Recipe[] = [];
  sweetFavorites: Recipe[] = [];
  recentlyAdded: Recipe[] = [];

  readonly categoryCards = [
    { name: 'Indian', icon: '🌶️' },
    { name: 'Italian', icon: '🍝' },
    { name: 'Mexican', icon: '🌮' },
    { name: 'Chinese', icon: '🥢' },
    { name: 'Dessert', icon: '🍰' },
    { name: 'Breakfast', icon: '🥐' },
  ];

  ngOnInit(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.statsLoading = true;
    this.errorMessage = '';

    this.recipeService
      .getRecipeStats()
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load Savoré dashboard insights.';
          return of({
            totals: this.stats,
            mostOrdered: [],
            highestRated: [],
            trending: [],
            spicyFavorites: [],
            sweetFavorites: [],
            recentlyAdded: [],
          } as RecipeStatsResponse);
        }),
        finalize(() => {
          this.statsLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }

          this.stats = response.totals;
          this.mostOrdered = response.mostOrdered;
          this.highestRated = response.highestRated;
          this.trending = response.trending;
          this.spicyFavorites = response.spicyFavorites;
          this.sweetFavorites = response.sweetFavorites;
          this.recentlyAdded = response.recentlyAdded;
        },
      });
  }

  retryDashboard(): void {
    this.loadDashboard();
  }

  getRecipeImage(recipe: Recipe): string {
    return recipe.image || 'https://images.unsplash.com/photo-1498654896290-37a665833e4a?auto=format&fit=crop&w=1000&q=80';
  }

  getAverage(recipe: Recipe): number {
    return recipe.rating?.average ?? 0;
  }

  getCount(recipe: Recipe): number {
    return recipe.rating?.count ?? 0;
  }
}
