import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  catchError,
  finalize,
  map,
  of,
  switchMap,
  tap,
  timeout,
} from 'rxjs';

import { MatButtonModule } from '@angular/material/button';

import { Recipe } from '../../models/recipe';
import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';
import { FavouritesService } from '../../services/favourites';
import { ReviewSection } from './review-section';
import { SimilarRecipes } from './similar-recipes';

@Component({
  selector: 'app-recipe-details',
  standalone: true,
  imports: [CommonModule, MatButtonModule, RouterLink, ReviewSection, SimilarRecipes],
  templateUrl: './recipe-details.html',
  styleUrl: './recipe-details.css',
})
export class RecipeDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);

  private readonly router = inject(Router);

  private readonly recipeService = inject(RecipeService);

  private readonly favouritesService = inject(FavouritesService);

  // Exposed for the favourite control in the template.
  readonly favourites = this.favouritesService;

  private readonly authService =
    inject(AuthService);

  private readonly changeDetector =
    inject(ChangeDetectorRef);

  recipe: Recipe | null = null;

  loading = true;

  errorMessage = '';

  readonly currentUser = this.authService.getStoredUser();

  ngOnInit(): void {
    this.favouritesService.loadFavourites();

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        tap((recipeId) => {
          this.recipe = null;
          this.loading = !!recipeId;
          this.errorMessage = recipeId
            ? ''
            : 'Recipe ID was not found.';
        }),
        switchMap((recipeId) => {
          if (!recipeId) {
            return of(null);
          }

          return this.recipeService
            .getRecipeById(recipeId)
            .pipe(
              timeout(10000),
              catchError((error) => {
                if (error?.name === 'TimeoutError') {
                  this.errorMessage =
                    'The recipe request took too long. Please check that the backend is running.';
                } else {
                  this.errorMessage =
                    error?.error?.message ||
                    'Unable to load this recipe.';
                }

                return of(null);
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.recipe = response?.recipe ?? null;
        this.loading = false;
        this.changeDetector.detectChanges();
      });
  }

  goBack(): void {
    this.router.navigate([
      '/discover',
    ]);
  }

  toggleFavourite(): void {
    if (!this.recipe?._id) {
      return;
    }

    this.favouritesService.toggleFavourite(
      this.recipe._id
    );
  }

  getIngredients(): string[] {
    return this.recipe?.ingredients ?? [];
  }

  getSteps(): string[] {
    return this.recipe?.steps ?? [];
  }

  getAuthorName(): string {
    if (!this.recipe?.user) {
      return 'Savoré Kitchen';
    }

    if (typeof this.recipe.user === 'string') {
      return 'Savoré Kitchen';
    }

    return this.recipe.user.name || this.recipe.user.email || 'Savoré Kitchen';
  }

  getAuthorProfession(): string {
    const owner = this.recipe?.user;

    if (!owner || typeof owner === 'string') {
      return '';
    }

    return owner.profession ?? '';
  }

  isOwner(): boolean {
    if (!this.currentUser || !this.recipe) {
      return false;
    }

    const owner = this.recipe.user;
    const userId = this.currentUser._id;

    if (typeof owner === 'string') {
      return owner === userId;
    }

    if (owner?._id && userId) {
      return owner._id === userId;
    }

    if (owner?.email && this.currentUser.email) {
      return owner.email.toLowerCase() === this.currentUser.email.toLowerCase();
    }

    return false;
  }

  getOwnerId(): string {
    const owner = this.recipe?.user;

    if (!owner) {
      return '';
    }

    return typeof owner === 'string' ? owner : owner._id;
  }

  canManageRecipe(): boolean {
    return !!this.currentUser && (this.currentUser.role === 'admin' || this.isOwner());
  }

  editRecipe(): void {
    if (!this.recipe?._id || !this.canManageRecipe()) {
      return;
    }

    this.router.navigate(['/discover'], {
      queryParams: { editRecipeId: this.recipe._id },
    });
  }

  deleteRecipe(): void {
    if (!this.recipe?._id || !this.canManageRecipe()) {
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${this.recipe.title}"?`)) {
      return;
    }

    this.recipeService
      .deleteRecipe(this.recipe._id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/discover']);
        },
        error: () => {
          this.errorMessage = 'Unable to delete this recipe.';
        },
      });
  }
}