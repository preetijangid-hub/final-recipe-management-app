import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { RecipeService } from './recipe';
import { environment } from '../../environments/environment';

describe('RecipeService', () => {
  let service: RecipeService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(RecipeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('getRecipes sends pagination, sort and active filters', () => {
    service
      .getRecipes(2, 9, 'pasta', 'Italian', 'newest', 'Dinner')
      .subscribe();

    const request = httpTesting.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/recipes`
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('9');
    expect(request.request.params.get('sort')).toBe('newest');
    expect(request.request.params.get('search')).toBe('pasta');
    expect(request.request.params.get('category')).toBe('Italian');
    expect(request.request.params.get('mealCategory')).toBe('Dinner');

    request.flush({
      recipes: [],
      pagination: { page: 2, limit: 9, total: 0, totalPages: 0 },
    });
  });

  it('getRecipes leaves empty filters out of the request', () => {
    service.getRecipes().subscribe();

    const request = httpTesting.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/recipes`
    );

    expect(request.request.params.get('search')).toBeNull();
    expect(request.request.params.get('category')).toBeNull();
    expect(request.request.params.get('mealCategory')).toBeNull();

    request.flush({
      recipes: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('createRecipe posts the recipe payload including the meal category', () => {
    service
      .createRecipe({
        title: 'Pancakes',
        ingredients: ['Flour', 'Milk'],
        steps: ['Mix', 'Cook'],
        category: 'American',
        mealCategory: 'Breakfast',
      })
      .subscribe();

    const request = httpTesting.expectOne( 
      `${environment.apiBaseUrl}/recipes`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body.category).toBe('American');
    expect(request.request.body.mealCategory).toBe('Breakfast');

    request.flush({
      recipe: {
        _id: 'recipe-1',
        title: 'Pancakes',
        ingredients: ['Flour', 'Milk'],
        steps: ['Mix', 'Cook'],
        category: 'American',
        mealCategory: 'Breakfast',
      },
    });
  });
});
