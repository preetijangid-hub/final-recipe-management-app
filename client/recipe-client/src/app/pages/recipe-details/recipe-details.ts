import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  catchError,
  finalize,
  of,
  timeout,
} from 'rxjs';

import { MatButtonModule } from '@angular/material/button';

import { Recipe } from '../../models/recipe';
import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-recipe-details',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './recipe-details.html',
  styleUrl: './recipe-details.css',
})
export class RecipeDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly recipeService =
    inject(RecipeService);

  private readonly authService =
    inject(AuthService);

  private readonly changeDetector =
    inject(ChangeDetectorRef);

  recipe: Recipe | null = null;

  loading = true;

  errorMessage = '';

  readonly currentUser = this.authService.getStoredUser();

  ngOnInit(): void {
    const recipeId =
      this.route.snapshot.paramMap.get('id');

    if (!recipeId) {
      this.loading = false;

      this.errorMessage =
        'Recipe ID was not found.';

      this.changeDetector.detectChanges();

      return;
    }

    this.loadRecipe(recipeId);
  }

  loadRecipe(recipeId: string): void {
    this.loading = true;

    this.errorMessage = '';

    this.recipeService
      .getRecipeById(recipeId)
      .pipe(
        timeout(10000),

        catchError((error) => {
          if (
            error?.name === 'TimeoutError'
          ) {
            this.errorMessage =
              'The recipe request took too long. Please check that the backend is running.';
          } else {
            this.errorMessage =
              error?.error?.message ||
              'Unable to load this recipe.';
          }

          return of(null);
        }),

        finalize(() => {
          this.loading = false;

          this.changeDetector.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response?.recipe) {
            this.recipe = response.recipe;
          }

          this.changeDetector.detectChanges();
        },

        error: () => {
          this.loading = false;

          this.changeDetector.detectChanges();
        },
      });
  }

  goBack(): void {
    this.router.navigate([
      '/discover',
    ]);
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