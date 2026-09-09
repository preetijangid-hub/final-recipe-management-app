import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  timeout,
} from 'rxjs';

import {
  Recipe,
  RecipeListResponse,
} from '../../models/recipe';

import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './recipes.html',
  styleUrl: './recipes.css',
})
export class Recipes {
  private readonly recipeService = inject(RecipeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  recipes$: Observable<RecipeListResponse | null>;

  loading = true;
  errorMessage = '';

  search = '';
  category = '';

  currentPage = 1;
  readonly pageSize = 9;

  readonly currentUser =
    this.authService.getStoredUser();

  showAddModal = false;
  showEditModal = false;

  saving = false;
  saveError = '';
  saveSuccess = '';

  deletingId: string | null = null;

  editingRecipeId = '';

  newRecipe = {
    title: '',
    category: '',
    ingredients: [''],
    steps: [''],
  };

  constructor() {
    this.recipes$ = this.loadRecipes();
  }

  loadRecipes(): Observable<RecipeListResponse | null> {
    this.loading = true;
    this.errorMessage = '';

    return this.recipeService
      .getRecipes(
        this.currentPage,
        this.pageSize,
        this.search,
        this.category
      )
      .pipe(
        timeout(10000),

        catchError((error) => {
          console.error(
            'Load recipes error:',
            error
          );

          if (error?.name === 'TimeoutError') {
            this.errorMessage =
              'Recipe request timed out. Please make sure the backend is running.';
          } else {
            this.errorMessage =
              error?.error?.message ||
              'Unable to load recipes. Please try again.';
          }

          return of(null);
        }),

        finalize(() => {
          this.loading = false;
        }),

        shareReplay(1)
      );
  }

  refreshRecipes(): void {
    this.recipes$ = this.loadRecipes();
  }

  searchRecipes(): void {
    this.currentPage = 1;
    this.refreshRecipes();
  }

  clearFilters(): void {
    this.search = '';
    this.category = '';
    this.currentPage = 1;

    this.refreshRecipes();
  }

  nextPage(totalPages: number): void {
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.refreshRecipes();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.refreshRecipes();
    }
  }

  getIngredients(recipe: Recipe): string {
    return (
      recipe.ingredients?.join(', ') ||
      'No ingredients listed'
    );
  }

  isOwner(recipe: Recipe): boolean {
    if (!this.currentUser) {
      return false;
    }

    const recipeUser =
      typeof recipe.user === 'string'
        ? null
        : recipe.user;

    if (
      recipeUser?._id &&
      this.currentUser._id
    ) {
      return (
        recipeUser._id ===
        this.currentUser._id
      );
    }

    if (
      recipeUser?.email &&
      this.currentUser.email
    ) {
      return (
        recipeUser.email.toLowerCase() ===
        this.currentUser.email.toLowerCase()
      );
    }

    return false;
  }

  canManageRecipe(recipe: Recipe): boolean {
    if (!this.currentUser) {
      return false;
    }

    if (
      this.currentUser.role === 'admin'
    ) {
      return true;
    }

    return this.isOwner(recipe);
  }

  openAddModal(): void {
    this.showAddModal = true;
    this.showEditModal = false;

    this.saving = false;
    this.saveError = '';
    this.saveSuccess = '';

    this.resetForm();
  }

  closeAddModal(): void {
    if (this.saving) {
      return;
    }

    this.showAddModal = false;
    this.saveError = '';
  }

  resetForm(): void {
    this.newRecipe = {
      title: '',
      category: '',
      ingredients: [''],
      steps: [''],
    };
  }

  addIngredient(): void {
    this.newRecipe.ingredients.push('');
  }

  removeIngredient(index: number): void {
    if (
      this.newRecipe.ingredients.length <= 1
    ) {
      return;
    }

    this.newRecipe.ingredients.splice(
      index,
      1
    );
  }

  addStep(): void {
    this.newRecipe.steps.push('');
  }

  removeStep(index: number): void {
    if (
      this.newRecipe.steps.length <= 1
    ) {
      return;
    }

    this.newRecipe.steps.splice(
      index,
      1
    );
  }

  validateRecipeForm(): {
    valid: boolean;
    title: string;
    category: string;
    ingredients: string[];
    steps: string[];
  } {
    const title =
      this.newRecipe.title.trim();

    const category =
      this.newRecipe.category.trim();

    const ingredients =
      this.newRecipe.ingredients
        .map((item) => item.trim())
        .filter(
          (item) => item.length > 0
        );

    const steps =
      this.newRecipe.steps
        .map((item) => item.trim())
        .filter(
          (item) => item.length > 0
        );

    this.saveError = '';

    if (!title) {
      this.saveError =
        'Please enter a recipe title.';
    } else if (!category) {
      this.saveError =
        'Please enter a recipe category.';
    } else if (
      ingredients.length === 0
    ) {
      this.saveError =
        'Please add at least one ingredient.';
    } else if (
      steps.length === 0
    ) {
      this.saveError =
        'Please add at least one preparation step.';
    }

    return {
      valid: !this.saveError,
      title,
      category,
      ingredients,
      steps,
    };
  }

