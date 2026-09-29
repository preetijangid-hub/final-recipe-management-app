import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { FavouritesService } from './favourites';
import { environment } from '../../environments/environment';

describe('FavouritesService', () => {
  let service: FavouritesService;
  let httpTesting: HttpTestingController;

  const favouritesUrl = `${environment.apiBaseUrl}/favourites`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(FavouritesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  // Simulates a browser reload: the app starts again, so a brand new
  // service instance has to read the saved favourites from the API.
  const startNewSession = (): void => {
    httpTesting.verify();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(FavouritesService);
    httpTesting = TestBed.inject(HttpTestingController);
  };

  it('loads the favourite recipe ids from the API response', () => {
    service.loadFavourites();
    service.loadFavourites();

    const request = httpTesting.expectOne(favouritesUrl);
    expect(request.request.method).toBe('GET');

    // The API answers with the saved recipes themselves.
    request.flush({
      favourites: [
        { _id: 'recipe-1', title: 'Favourite Pasta' },
        { _id: 'recipe-2', title: 'Favourite Salad' },
      ],
    });

    expect(service.isFavourite('recipe-1')).toBe(true);
    expect(service.isFavourite('recipe-2')).toBe(true);
    expect(service.isFavourite('recipe-3')).toBe(false);
  });

  it('adds a recipe to favourites and updates the state', () => {
    service.loadFavourites();

    httpTesting
      .expectOne(favouritesUrl)
      .flush({ favourites: [] });

    service.toggleFavourite('recipe-1');

    const request = httpTesting.expectOne(
      `${favouritesUrl}/recipe-1`
    );
    expect(request.request.method).toBe('POST');

    request.flush({
      message: 'Recipe added to favourites.',
    });

    expect(service.isFavourite('recipe-1')).toBe(true);
    expect(service.lastSuccess()).toContain('added');
    expect(service.hasPendingToggle()).toBe(false);
  });

  it('removes a recipe from favourites and updates the state', () => {
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [{ _id: 'recipe-1', title: 'Favourite Pasta' }],
    });

    expect(service.isFavourite('recipe-1')).toBe(true);

    service.toggleFavourite('recipe-1');

    const request = httpTesting.expectOne(
      `${favouritesUrl}/recipe-1`
    );
    expect(request.request.method).toBe('DELETE');

    request.flush({
      message: 'Recipe removed from favourites.',
    });

    expect(service.isFavourite('recipe-1')).toBe(false);
    expect(service.lastSuccess()).toContain('removed');
  });

  it('ignores a second toggle while a request is running', () => {
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [],
    });

    service.toggleFavourite('recipe-1');
    service.toggleFavourite('recipe-2');

    // Only the first request is sent; the second click is ignored.
    const request = httpTesting.expectOne(
      `${favouritesUrl}/recipe-1`
    );

    expect(request.request.method).toBe('POST');

    httpTesting.expectNone(`${favouritesUrl}/recipe-2`);

    request.flush({ message: 'Recipe added to favourites.' });
  });

  it('stores an error message when the toggle fails', () => {
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [],
    });

    service.toggleFavourite('recipe-1');

    httpTesting
      .expectOne(`${favouritesUrl}/recipe-1`)
      .flush(
        { message: 'Recipe not found' },
        { status: 404, statusText: 'Not Found' }
      );

    expect(service.lastError()).toBe('Recipe not found');
    expect(service.isFavourite('recipe-1')).toBe(false);
  });

  it('clears the cached favourites when the user signs out', () => {
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [{ _id: 'recipe-1', title: 'Favourite Pasta' }],
    });

    expect(service.isFavourite('recipe-1')).toBe(true);

    service.reset();

    expect(service.isFavourite('recipe-1')).toBe(false);
    expect(service.lastError()).toBe('');
    expect(service.hasPendingToggle()).toBe(false);

    // The next visit loads the list again instead of trusting the cache.
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({ favourites: [] });
  });

  it('restores the saved favourites after a page reload', () => {
    // First visit: nothing is favourited yet.
    service.loadFavourites();
    httpTesting.expectOne(favouritesUrl).flush({ favourites: [] });

    service.toggleFavourite('recipe-1');
    httpTesting
      .expectOne(`${favouritesUrl}/recipe-1`)
      .flush({ message: 'Recipe added to favourites.' });

    expect(service.isFavourite('recipe-1')).toBe(true);

    // After the reload the filled heart has to come back from the API.
    startNewSession();

    service.loadFavourites();
    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [{ _id: 'recipe-1', title: 'Favourite Pasta' }],
    });

    expect(service.isFavourite('recipe-1')).toBe(true);

    // A removal is saved as well, so the next reload shows an empty heart.
    service.toggleFavourite('recipe-1');
    httpTesting
      .expectOne(`${favouritesUrl}/recipe-1`)
      .flush({ message: 'Recipe removed from favourites.' });

    expect(service.isFavourite('recipe-1')).toBe(false);

    startNewSession();

    service.loadFavourites();
    httpTesting.expectOne(favouritesUrl).flush({ favourites: [] });

    expect(service.isFavourite('recipe-1')).toBe(false);
  });

  it('keeps the saved recipes for the favourites page', () => {
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [
        { _id: 'recipe-1', title: 'Favourite Pasta' },
        { _id: 'recipe-2', title: 'Favourite Salad' },
      ],
    });

    expect(service.favouriteRecipes()).toHaveLength(2);
    expect(service.favouriteRecipes()[0].title).toBe('Favourite Pasta');

    service.toggleFavourite('recipe-1');

    httpTesting
      .expectOne(`${favouritesUrl}/recipe-1`)
      .flush({ message: 'Recipe removed from favourites.' });

    // A removed recipe leaves both the ids and the saved list.
    expect(service.isFavourite('recipe-1')).toBe(false);
    expect(service.favouriteRecipes()).toHaveLength(1);
    expect(service.favouriteRecipes()[0]._id).toBe('recipe-2');
  });

  it('loads the list again when the favourites page asks for a reload', () => {
    service.loadFavourites();

    httpTesting.expectOne(favouritesUrl).flush({ favourites: [] });

    // A second call without reload is answered from the cache.
    service.loadFavourites();
    httpTesting.expectNone(favouritesUrl);

    service.loadFavourites(true);

    httpTesting.expectOne(favouritesUrl).flush({
      favourites: [{ _id: 'recipe-2', title: 'Favourite Salad' }],
    });

    expect(service.isFavourite('recipe-2')).toBe(true);
    expect(service.favouriteRecipes()).toHaveLength(1);
  });

  it('keeps the previous state when the favourites list fails to load', () => {
    service.loadFavourites();

    httpTesting
      .expectOne(favouritesUrl)
      .flush(
        { message: 'Not authorized.' },
        { status: 401, statusText: 'Unauthorized' }
      );

    // Nothing is marked as favourited and the user is told what happened.
    expect(service.isFavourite('recipe-1')).toBe(false);
    expect(service.lastError()).toContain('Unable to load your favourites');
  });
});
