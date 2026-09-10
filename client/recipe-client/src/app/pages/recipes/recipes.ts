import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormArray,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, TimeoutError, debounceTime, distinctUntilChanged, finalize, switchMap, timeout } from 'rxjs';

import { Recipe, RecipeListResponse } from '../../models/recipe';
import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';

type RecipePayload = {
  title: string;
  category: string;
  ingredients: string[];
  steps: string[];
};

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './recipes.html',
  styleUrl: './recipes.css',
})
export class Recipes {
  private readonly recipeService = inject(RecipeService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly recipes = signal<Recipe[]>([]);
  readonly pagination = signal<RecipeListResponse['pagination'] | null>(null);

  readonly loading = signal(true);
  readonly errorMessage = signal('');

  search = '';
  category = '';

  currentPage = 1;
  readonly pageSize = 9;

  readonly currentUser = this.authService.getStoredUser();

  readonly showAddModal = signal(false);
  readonly showEditModal = signal(false);

  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly saveSuccess = signal('');

  readonly deletingId = signal<string | null>(null);
  editingRecipeId = '';

  private readonly searchInput$ = new Subject<string>();

  readonly ingredients = this.fb.nonNullable.array([this.createRow()]);
  readonly steps = this.fb.nonNullable.array([this.createRow()]);

  recipeForm: FormGroup = this.fb.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    ],
    category: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    ],
    ingredients: this.ingredients,
    steps: this.steps,
  });

  constructor() {
    this.route.queryParams.subscribe((params) => {
      const incomingCategory = (params['category'] ?? '').toString();
      if (incomingCategory) {
        this.category = incomingCategory;
      } else if (params['category'] === '') {
        this.category = '';
      }

      const editRecipeId = (params['editRecipeId'] ?? '').toString();
      if (editRecipeId) {
        this.recipeService.getRecipeById(editRecipeId).subscribe({
          next: (response) => {
            if (response.recipe) {
              this.openEditModal(response.recipe);
            }
          },
          error: () => {
            this.saveError.set('Unable to load recipe for editing.');
          },
        });
      }

      this.currentPage = 1;
      this.loadRecipes();
    });

    this.searchInput$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          this.search = value.trim();
          this.currentPage = 1;
          this.loading.set(true);
          this.errorMessage.set('');

          return this.recipeService
            .getRecipes(this.currentPage, this.pageSize, this.search, this.category)
            .pipe(
              timeout(10000),
              finalize(() => this.loading.set(false))
            );
        })
      )
      .subscribe({
        next: (response) => {
          this.recipes.set(response.recipes);
          this.pagination.set(response.pagination);
        },
        error: (error) => {
          this.errorMessage.set(this.getErrorMessage(error, 'Unable to load recipes. Please try again.'));
        },
      });
  }

  private loadRecipes(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.recipeService
      .getRecipes(this.currentPage, this.pageSize, this.search, this.category)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: (response) => {
          this.recipes.set(response.recipes);
          this.pagination.set(response.pagination);
        },
        error: (error) => {
          this.errorMessage.set(
            this.getErrorMessage(
              error,
              'Unable to load recipes. Please try again.'
            )
          );
        },
      });
  }

  refreshRecipes(): void {
    this.loadRecipes();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchInput$.next(target?.value ?? '');
  }

  searchRecipes(): void {
    this.currentPage = 1;
    this.search = this.search.trim();
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
    return recipe.ingredients.join(', ') || 'No ingredients listed';
  }

  isOwner(recipe: Recipe): boolean {
    if (!this.currentUser) {
      return false;
    }

    const owner = recipe.user;
    const userId = this.currentUser._id;

    if (typeof owner === 'string') {
      return owner === userId;
    }

    if (owner._id && userId) {
      return owner._id === userId;
    }

    if (owner.email && this.currentUser.email) {
      return owner.email.toLowerCase() === this.currentUser.email.toLowerCase();
    }

    return false;
  }

  canManageRecipe(recipe: Recipe): boolean {
    return (
      !!this.currentUser &&
      (this.currentUser.role === 'admin' || this.isOwner(recipe))
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openAddModal(): void {
    this.showAddModal.set(true);
    this.showEditModal.set(false);
    this.saving.set(false);
    this.saveError.set('');
    this.saveSuccess.set('');
    this.resetForm();
  }

  closeAddModal(): void {
    if (this.saving()) {
      return;
    }

    this.showAddModal.set(false);
    this.saveError.set('');
  }

  openEditModal(recipe: Recipe): void {
    if (!this.canManageRecipe(recipe)) {
      return;
    }

    this.showAddModal.set(false);
    this.showEditModal.set(true);
    this.editingRecipeId = recipe._id;
    this.saving.set(false);
    this.saveError.set('');
    this.saveSuccess.set('');

    this.recipeForm.reset({
      title: recipe.title,
      category: recipe.category,
    });
    this.fillRows(this.ingredients, recipe.ingredients);
    this.fillRows(this.steps, recipe.steps);
  }

  closeEditModal(): void {
    if (this.saving()) {
      return;
    }

    this.showEditModal.set(false);
    this.editingRecipeId = '';
    this.saveError.set('');
  }

  createRecipe(): void {
    if (this.saving()) {
      return;
    }

    this.saveError.set('');
    this.saveSuccess.set('');

    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    this.saving.set(true);

    this.recipeService
      .createRecipe(payload)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.saving.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.showAddModal.set(false);
          this.resetForm();
          this.saveSuccess.set('Recipe created successfully!');
          this.refreshRecipes();
        },
        error: (error) => {
          this.saveError.set(
            this.getErrorMessage(
              error,
              'Unable to create recipe. Please try again.'
            )
          );
        },
      });
  }

  updateRecipe(): void {
    if (this.saving()) {
      return;
    }

    this.saveError.set('');
    this.saveSuccess.set('');

    if (!this.editingRecipeId) {
      this.saveError.set('Recipe ID was not found.');
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    this.saving.set(true);

    this.recipeService
      .updateRecipe(this.editingRecipeId, payload)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.saving.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.showEditModal.set(false);
          this.editingRecipeId = '';
          this.resetForm();
          this.saveSuccess.set('Recipe updated successfully!');
          this.refreshRecipes();
        },
        error: (error) => {
          this.saveError.set(
            this.getErrorMessage(
              error,
              'Unable to update recipe. Please try again.'
            )
          );
        },
      });
  }

  deleteRecipe(recipe: Recipe): void {
    if (this.deletingId() || !this.canManageRecipe(recipe)) {
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${recipe.title}"?`)) {
      return;
    }

    this.deletingId.set(recipe._id);
    this.saveError.set('');
    this.saveSuccess.set('');

    this.recipeService
      .deleteRecipe(recipe._id)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.deletingId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.saveSuccess.set('Recipe deleted successfully!');
          this.refreshRecipes();
        },
        error: (error) => {
          this.saveError.set(
            this.getErrorMessage(
              error,
              'Unable to delete recipe. Please try again.'
            )
          );
        },
      });
  }

  addIngredient(): void {
    this.ingredients.push(this.createRow());
  }

  removeIngredient(index: number): void {
    if (this.ingredients.length > 1) {
      this.ingredients.removeAt(index);
    }
  }

  addStep(): void {
    this.steps.push(this.createRow());
  }

  removeStep(index: number): void {
    if (this.steps.length > 1) {
      this.steps.removeAt(index);
    }
  }

  resetForm(): void {
    this.recipeForm.reset({ title: '', category: '' });
    this.fillRows(this.ingredients, ['']);
    this.fillRows(this.steps, ['']);
  }

  private buildPayload(): RecipePayload | null {
    if (this.recipeForm.invalid) {
      this.recipeForm.markAllAsTouched();
      return null;
    }

    const ingredients = this.ingredients.value
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const steps = this.steps.value
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (ingredients.length === 0) {
      this.saveError.set('Please add at least one ingredient.');
      return null;
    }

    if (steps.length === 0) {
      this.saveError.set('Please add at least one preparation step.');
      return null;
    }

    return {
      title: this.recipeForm.value.title.trim(),
      category: this.recipeForm.value.category.trim(),
      ingredients,
      steps,
    };
  }

  private fillRows(
    array: FormArray<FormControl<string>>,
    values: string[]
  ): void {
    array.clear();

    for (const value of values.length > 0 ? values : ['']) {
      array.push(this.createRow(value));
    }
  }

  private createRow(value = ''): FormControl<string> {
    return this.fb.nonNullable.control(value);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TimeoutError) {
      return 'The request timed out. Please make sure the backend is running.';
    }

    const response = error as { error?: { message?: string }; message?: string };
    return response?.error?.message || response?.message || fallback;
  }
}