import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';

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

import { Recipe } from '../../models/recipe';
import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-recipe-details',
  standalone: true,
  templateUrl: './recipe-details.html',
  styleUrl: './recipe-details.css',
})
export class RecipeDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly recipeService =
    inject(RecipeService);

  private readonly changeDetector =
    inject(ChangeDetectorRef);

  recipe: Recipe | null = null;

  loading = true;

  errorMessage = '';

  ngOnInit(): void {
    console.log(
      'RecipeDetails component loaded'
    );

    const recipeId =
      this.route.snapshot.paramMap.get('id');

    console.log(
      'Recipe ID:',
      recipeId
    );

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

    console.log(
      'Calling recipe API:',
      `http://localhost:5000/api/recipes/${recipeId}`
    );

    this.recipeService
      .getRecipeById(recipeId)
      .pipe(
        timeout(10000),

        catchError((error) => {
          console.error(
            'Recipe details request failed:',
            error
          );

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
          console.log(
            'Recipe loading finished'
          );

          this.loading = false;

          this.changeDetector.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          console.log(
            'Recipe API response:',
            response
          );

          if (response?.recipe) {
            this.recipe = response.recipe;

            console.log(
              'Recipe assigned:',
              this.recipe
            );
          }

          this.changeDetector.detectChanges();
        },

        error: (error) => {
          console.error(
            'Unexpected subscription error:',
            error
          );

          this.loading = false;

          this.changeDetector.detectChanges();
        },
      });
  }

  goBack(): void {
    this.router.navigate([
      '/recipes',
    ]);
  }

  getIngredients(): string[] {
    return this.recipe?.ingredients ?? [];
  }

  getSteps(): string[] {
    return this.recipe?.steps ?? [];
  }
}