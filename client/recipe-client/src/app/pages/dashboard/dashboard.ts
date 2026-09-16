import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { Recipe, RecipeStatsResponse, CUISINES } from '../../models/recipe';
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

  readonly cuisines = CUISINES;

  readonly statsLoading = signal(true);
  readonly errorMessage = signal('');

  readonly stats = signal<RecipeStatsResponse['totals']>({
    recipes: 0,
    orders: 0,
    averageRating: 0,
    mine: 0,
  });
  readonly mostOrdered = signal<Recipe[]>([]);
  readonly recentlyAdded = signal<Recipe[]>([]);
  readonly addedThisWeek = signal(0);

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.statsLoading.set(true);
    this.errorMessage.set('');

    this.recipeService
      .getRecipeStats()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Unable to load Savoré dashboard insights.');
          return of(null);
        }),
        finalize(() => this.statsLoading.set(false))
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }

        this.stats.set(response.totals);
        this.mostOrdered.set(response.mostOrdered);
        this.recentlyAdded.set(response.recentlyAdded);
      });

    this.loadAddedThisWeek();
  }

  retryDashboard(): void {
    this.loadDashboard();
  }

  getRecipeImage(recipe: { image?: string }): string {
    const image = recipe.image?.trim() ?? '';

    if (!image || !Dashboard.isImageSource(image)) {
      return Dashboard.fallbackImage;
    }

    return image;
  }

  onHeroImageError(event: Event): void {
    const imageElement = event.target as HTMLImageElement | null;

    if (!imageElement || imageElement.src.endsWith(Dashboard.fallbackImage)) {
      return;
    }

    imageElement.src = Dashboard.fallbackImage;
  }

  private static fallbackImage = '/images/delicious-food.jpg';

  private static isImageSource(value: string): boolean {
    if (value.startsWith('data:image/')) {
      return true;
    }

    return /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?.*)?(#.*)?$/i.test(value);
  }

  private loadAddedThisWeek(): void {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    this.recipeService
      .getRecipes(1, 50)
      .pipe(catchError(() => of({ recipes: [] })))
      .subscribe((response) => {
        this.addedThisWeek.set(
          response.recipes.filter(
            (recipe) => recipe.createdAt && new Date(recipe.createdAt) >= weekStart
          ).length
        );
      });
  }
}
