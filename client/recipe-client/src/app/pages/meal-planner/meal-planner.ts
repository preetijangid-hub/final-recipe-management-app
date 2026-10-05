import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Recipe } from '../../models/recipe';
import { MealPlanEntry, MealType } from '../../models/meal-plan';
import { MealPlanService } from '../../services/meal-plan';
import { RecipeService } from '../../services/recipe';
import { ShoppingListService } from '../../services/shopping-list';

interface WeekDay {
  key: string;
  label: string;
  dayName: string;
  isToday: boolean;
}

@Component({
  selector: 'app-meal-planner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meal-planner.html',
  styleUrl: './meal-planner.css',
})
export class MealPlannerPage implements OnInit, OnDestroy {
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly cdr = inject(ChangeDetectorRef);

  printPage(): void {
    window.print();
  }

  readonly mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

  activeWeekNavigation: 'previous' | 'this' | 'next' | null = 'this';

  selectedWeekStart = this.getStartOfCurrentWeek();
  weekDays: WeekDay[] = [];
  mealPlans: MealPlanEntry[] = [];
  mealPlanMap: Record<string, MealPlanEntry> = {};
  availableRecipes: Recipe[] = [];
  loading = false;
  error = '';
  success = '';
  checkedShoppingItems: Record<string, boolean> = {};

  cookModeRecipe: Recipe | null = null;
  cookModeSteps: string[] = [];
  cookModeCurrentIndex = 0;
  cookModeIsActive = false;
  cookModeIsPaused = false;
  private speechUtterance: SpeechSynthesisUtterance | null = null;

  ngOnInit(): void {
    this.weekDays = this.buildWeekDays(this.selectedWeekStart);
    this.loadRecipes();
    this.loadWeeklyPlan();
  }

  ngOnDestroy(): void {
    this.cleanupCookMode();
  }

  private loadRecipes(): void {
    this.recipeService.getRecipes(1, 48, '', '', 'newest').subscribe({
      next: ({ recipes }) => {
        this.availableRecipes = recipes;
        this.cdr.detectChanges();
      },
      error: () => {
        this.availableRecipes = [];
        this.cdr.detectChanges();
      },
    });
  }

  private loadWeeklyPlan(): void {
    this.loading = true;
    this.error = '';

    this.mealPlanService.getWeekPlan(this.selectedWeekStart).subscribe({
      next: ({ mealPlans }) => {
        this.mealPlans = (mealPlans || [])
          .map((entry) => this.normalizeMealPlanEntry(entry))
          .filter((entry): entry is MealPlanEntry => Boolean(entry));
        this.syncMealPlanMap();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'We could not load your meal plan.';
        this.loading = false;
      },
    });
  }

  private refreshShoppingListForCurrentWeek(): void {
    this.shoppingListService.refreshWeekShoppingList(this.selectedWeekStart).subscribe({
      next: () => {
        // Shopping list is refreshed on the dedicated page when opened.
      },
      error: () => {
        // Ignore non-critical refresh failures for planner updates.
      },
    });
  }

  getDateForCell(dayKey: string, mealType: MealType): MealPlanEntry | null {
    return this.mealPlanMap[this.getMealPlanKey(dayKey, mealType)] ?? null;
  }

  getSlotRecipes(entry: MealPlanEntry | null | undefined): Recipe[] {
    if (!entry) {
      return [];
    }

    const recipes = Array.isArray(entry.recipes) && entry.recipes.length
      ? entry.recipes
      : entry.recipe
        ? [entry.recipe]
        : [];

    return recipes.filter((recipe): recipe is Recipe => Boolean(recipe && recipe._id));
  }

  private normalizeMealPlanEntry(entry: MealPlanEntry | null | undefined): MealPlanEntry | null {
    if (!entry) {
      return null;
    }

    const normalizedDate = this.normalizeDateKey(entry.date);
    const normalizedMealType = this.normalizeMealType(entry.mealType);
    const recipes = this.getSlotRecipes({ ...entry, date: normalizedDate, mealType: normalizedMealType });

    return {
      ...entry,
      date: normalizedDate,
      mealType: normalizedMealType,
      servingsByRecipe: this.buildServingsByRecipe(entry, recipes),
      recipes,
      recipe: recipes[0] ?? null,
    };
  }

