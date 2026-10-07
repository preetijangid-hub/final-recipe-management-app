import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { MealPlannerPage } from './meal-planner';
import { MealPlanEntry } from '../../models/meal-plan';
import { Recipe } from '../../models/recipe';
import { MealPlanService } from '../../services/meal-plan';
import { RecipeService } from '../../services/recipe';
import { ShoppingListService } from '../../services/shopping-list';

describe('MealPlannerPage', () => {
  const recipeServiceMock = {
    getRecipes: vi.fn(),
  };

  const mealPlanServiceMock = {
    getWeekPlan: vi.fn(),
    saveMealPlan: vi.fn(),
    removeRecipeFromMealPlan: vi.fn(),
    removeMealPlan: vi.fn(),
  };

  const shoppingListServiceMock = {
    refreshWeekShoppingList: vi.fn(() => of({ shoppingList: { _id: 'list-1' } })),
  };

  const sampleRecipe: Recipe = {
    _id: 'recipe-1',
    title: 'Vegetable Bowl',
    ingredients: ['2 tomatoes', '1 cup rice'],
    steps: ['Wash the ingredients.', 'Cook and serve.'],
    category: 'Indian',
    mealCategory: 'Dinner',
    user: 'user-1',
  };

  const secondRecipe: Recipe = {
    _id: 'recipe-2',
    title: 'Pancakes',
    ingredients: ['2 eggs', '1 cup flour'],
    steps: ['Mix batter.', 'Cook until golden.'],
    category: 'Breakfast',
    mealCategory: 'Breakfast',
    user: 'user-1',
  };

  let fixture: ComponentFixture<MealPlannerPage>;
  let component: MealPlannerPage;

  beforeEach(async () => {
    vi.clearAllMocks();

    recipeServiceMock.getRecipes.mockReturnValue(of({ recipes: [sampleRecipe, secondRecipe] }));
    mealPlanServiceMock.getWeekPlan.mockReturnValue(of({ mealPlans: [] }));
    mealPlanServiceMock.saveMealPlan.mockImplementation(({ recipe }) =>
      of({
        mealPlan: {
          _id: 'entry-1',
          date: '2026-10-05',
          mealType: 'breakfast',
          servings: 2,
          recipes: [sampleRecipe, secondRecipe].filter((item) => item._id === recipe || item._id === 'recipe-1'),
          recipe: sampleRecipe,
        },
      })
    );
    mealPlanServiceMock.removeRecipeFromMealPlan.mockReturnValue(
      of({
        message: 'Recipe removed from meal plan.',
        emptied: false,
        mealPlan: {
          _id: 'entry-1',
          date: '2026-10-05',
          mealType: 'breakfast',
          servings: 2,
          recipes: [secondRecipe],
          recipe: secondRecipe,
        },
      })
    );
    mealPlanServiceMock.removeMealPlan.mockReturnValue(of({ message: 'Removed', id: 'entry-1' }));
    shoppingListServiceMock.refreshWeekShoppingList.mockReturnValue(of({ shoppingList: { _id: 'list-1' } }));

    await TestBed.configureTestingModule({
      imports: [MealPlannerPage],
      providers: [
        provideRouter([]),
        { provide: RecipeService, useValue: recipeServiceMock },
        { provide: MealPlanService, useValue: mealPlanServiceMock },
        { provide: ShoppingListService, useValue: shoppingListServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealPlannerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a seven-day week grid', () => {
    expect(component.weekDays.length).toBe(7);
    expect(component.availableRecipes).toEqual([sampleRecipe, secondRecipe]);
  });

  it('hydrates multiple saved recipes into the correct calendar cell on reload', () => {
    const persistedEntry: MealPlanEntry = {
      _id: 'entry-reload',
      date: '2026-10-05',
      mealType: 'breakfast',
      servings: 2,
      recipes: [sampleRecipe, secondRecipe],
      recipe: sampleRecipe,
    };

    component.mealPlans = [persistedEntry];
    (component as any).syncMealPlanMap();

    expect(component.getDateForCell('2026-10-05', 'breakfast')).toEqual(
      expect.objectContaining({
        date: '2026-10-05',
        mealType: 'breakfast',
      })
    );
    expect(component.getSlotRecipes(component.getDateForCell('2026-10-05', 'breakfast'))).toHaveLength(2);
    expect(component.getDateForCell('2026-10-06', 'breakfast')).toBeNull();
  });

  it('appends a new recipe to a slot without duplicating an existing one', () => {
    mealPlanServiceMock.getWeekPlan.mockReturnValue(
      of({
        mealPlans: [
          {
            _id: 'entry-2',
            date: '2026-10-05',
            mealType: 'breakfast',
            servings: 2,
            recipes: [sampleRecipe],
            recipe: sampleRecipe,
          },
        ],
      })
    );
    component.jumpToCurrentWeek();

    expect(component.getDateForCell('2026-10-05', 'breakfast')?.recipes).toHaveLength(1);

    component.onRecipeSelected('2026-10-05', 'breakfast', secondRecipe._id);

    expect(mealPlanServiceMock.saveMealPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-10-05',
        mealType: 'breakfast',
        recipe: secondRecipe._id,
      })
    );
  });

  it('removes only one recipe from a slot while keeping the rest', () => {
    mealPlanServiceMock.getWeekPlan.mockReturnValue(
      of({
        mealPlans: [
          {
            _id: 'entry-3',
            date: '2026-10-05',
            mealType: 'breakfast',
            servings: 2,
            recipes: [sampleRecipe, secondRecipe],
            recipe: sampleRecipe,
          },
        ],
      })
    );
    component.jumpToCurrentWeek();

    component.removeMeal('2026-10-05', 'breakfast', sampleRecipe._id);

    expect(mealPlanServiceMock.removeRecipeFromMealPlan).toHaveBeenCalledWith('entry-3', sampleRecipe._id);
  });

  it('keeps servings independent for two recipes in the same meal slot', () => {
    component.mealPlans = [
      {
        _id: 'entry-4',
        date: '2026-10-06',
        mealType: 'breakfast',
        servings: 1,
        servingsByRecipe: {
          [sampleRecipe._id]: 1,
          [secondRecipe._id]: 5,
        },
        recipes: [sampleRecipe, secondRecipe],
        recipe: sampleRecipe,
      },
    ];
    (component as any).syncMealPlanMap();

    expect(component.getRecipeServings('2026-10-06', 'breakfast', sampleRecipe._id)).toBe(1);
    expect(component.getRecipeServings('2026-10-06', 'breakfast', secondRecipe._id)).toBe(5);

    // Mirrors the API: saving one recipe returns the whole slot with only that
    // recipe's serving count changed, and the change is persisted server-side.
    const savedServings: Record<string, number> = {
      [sampleRecipe._id]: 1,
      [secondRecipe._id]: 5,
    };

    mealPlanServiceMock.saveMealPlan.mockImplementation(({ recipe, servings }) => {
      savedServings[recipe] = servings;

      return of({
        message: 'Meal plan saved.',
        mealPlan: {
          _id: 'entry-4',
          date: '2026-10-06',
          mealType: 'breakfast',
          servings: 1,
          servingsByRecipe: { ...savedServings },
          recipes: [sampleRecipe, secondRecipe],
          recipe: sampleRecipe,
        },
      });
    });

    component.updateServings('2026-10-06', 'breakfast', sampleRecipe._id, 1);

    expect(component.getRecipeServings('2026-10-06', 'breakfast', sampleRecipe._id)).toBe(2);
    expect(component.getRecipeServings('2026-10-06', 'breakfast', secondRecipe._id)).toBe(5);

    component.updateServings('2026-10-06', 'breakfast', secondRecipe._id, -1);

    expect(component.getRecipeServings('2026-10-06', 'breakfast', sampleRecipe._id)).toBe(2);
    expect(component.getRecipeServings('2026-10-06', 'breakfast', secondRecipe._id)).toBe(4);
  });

  it('hydrates per-recipe servings from the backend after a reload', () => {
    component.mealPlans = [
      {
        _id: 'entry-5',
        date: '2026-10-06',
        mealType: 'breakfast',
        servings: 4,
        servingsByRecipe: {
          [sampleRecipe._id]: 2,
          [secondRecipe._id]: 4,
        },
        recipes: [sampleRecipe, secondRecipe],
        recipe: sampleRecipe,
      },
    ];
    (component as any).syncMealPlanMap();

    expect(component.getRecipeServings('2026-10-06', 'breakfast', sampleRecipe._id)).toBe(2);
    expect(component.getRecipeServings('2026-10-06', 'breakfast', secondRecipe._id)).toBe(4);
  });

  it('falls back to the slot servings for plans saved without per-recipe servings', () => {
    component.mealPlans = [
      {
        _id: 'entry-6',
        date: '2026-10-06',
        mealType: 'breakfast',
        servings: 3,
        recipes: [sampleRecipe, secondRecipe],
        recipe: sampleRecipe,
      },
    ];
    (component as any).syncMealPlanMap();

    expect(component.getRecipeServings('2026-10-06', 'breakfast', sampleRecipe._id)).toBe(3);
    expect(component.getRecipeServings('2026-10-06', 'breakfast', secondRecipe._id)).toBe(3);
  });

  it('moves through the week without mixing entries between dates', () => {
    component.selectedWeekStart = '2026-10-05';
    component.previousWeek();
    expect(component.selectedWeekStart).toBe('2026-09-28');
    expect(component.activeWeekNavigation).toBe('previous');

    component.nextWeek();
    expect(component.selectedWeekStart).toBe('2026-10-05');
    expect(component.activeWeekNavigation).toBe('next');
  });

  it('updates servings and cook mode state safely', () => {
    component.mealPlans = [
      {
        _id: 'entry-2',
        date: '2026-10-06',
        mealType: 'dinner',
        servings: 2,
        recipes: [sampleRecipe],
        recipe: sampleRecipe,
      },
    ];

    component.updateServings('2026-10-06', 'dinner', sampleRecipe._id, 1);
    expect(mealPlanServiceMock.saveMealPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe: sampleRecipe._id,
        servings: 3,
      })
    );

    const originalWindowSpeechSynthesis = (window as any).speechSynthesis;
    (window as any).speechSynthesis = {
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn(),
    };

    component.startCookMode(sampleRecipe);
    expect(component.cookModeIsActive).toBe(true);
    expect(component.cookModeSteps.length).toBeGreaterThan(0);

    component.pauseCookMode();
    expect(component.cookModeIsPaused).toBe(true);

    component.stopCookMode();
    expect(component.cookModeIsActive).toBe(false);
    (window as any).speechSynthesis = originalWindowSpeechSynthesis;
  });

  it('handles unsupported speech synthesis gracefully', () => {
    const originalSpeech = (window as any).speechSynthesis;
    (window as any).speechSynthesis = undefined;
    component.startCookMode(sampleRecipe);
    expect(component.error).toContain('speech synthesis');
    (window as any).speechSynthesis = originalSpeech;
  });
});
