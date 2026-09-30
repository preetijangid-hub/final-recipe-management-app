import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ReplaySubject, Subject, TimeoutError, catchError, debounceTime, distinctUntilChanged, finalize, merge, of, switchMap, tap, timeout } from 'rxjs';

import {
  COOKING_TIME_CHOICES,
  MIN_RATING_CHOICES,
  Recipe,
  RecipeListResponse,
  RecipeSearchFilters,
  SORT_CHOICES,
  TrendingRecipe,
  CUISINES,
  MEAL_CATEGORIES,
} from '../../models/recipe';
import { CollectionSummary } from '../../models/collection';
import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';
import { FavouritesService } from '../../services/favourites';
import { CollectionService } from '../../services/collection';
import { VoiceSearchService } from '../../services/voice-search';

type RecipePayload = {
  title: string;
  description: string;
  cookingTime: number | null;
  category: string;
  mealCategory: string;
  ingredients: string[];
  steps: string[];
};

// A filter the user can remove with one click.
type FilterChip = {
  key: string;
  label: string;
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
  private readonly favouritesService = inject(FavouritesService);

  // Exposed for the favourite controls in the template.
  readonly favourites = this.favouritesService;
  private readonly collectionService = inject(CollectionService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly recipes = signal<Recipe[]>([]);
  readonly pagination = signal<RecipeListResponse['pagination'] | null>(null);

  readonly loading = signal(true);
  readonly errorMessage = signal('');

  readonly cuisineOptions = CUISINES;
  readonly mealCategoryOptions = MEAL_CATEGORIES;
  readonly sortChoices = SORT_CHOICES;
  readonly cookingTimeChoices = COOKING_TIME_CHOICES;
  readonly minRatingChoices = MIN_RATING_CHOICES;

  // Voice search hands its transcript to the same search box.
  readonly voice = inject(VoiceSearchService);

  private readonly destroyRef = inject(DestroyRef);

  search = '';
  category = '';
  mealCategory = '';

  sort = 'newest';
  maxCookingTime: number | null = null;
  minRating: number | null = null;

  // "Cook With What I Have" state.
  readonly pantryOpen = signal(false);
  readonly pantryIngredients = signal<string[]>([]);
  pantryInput = '';

  // Trending This Week is fetched separately so a slow or failing request
  // never delays the recipe list.
  readonly trending = signal<TrendingRecipe[]>([]);
  readonly trendingLoading = signal(true);
  readonly trendingError = signal('');

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

  // Favourite and collection controls shared across cards.
  readonly showCollectModal = signal(false);

  readonly collectRecipe = signal<Recipe | null>(null);

  readonly collectableCollections = signal<CollectionSummary[]>([]);

  readonly loadingCollections = signal(false);

  readonly addingToCollectionId = signal('');

  // Collections that already received the recipe in the open modal.
  readonly addedCollectionIds = signal<string[]>([]);

  readonly creatingForCollect = signal(false);

  newCollectionName = '';


  private readonly searchInput$ = new Subject<string>();

  // Anything that should produce a new recipe request is pushed here.
  // Typing goes through the debounced stream below, filter and page changes
  // use this subject directly.
  private readonly query$ = new ReplaySubject<void>(1);

  readonly ingredients = this.fb.nonNullable.array([this.createRow()]);
  readonly steps = this.fb.nonNullable.array([this.createRow()]);

  recipeForm: FormGroup = this.fb.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    ],
    description: ['', [Validators.maxLength(500)]],
    cookingTime: [null, [Validators.min(1), Validators.max(600)]],
    category: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    ],
    mealCategory: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    ],
    ingredients: this.ingredients,
    steps: this.steps,
  });

  constructor() {
    this.favouritesService.loadFavourites();

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
      const incomingCategory = (params['category'] ?? '').toString();
      if (incomingCategory) {
        this.category = incomingCategory;
      } else if (params['category'] === '') {
        this.category = '';
      }

      const incomingMealCategory = (params['mealCategory'] ?? '').toString();
      if (incomingMealCategory) {
        this.mealCategory = incomingMealCategory;
      } else if (params['mealCategory'] === '') {
        this.mealCategory = '';
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
      this.requestRecipes();
    });

    // Typing is debounced, so a request is only sent once the user pauses
    // instead of on every keystroke.
    const typedSearch$ = this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap((value) => {
        this.search = value.trim();
        this.currentPage = 1;
      })
    );

    // switchMap cancels the previous request as soon as a newer one starts,
    // so a slow response can never overwrite fresher results.
    merge(typedSearch$, this.query$)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set('');
        }),
        switchMap(() => this.fetchRecipes()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.loading.set(false);

        if (!response) {
          return;
        }

        this.recipes.set(response.recipes);
        this.pagination.set(response.pagination);
      });

    this.loadTrending();
  }

  // Reads the filters that are combined with the search text.
  private searchFilters(): RecipeSearchFilters {
    return {
      ingredients: this.pantryIngredients(),
      maxCookingTime: this.maxCookingTime,
      minRating: this.minRating,
    };
  }

  private fetchRecipes() {
    return this.recipeService
      .getRecipes(
        this.currentPage,
        this.pageSize,
        this.search,
        this.category,
        this.sort,
        this.mealCategory,
        this.searchFilters()
      )
      .pipe(
        timeout(10000),
        catchError((error) => {
          this.errorMessage.set(
            this.getErrorMessage(
              error,
              'Unable to load recipes. Please try again.'
            )
          );

          return of(null);
        })
      );
  }

  private requestRecipes(): void {
    this.query$.next();
  }

  private loadTrending(): void {
    this.trendingLoading.set(true);
    this.trendingError.set('');

    this.recipeService
      .getTrendingRecipes()
      .pipe(
        timeout(10000),
        catchError((error) => {
          this.trendingError.set(
            this.getErrorMessage(
              error,
              'Trending recipes are unavailable right now.'
            )
          );

          return of(null);
        }),
        finalize(() => this.trendingLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.trending.set(response?.trending ?? []);
      });
  }

  // Called by the template after a create, update or delete.
  refreshRecipes(): void {
    this.requestRecipes();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';

    this.search = value;
    this.searchInput$.next(value);
  }

  searchRecipes(): void {
    this.search = this.search.trim();
    this.currentPage = 1;
    this.requestRecipes();
  }

  // Used by the sorting control and the filter selects.
  applyFilters(): void {
    this.currentPage = 1;
    this.requestRecipes();
  }

  nextPage(totalPages: number): void {
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.requestRecipes();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.requestRecipes();
    }
  }

  getIngredients(recipe: Recipe): string {
    return recipe.ingredients.join(', ') || 'No ingredients listed';
  }

  // One chip per active filter, so any single filter can be removed again.
  get activeFilters(): FilterChip[] {
    const chips: FilterChip[] = [];

    if (this.search.trim()) {
      chips.push({
        key: 'search',
        label: `“${this.search.trim()}”`,
      });
    }

    if (this.category) {
      chips.push({
        key: 'category',
        label: this.category,
      });
    }

    if (this.mealCategory) {
      chips.push({
        key: 'mealCategory',
        label: this.mealCategory,
      });
    }

    if (this.maxCookingTime) {
      chips.push({
        key: 'maxCookingTime',
        label: `Up to ${this.maxCookingTime} min`,
      });
    }

    if (this.minRating) {
      chips.push({
        key: 'minRating',
        label: `${this.minRating}★ and above`,
      });
    }

    for (const ingredient of this.pantryIngredients()) {
      chips.push({
        key: `ingredient:${ingredient}`,
        label: ingredient,
      });
    }

    return chips;
  }

  removeFilter(key: string): void {
    if (key === 'search') {
      this.search = '';
    } else if (key === 'category') {
      this.category = '';
    } else if (key === 'mealCategory') {
      this.mealCategory = '';
    } else if (key === 'maxCookingTime') {
      this.maxCookingTime = null;
    } else if (key === 'minRating') {
      this.minRating = null;
    } else if (key.startsWith('ingredient:')) {
      const name = key.slice('ingredient:'.length);

      this.pantryIngredients.update((list) =>
        list.filter((item) => item !== name)
      );
    }

    this.applyFilters();
  }

  togglePantry(): void {
    this.pantryOpen.update((open) => !open);
  }

  addPantryIngredient(): void {
    const name = this.pantryInput.trim();

    if (name.length < 2) {
      this.saveError.set('Please type at least two letters of an ingredient.');
      return;
    }

    const alreadyPicked = this.pantryIngredients().some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );

    this.pantryInput = '';

    if (alreadyPicked) {
      return;
    }

    this.pantryIngredients.update((list) => [...list, name]);
    this.saveError.set('');
    this.applyFilters();
  }

  removePantryIngredient(name: string): void {
    this.pantryIngredients.update((list) =>
      list.filter((item) => item !== name)
    );

    this.applyFilters();
  }

  toggleVoiceSearch(): void {
    if (this.voice.listening()) {
      this.voice.stop();
      return;
    }

    this.voice.start((transcript) => {
      // The transcript travels through the same debounced search flow as
      // text typed into the box.
      this.searchInput$.next(transcript);
    });
  }

  hasCookingTime(recipe: Recipe): boolean {
    return !!recipe.cookingTime;
  }

  clearFilters(): void {
    this.search = '';
    this.category = '';
    this.mealCategory = '';
    this.sort = 'newest';
    this.maxCookingTime = null;
    this.minRating = null;
    this.pantryIngredients.set([]);
    this.pantryInput = '';
    this.currentPage = 1;

    this.requestRecipes();
  }

  toggleFavourite(recipeId: string): void {
    this.favouritesService.toggleFavourite(recipeId);
  }

  openCollectModal(recipe: Recipe): void {
    this.collectRecipe.set(recipe);
    this.addedCollectionIds.set([]);
    this.newCollectionName = '';
    this.showCollectModal.set(true);
    this.saveError.set('');
    this.saveSuccess.set('');
    this.favouritesService.clearMessages();

    this.loadCollectableCollections();
  }

  closeCollectModal(): void {
    this.showCollectModal.set(false);
    this.collectRecipe.set(null);
  }

  addToCollection(collectionId: string): void {
    const recipe = this.collectRecipe();

    if (!recipe || this.addingToCollectionId()) {
      return;
    }

    // Skip collections that already received this recipe.
    if (this.addedCollectionIds().includes(collectionId)) {
      return;
    }

    this.addingToCollectionId.set(collectionId);
    this.saveError.set('');

    this.collectionService
      .addRecipe(collectionId, recipe._id)
      .subscribe({
        next: (response) => {
          this.addingToCollectionId.set('');
          this.addedCollectionIds.update((ids) => [
            ...ids,
            collectionId,
          ]);
          this.saveSuccess.set(
            response?.message || 'Recipe added to the collection.'
          );
        },
        error: (error) => {
          this.addingToCollectionId.set('');

          // A duplicate is not a failure worth alerting about; the
          // collection already contains the recipe.
          if (error?.status === 409) {
            this.addedCollectionIds.update((ids) => [
              ...ids,
              collectionId,
            ]);
          } else {
            this.saveError.set(
              error?.error?.message ||
                'Unable to add the recipe to the collection.'
            );
          }
        },
      });
  }

  createCollectionForRecipe(): void {
    const recipe = this.collectRecipe();
    const name = this.newCollectionName.trim();

    if (!recipe || this.creatingForCollect()) {
      return;
    }

    if (name.length < 2 || name.length > 60) {
      this.saveError.set(
        'Collection name must be between 2 and 60 characters.'
      );
      return;
    }

    this.creatingForCollect.set(true);
    this.saveError.set('');

    this.collectionService
      .createCollection(name)
      .subscribe({
        next: (response) => {
          this.creatingForCollect.set(false);
          this.newCollectionName = '';

          const created = response?.collection;

          if (created) {
            this.collectableCollections.update((collections) => [
              created,
              ...collections,
            ]);

            this.addToCollection(created._id);
          }
        },
        error: (error) => {
          this.creatingForCollect.set(false);
          this.saveError.set(
            error?.error?.message ||
              'Unable to create the collection.'
          );
        },
      });
  }

  private loadCollectableCollections(): void {
    this.loadingCollections.set(true);

    this.collectionService
      .getMyCollections(1, 50)
      .pipe(finalize(() => this.loadingCollections.set(false)))
      .subscribe({
        next: (response) => {
          this.collectableCollections.set(
            response?.collections ?? []
          );
        },
        error: () => {
          this.collectableCollections.set([]);
        },
      });
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
      description: recipe.description ?? '',
      cookingTime: recipe.cookingTime ?? null,
      category: CUISINES.includes(recipe.category) ? recipe.category : '',
      mealCategory: recipe.mealCategory || '',
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
    this.recipeForm.reset({
      title: '',
      description: '',
      cookingTime: null,
      category: '',
      mealCategory: '',
    });
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

    const description = String(this.recipeForm.value.description ?? '').trim();
    const cookingTime = this.recipeForm.value.cookingTime;
    const minutes = Number(cookingTime);

    return {
      title: this.recipeForm.value.title.trim(),
      description,
      cookingTime:
        cookingTime === null || cookingTime === '' || Number.isNaN(minutes)
          ? null
          : minutes,
      category: this.recipeForm.value.category.trim(),
      mealCategory: this.recipeForm.value.mealCategory.trim(),
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