  // Every recipe in a slot needs its own serving count. Plans saved before
  // per-recipe servings existed only carry the slot-level value, so each recipe
  // starts from that value and is then tracked individually.
  private buildServingsByRecipe(entry: MealPlanEntry, recipes: Recipe[]): Record<string, number> {
    const stored = entry.servingsByRecipe ?? {};
    const fallback = Number.isInteger(entry.servings) && entry.servings >= 1 ? entry.servings : 1;
    const servingsByRecipe: Record<string, number> = {};

    for (const recipe of recipes) {
      const storedServings = stored[recipe._id];

      servingsByRecipe[recipe._id] =
        typeof storedServings === 'number' && Number.isInteger(storedServings) && storedServings >= 1
          ? storedServings
          : fallback;
    }

    return servingsByRecipe;
  }

  private getMealPlanKey(dateKey: string, mealType: MealType): string {
    return `${dateKey}:${mealType}`;
  }

  private syncMealPlanMap(): void {
    this.mealPlanMap = {};

    for (const entry of this.mealPlans) {
      const normalizedEntry = this.normalizeMealPlanEntry(entry);
      if (!normalizedEntry?.date || !normalizedEntry.mealType) {
        continue;
      }

      this.mealPlanMap[this.getMealPlanKey(normalizedEntry.date, normalizedEntry.mealType)] = normalizedEntry;
    }
  }

