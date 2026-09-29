import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { FavouritesPage } from './favourites';
import { FavouritesService } from '../../services/favourites';
import { Recipe } from '../../models/recipe';

describe('FavouritesPage', () => {
  const recipes = signal<Recipe[]>([]);
  const loading = signal(false);
  const lastSuccess = signal('');
  const lastError = signal('');
  const pendingRecipeId = signal<string | null>(null);

  const favouritesServiceMock = {
    favouriteRecipes: recipes,
    loading,
    lastSuccess,
    lastError,
    loadFavourites: vi.fn(),
    toggleFavourite: vi.fn(),
    clearMessages: vi.fn(),
    isToggling: (recipeId: string) => pendingRecipeId() === recipeId,
  };

  let fixture: ComponentFixture<FavouritesPage>;

  const createRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    _id: 'recipe-1',
    title: 'Lemon Pasta',
    ingredients: ['Pasta', 'Lemon', 'Olive oil'],
    steps: ['Boil the pasta', 'Toss with lemon'],
    category: 'Italian',
    mealCategory: 'Dinner',
    image: 'https://example.com/pasta.jpg',
    user: 'user-1',
    rating: { average: 4.5, count: 2, mine: null },
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    favouritesServiceMock.toggleFavourite.mockReset();

    recipes.set([]);
    loading.set(false);
    lastSuccess.set('');
    lastError.set('');
    pendingRecipeId.set(null);

    await TestBed.configureTestingModule({
      imports: [FavouritesPage],
      providers: [
        provideRouter([]),
        { provide: FavouritesService, useValue: favouritesServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FavouritesPage);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('loads the saved favourites when the page opens', () => {
    recipes.set([
      createRecipe({ _id: 'recipe-1', title: 'Lemon Pasta' }),
      createRecipe({ _id: 'recipe-2', title: 'Tomato Soup' }),
    ]);

    fixture.detectChanges();

    // The page reads the list again instead of trusting the session cache.
    expect(favouritesServiceMock.loadFavourites).toHaveBeenCalledWith(true);

    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.favourite-card');

    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('h3')?.textContent).toContain(
      'Lemon Pasta'
    );
    expect(cards[0].querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/pasta.jpg'
    );
    expect(cards[0].querySelector('.category-pill')?.textContent).toContain(
      'Italian'
    );

    // Everything on this page is saved, so every heart is filled.
    expect(cards[0].querySelector('.fav-btn')?.textContent).toContain(
      '♥ Favourited'
    );
  });

  it('shows the loading state while the favourites are fetched', () => {
    loading.set(true);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.spinner')).toBeTruthy();
    expect(compiled.textContent).toContain('Gathering your favourites');
    expect(compiled.querySelector('.favourite-card')).toBeNull();
  });

  it('shows the empty state with a link to browse recipes', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.empty-state');

    expect(emptyState?.textContent).toContain('No favourites yet');

    const browseLink = emptyState?.querySelector('a.primary-btn');

    expect(browseLink?.textContent).toContain('Find recipes to save');
    expect(browseLink?.getAttribute('href')).toBe('/recipes');
  });

  it('removes a favourite from the page without a reload', () => {
    recipes.set([
      createRecipe({ _id: 'recipe-1', title: 'Lemon Pasta' }),
      createRecipe({ _id: 'recipe-2', title: 'Tomato Soup' }),
    ]);

    // The service drops the recipe from the list once the API answers.
    favouritesServiceMock.toggleFavourite.mockImplementation(
      (recipeId: string) => {
        pendingRecipeId.set(recipeId);

        recipes.update((list) =>
          list.filter((recipe) => recipe._id !== recipeId)
        );

        pendingRecipeId.set(null);
        lastSuccess.set('Recipe removed from favourites.');
      }
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.fav-btn')
    );

    buttons[0].click();
    fixture.detectChanges();

    expect(favouritesServiceMock.toggleFavourite).toHaveBeenCalledWith(
      'recipe-1'
    );

    // The removed card is gone straight away, without reloading the page.
    expect(compiled.querySelectorAll('.favourite-card')).toHaveLength(1);
    expect(compiled.textContent).toContain('Tomato Soup');
    expect(compiled.textContent).not.toContain('Lemon Pasta');
    expect(
      compiled.querySelector('.success-alert')?.textContent
    ).toContain('removed from favourites');
  });

  it('shows an error state when the favourites request fails', () => {
    lastError.set('Unable to load your favourites. Please try again.');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorState = compiled.querySelector('.error-state');

    expect(errorState?.textContent).toContain(
      'Unable to load your favourites'
    );

    const retryButton = errorState?.querySelector<HTMLButtonElement>(
      'button'
    );

    retryButton?.click();

    // Trying again clears the old message and asks the API once more.
    expect(favouritesServiceMock.clearMessages).toHaveBeenCalled();
    expect(favouritesServiceMock.loadFavourites).toHaveBeenCalledTimes(2);
  });

  it('keeps the saved cards when a removal fails', () => {
    recipes.set([createRecipe({ _id: 'recipe-1', title: 'Lemon Pasta' })]);
    lastError.set('Unable to update favourites. Please try again.');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // The alert explains the failure while the card stays on screen.
    expect(compiled.querySelector('.error-alert')?.textContent).toContain(
      'Unable to update favourites'
    );
    expect(compiled.querySelector('.favourite-card')).toBeTruthy();
    expect(compiled.querySelector('.error-state')).toBeNull();
  });

  it('falls back to a placeholder when a saved recipe has no image', () => {
    recipes.set([createRecipe({ image: '' })]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.favourite-card img')).toBeNull();
    expect(
      compiled.querySelector('.favourite-card-image.placeholder')
        ?.textContent
    ).toContain('Savoré');
  });
});
