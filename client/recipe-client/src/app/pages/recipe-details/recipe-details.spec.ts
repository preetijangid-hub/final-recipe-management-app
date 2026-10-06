import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of } from 'rxjs';

import { RecipeDetails } from './recipe-details';
import { SimilarRecipes } from './similar-recipes';
import { FavouritesService } from '../../services/favourites';
import { RecipeService } from '../../services/recipe';
import { Recipe } from '../../models/recipe';
import { RecipeEmbeddingsService } from '../../services/recipe-embeddings';

@Component({
  standalone: true,
  template: '',
})
class RecipeDetailsTarget {}

describe('RecipeDetails', () => {
  let routeParams: BehaviorSubject<ParamMap>;
  let requestedRecipeIds: string[];

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({}));
    requestedRecipeIds = [];

    await TestBed.configureTestingModule({
      imports: [RecipeDetails],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: routeParams.asObservable() },
        },
        {
          provide: RecipeService,
          useValue: {
            getRecipeById: (recipeId: string) => {
              requestedRecipeIds.push(recipeId);

              return of({
                recipe: {
                  _id: recipeId,
                  title: `Recipe ${recipeId}`,
                  ingredients: [],
                  steps: [],
                  category: 'Italian',
                  mealCategory: 'Dinner',
                  user: {
                    _id: 'owner-id',
                    name: 'Priya Chef',
                    email: 'priya@example.com',
                    profession: 'Chef',
                  },
                },
              });
            },
          },
        },
        {
          provide: FavouritesService,
          useValue: {
            loadFavourites: () => undefined,
            isFavourite: () => false,
            isToggling: () => false,
            toggleFavourite: () => undefined,
            lastError: () => '',
          },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RecipeDetails);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should report a missing recipe id as an error state', () => {
    const fixture = TestBed.createComponent(RecipeDetails);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage).toContain(
      'Recipe ID was not found'
    );
  });

  it('loads each recipe when the route id changes', () => {
    const fixture = TestBed.createComponent(RecipeDetails);
    fixture.detectChanges();

    routeParams.next(convertToParamMap({ id: '65a123456789012345678901' }));
    routeParams.next(convertToParamMap({ id: '65b123456789012345678902' }));

    expect(requestedRecipeIds).toEqual([
      '65a123456789012345678901',
      '65b123456789012345678902',
    ]);
    expect(fixture.componentInstance.recipe?._id).toBe(
      '65b123456789012345678902'
    );

    fixture.destroy();
  });

  it('shows the creator name linked to the public creator profile', () => {
    const fixture = TestBed.createComponent(RecipeDetails);
    fixture.detectChanges();

    routeParams.next(convertToParamMap({ id: '65a123456789012345678901' }));
    fixture.detectChanges();

    const link = (
      fixture.nativeElement as HTMLElement
    ).querySelector('.recipe-author a.author-link') as HTMLAnchorElement;

    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Priya Chef');
    expect(link.getAttribute('href')).toBe('/creators/owner-id');

    const profession = link.querySelector('.author-profession');

    expect(profession?.textContent).toContain('Chef');

    fixture.destroy();
  });

  it('navigates each similar recipe card to its own details route', async () => {
    await TestBed.configureTestingModule({
      imports: [SimilarRecipes],
      providers: [
        provideRouter([
          { path: 'recipes/:id', component: RecipeDetailsTarget },
        ]),
        {
          provide: RecipeService,
          useValue: {},
        },
        {
          provide: RecipeEmbeddingsService,
          useValue: {
            modelLoading: () => false,
            unavailable: () => false,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SimilarRecipes);
    const recipe = (id: string, title: string): Recipe => ({
      _id: id,
      title,
      ingredients: ['Tomato'],
      steps: ['Cook'],
      category: 'Italian',
      mealCategory: 'Dinner',
      user: 'owner-id',
    });

    fixture.componentInstance.recipe = recipe(
      '65a123456789012345678901',
      'Original recipe'
    );
    fixture.componentInstance.suggestions.set([
      {
        recipe: recipe('65b123456789012345678902', 'First suggestion'),
        score: 0.9,
      },
      {
        recipe: recipe('65c123456789012345678903', 'Second suggestion'),
        score: 0.8,
      },
    ]);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll(
      'a.ai-card'
    ) as NodeListOf<HTMLAnchorElement>;
    const router = TestBed.inject(Router);

    expect(cards).toHaveLength(2);

    cards[0].click();
    await fixture.whenStable();
    expect(router.url).toBe('/recipes/65b123456789012345678902');

    cards[1].click();
    await fixture.whenStable();
    expect(router.url).toBe('/recipes/65c123456789012345678903');

    fixture.destroy();
  });
});