  createRecipe(): void {
    console.log(
      'CREATE RECIPE BUTTON CLICKED'
    );

    this.saveError = '';
    this.saveSuccess = '';

    const form =
      this.validateRecipeForm();

    console.log(
      'Recipe form:',
      form
    );

    if (!form.valid) {
      console.log(
        'Recipe form validation failed'
      );
      return;
    }

    this.saving = true;

    console.log(
      'Sending create recipe request...'
    );

    this.recipeService
      .createRecipe({
        title: form.title,
        category: form.category,
        ingredients: form.ingredients,
        steps: form.steps,
      })
      .pipe(
        timeout(10000),

        finalize(() => {
          console.log(
            'Create recipe request finished'
          );

          this.saving = false;
        })
      )
      .subscribe({
        next: (response) => {
          console.log(
            'Create recipe response:',
            response
          );

          const createdRecipe =
            response?.recipe;

          if (!createdRecipe?._id) {
            this.saveError =
              'Recipe was created, but the server did not return the recipe ID.';
            return;
          }

          this.showAddModal = false;

          this.resetForm();

          this.saveSuccess =
            'Recipe created successfully!';

          console.log(
            'Created recipe ID:',
            createdRecipe._id
          );

          this.router.navigate([
            '/recipes',
            createdRecipe._id,
          ]);
        },

        error: (error) => {
          console.error(
            'CREATE RECIPE ERROR:',
            error
          );

          console.error(
            'Server error body:',
            error?.error
          );

          console.error(
            'HTTP status:',
            error?.status
          );

          if (
            error?.name ===
            'TimeoutError'
          ) {
            this.saveError =
              'The server did not respond within 10 seconds. Please check that the backend is running.';
          } else {
            this.saveError =
              error?.error?.message ||
              error?.message ||
              'Unable to create recipe. Please try again.';
          }
        },
      });
  }

  openEditModal(recipe: Recipe): void {
    if (!this.canManageRecipe(recipe)) {
      return;
    }

    this.showAddModal = false;
    this.showEditModal = true;

    this.editingRecipeId =
      recipe._id;

    this.saving = false;
    this.saveError = '';
    this.saveSuccess = '';

    this.newRecipe = {
      title: recipe.title || '',
      category: recipe.category || '',

      ingredients:
        recipe.ingredients?.length
          ? [...recipe.ingredients]
          : [''],

      steps:
        recipe.steps?.length
          ? [...recipe.steps]
          : [''],
    };
  }

  closeEditModal(): void {
    if (this.saving) {
      return;
    }

    this.showEditModal = false;

    this.editingRecipeId = '';

    this.saveError = '';
  }

  updateRecipe(): void {
    console.log(
      'UPDATE RECIPE BUTTON CLICKED'
    );

    this.saveError = '';
    this.saveSuccess = '';

    if (!this.editingRecipeId) {
      this.saveError =
        'Recipe ID was not found.';
      return;
    }

    const form =
      this.validateRecipeForm();

    if (!form.valid) {
      return;
    }

    this.saving = true;

    this.recipeService
      .updateRecipe(
        this.editingRecipeId,
        {
          title: form.title,
          category: form.category,
          ingredients:
            form.ingredients,
          steps: form.steps,
        }
      )
      .pipe(
        timeout(10000),

        finalize(() => {
          this.saving = false;
        })
      )
      .subscribe({
        next: () => {
          this.showEditModal = false;

          this.editingRecipeId = '';

          this.resetForm();

          this.saveSuccess =
            'Recipe updated successfully!';

          this.refreshRecipes();
        },

        error: (error) => {
          console.error(
            'UPDATE RECIPE ERROR:',
            error
          );

          this.saveError =
            error?.error?.message ||
            error?.message ||
            'Unable to update recipe. Please try again.';
        },
      });
  }

  deleteRecipe(recipe: Recipe): void {
    if (!this.canManageRecipe(recipe)) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${recipe.title}"?`
      );

    if (!confirmed) {
      return;
    }

    this.deletingId =
      recipe._id;

    this.saveError = '';
    this.saveSuccess = '';

    this.recipeService
      .deleteRecipe(recipe._id)
      .pipe(
        timeout(10000),

        finalize(() => {
          this.deletingId = null;
        })
      )
      .subscribe({
        next: () => {
          this.saveSuccess =
            'Recipe deleted successfully!';

          this.refreshRecipes();
        },

        error: (error) => {
          console.error(
            'DELETE RECIPE ERROR:',
            error
          );

          this.saveError =
            error?.error?.message ||
            error?.message ||
            'Unable to delete recipe. Please try again.';
        },
      });
  }

  logout(): void {
    this.authService.logout();

    this.router.navigate([
      '/login',
    ]);
  }
}