  onRecipeSelected(dateKey: string, mealType: MealType, recipeId: string): void {
    if (!recipeId) {
      return;
    }

    const existingEntry = this.getDateForCell(dateKey, mealType);
    const alreadyAdded = this.getSlotRecipes(existingEntry).some((recipe) => recipe._id === recipeId);

    if (alreadyAdded) {
      return;
    }

    const recipe = this.availableRecipes.find((item) => item._id === recipeId);

    if (!recipe) {
      return;
    }

    this.mealPlanService
      .saveMealPlan({
        date: dateKey,
        mealType,
        recipe: recipe._id,
        servings: 1,
      })
      .subscribe({
        next: ({ mealPlan }) => {
          const normalized = this.normalizeMealPlanEntry(mealPlan);
          const existingIndex = this.mealPlans.findIndex(
            (entry) => entry.date === dateKey && entry.mealType === mealType
          );

          if (existingIndex >= 0 && normalized) {
            this.mealPlans[existingIndex] = normalized;
          } else if (normalized) {
            this.mealPlans.push(normalized);
          }

          this.syncMealPlanMap();
          this.success = 'Meal saved to your plan.';
          this.refreshShoppingListForCurrentWeek();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.success = '';
            this.cdr.detectChanges();
          }, 2500);
        },
        error: () => {
          this.error = 'The recipe could not be saved to this slot.';
        },
      });
  }

  removeMeal(dateKey: string, mealType: MealType, recipeId?: string): void {
    const entry = this.getDateForCell(dateKey, mealType);

    if (!entry || !entry._id) {
      return;
    }

    const targetRecipeId = recipeId || this.getSlotRecipes(entry)[0]?._id;

    if (!targetRecipeId) {
      return;
    }

    this.mealPlanService.removeRecipeFromMealPlan(entry._id, targetRecipeId).subscribe({
      next: ({ mealPlan, emptied }) => {
        if (emptied) {
          this.mealPlans = this.mealPlans.filter(
            (item) => !(item.date === dateKey && item.mealType === mealType)
          );
        } else if (mealPlan) {
          const normalized = this.normalizeMealPlanEntry(mealPlan);
          const existingIndex = this.mealPlans.findIndex(
            (item) => item.date === dateKey && item.mealType === mealType
          );

          if (existingIndex >= 0 && normalized) {
            this.mealPlans[existingIndex] = normalized;
          }
        }

        this.syncMealPlanMap();
        this.success = 'Recipe removed from your plan.';
        this.refreshShoppingListForCurrentWeek();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.success = '';
          this.cdr.detectChanges();
        }, 2500);
      },
      error: () => {
        this.error = 'The recipe could not be removed.';
      },
    });
  }

  updateServings(dateKey: string, mealType: MealType, recipeId: string, delta: number): void {
    this.syncMealPlanMap();

    const entry = this.getDateForCell(dateKey, mealType);

    if (!entry || !recipeId || !entry._id) {
      return;
    }

    const currentValue = this.getRecipeServings(dateKey, mealType, recipeId);
    const nextValue = Math.min(20, Math.max(1, currentValue + delta));

    // Optimistically update only this recipe's serving count so the card
    // reflects the change immediately while the request is in flight.
    this.applyRecipeServings(dateKey, mealType, recipeId, nextValue);

    this.mealPlanService
      .saveMealPlan({
        date: dateKey,
        mealType,
        recipe: recipeId,
        servings: nextValue,
      })
      .subscribe({
        next: ({ mealPlan }) => {
          const index = this.mealPlans.findIndex(
            (item) => item.date === dateKey && item.mealType === mealType
          );

          if (index >= 0) {
            this.mealPlans[index] = this.normalizeMealPlanEntry(mealPlan) ?? this.mealPlans[index];
          }

          this.syncMealPlanMap();
          this.refreshShoppingListForCurrentWeek();
          this.cdr.detectChanges();
        },
        error: () => {
          this.syncMealPlanMap();
          this.error = 'The serving size could not be updated.';
          this.cdr.detectChanges();
        },
      });
  }

  private applyRecipeServings(dateKey: string, mealType: MealType, recipeId: string, servings: number): void {
    const index = this.mealPlans.findIndex((item) => item.date === dateKey && item.mealType === mealType);

    if (index < 0) {
      return;
    }

    const entry = this.mealPlans[index];

    this.mealPlans[index] = {
      ...entry,
      servingsByRecipe: {
        ...(entry.servingsByRecipe ?? {}),
        [recipeId]: servings,
      },
    };

    this.syncMealPlanMap();
  }

  getRecipeServings(dateKey: string, mealType: MealType, recipeId?: string): number {
    const entry = this.getDateForCell(dateKey, mealType);

    if (!entry) {
      return 1;
    }

    if (!recipeId) {
      return entry.servings ?? 1;
    }

    const servings = entry.servingsByRecipe?.[recipeId];
    return typeof servings === 'number' ? servings : entry.servings ?? 1;
  }

  getShoppingList(): Array<{ name: string; checked: boolean }> {
    const aggregate: Record<string, number> = {};

    for (const entry of this.mealPlans) {
      const recipes = this.getSlotRecipes(entry);

      for (const recipe of recipes) {
        if (!recipe?.ingredients) {
          continue;
        }

        for (const ingredient of recipe.ingredients) {
          const clean = ingredient.trim();

          if (!clean) {
            continue;
          }

          const key = clean.toLowerCase();
          aggregate[key] = (aggregate[key] ?? 0) + 1;
        }
      }
    }

    return Object.entries(aggregate)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, count]) => ({
        name: this.formatIngredientDisplay(name, count),
        checked: this.checkedShoppingItems[name] ?? false,
      }));
  }

  toggleShoppingItem(itemName: string): void {
    const key = itemName.toLowerCase();
    this.checkedShoppingItems[key] = !(this.checkedShoppingItems[key] ?? false);
  }

  startCookMode(recipe: Recipe | null): void {
    if (!recipe) {
      return;
    }

    const cleanedSteps = (recipe.steps || []).filter((step) => step && step.trim().length > 0);

    if (!cleanedSteps.length) {
      this.error = 'This recipe does not have any steps to cook.';
      this.cleanupCookMode();
      return;
    }

    if (!this.isSpeechSupported()) {
      this.error = 'Your browser does not support speech synthesis.';
      this.cleanupCookMode();
      return;
    }

    this.error = '';
    this.cleanupCookMode();
    this.cookModeRecipe = recipe;
    this.cookModeSteps = cleanedSteps;
    this.cookModeCurrentIndex = 0;
    this.cookModeIsActive = true;
    this.cookModeIsPaused = false;
    this.speakCurrentStep();
  }

  pauseCookMode(): void {
    if (!this.cookModeIsActive || !this.isSpeechSupported()) {
      return;
    }

    this.cookModeIsPaused = true;
    window.speechSynthesis.pause();
  }

  resumeCookMode(): void {
    if (!this.cookModeIsActive || !this.isSpeechSupported()) {
      return;
    }

    this.cookModeIsPaused = false;
    window.speechSynthesis.resume();
  }

  stopCookMode(): void {
    this.cleanupCookMode();
  }

  previousCookStep(): void {
    if (!this.cookModeRecipe || this.cookModeSteps.length === 0) {
      return;
    }

    this.cookModeCurrentIndex = Math.max(0, this.cookModeCurrentIndex - 1);
    this.speakCurrentStep();
  }

  nextCookStep(): void {
    if (!this.cookModeRecipe || this.cookModeSteps.length === 0) {
      return;
    }

    if (this.cookModeCurrentIndex < this.cookModeSteps.length - 1) {
      this.cookModeCurrentIndex += 1;
      this.speakCurrentStep();
      return;
    }

    this.stopCookMode();
  }

  get cookModeStep(): string {
    return this.cookModeSteps[this.cookModeCurrentIndex] ?? '';
  }

  get cookModeProgress(): number {
    if (!this.cookModeSteps.length) {
      return 0;
    }

    return ((this.cookModeCurrentIndex + 1) / this.cookModeSteps.length) * 100;
  }

  private speakCurrentStep(): void {
    if (!this.cookModeRecipe || !this.cookModeSteps.length || !this.isSpeechSupported()) {
      return;
    }

    const currentStep = this.cookModeSteps[this.cookModeCurrentIndex];
    if (!currentStep) {
      return;
    }

    const SpeechCtor = this.getSpeechUtteranceCtor();
    window.speechSynthesis.cancel();
    this.speechUtterance = new SpeechCtor(currentStep);
    this.speechUtterance.rate = 0.96;
    this.speechUtterance.pitch = 1;
    this.speechUtterance.onend = () => {
      if (!this.cookModeIsActive || this.cookModeIsPaused) {
        return;
      }

      if (this.cookModeCurrentIndex < this.cookModeSteps.length - 1) {
        this.cookModeCurrentIndex += 1;
        this.speakCurrentStep();
      } else {
        this.stopCookMode();
      }
    };
    window.speechSynthesis.speak(this.speechUtterance);
  }

  private cleanupCookMode(): void {
    this.cookModeIsActive = false;
    this.cookModeIsPaused = false;
    this.cookModeCurrentIndex = 0;
    this.cookModeRecipe = null;
    this.cookModeSteps = [];

    if (this.isSpeechSupported()) {
      window.speechSynthesis.cancel();
    }

    this.speechUtterance = null;
  }

  private isSpeechSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.speechSynthesis &&
      typeof window.speechSynthesis.cancel === 'function' &&
      typeof window.speechSynthesis.speak === 'function'
    );
  }

  private getSpeechUtteranceCtor(): typeof SpeechSynthesisUtterance {
    if (typeof SpeechSynthesisUtterance !== 'undefined') {
      return SpeechSynthesisUtterance;
    }

    if (typeof (window as any).SpeechSynthesisUtterance !== 'undefined') {
      return (window as any).SpeechSynthesisUtterance;
    }

    const FallbackCtor = function SpeechSynthesisUtteranceFallback(this: SpeechSynthesisUtterance, text: string) {
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.lang = 'en-US';
      this.onend = null;
    } as unknown as typeof SpeechSynthesisUtterance;

    return FallbackCtor;
  }

  previousWeek(): void {
    const startDate = this.parseDateKey(this.selectedWeekStart);
    const previous = new Date(startDate);
    previous.setDate(previous.getDate() - 7);
    this.selectedWeekStart = this.formatDateKey(previous);
    this.activeWeekNavigation = 'previous';
    this.weekDays = this.buildWeekDays(this.selectedWeekStart);
    this.loadWeeklyPlan();
  }

  nextWeek(): void {
    const startDate = this.parseDateKey(this.selectedWeekStart);
    const next = new Date(startDate);
    next.setDate(next.getDate() + 7);
    this.selectedWeekStart = this.formatDateKey(next);
    this.activeWeekNavigation = 'next';
    this.weekDays = this.buildWeekDays(this.selectedWeekStart);
    this.loadWeeklyPlan();
  }

  jumpToCurrentWeek(): void {
    this.selectedWeekStart = this.getStartOfCurrentWeek();
    this.activeWeekNavigation = 'this';
    this.weekDays = this.buildWeekDays(this.selectedWeekStart);
    this.loadWeeklyPlan();
  }

  private buildWeekDays(weekStartKey: string): WeekDay[] {
    const startDate = this.parseDateKey(weekStartKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + index);

      const key = this.formatDateKey(current);

      return {
        key,
        label: `${current.getDate()}`,
        dayName: this.getDayName(current),
        isToday: this.isSameDate(current, today),
      };
    });
  }

  private formatIngredientDisplay(name: string, count: number): string {
    const base = name.replace(/^\s+|\s+$/g, '');

    if (count <= 1) {
      return base;
    }

    return `${base} × ${count}`;
  }

  private normalizeDateKey(value: string | null | undefined): string {
    if (!value) {
      return this.formatDateKey(new Date());
    }

    const trimmed = String(value).trim();
    const match = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (!match) {
      return this.formatDateKey(new Date());
    }

    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return this.formatDateKey(parsed);
  }

  private normalizeMealType(value: string | MealType | null | undefined): MealType {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (normalized === 'breakfast' || normalized === 'lunch' || normalized === 'dinner') {
      return normalized;
    }

    return 'breakfast';
  }

  private parseDateKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getStartOfCurrentWeek(): string {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const dayIndex = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayIndex);
    return this.formatDateKey(start);
  }

  private getDayName(date: Date): string {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][date.getDay() === 0 ? 6 : date.getDay() - 1];
  }

  private isSameDate(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }
}
