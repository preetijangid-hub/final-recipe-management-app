import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CollectionService } from './collection';
import { environment } from '../../environments/environment';

describe('CollectionService', () => {
  let service: CollectionService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(CollectionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('getMyCollections requests a page with pagination params', () => {
    service.getMyCollections(2, 9).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections?page=2&limit=9`
    );

    expect(request.request.method).toBe('GET');

    request.flush({
      collections: [],
      pagination: {
        page: 2,
        limit: 9,
        total: 0,
        totalPages: 1,
      },
    });
  });

  it('createCollection posts the collection name', () => {
    service.createCollection('Weekend meals').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Weekend meals',
      description: '',
      coverImage: '',
    });

    request.flush({
      message: 'Collection created successfully.',
      collection: {
        _id: 'col-1',
        name: 'Weekend meals',
        recipeCount: 0,
        coverImage: null,
      },
    });
  });

  it('addRecipe posts the recipe id to the collection', () => {
    service.addRecipe('col-1', 'recipe-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections/col-1/recipes`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      recipeId: 'recipe-1',
    });

    request.flush({
      message: 'Recipe added to the collection.',
      recipeCount: 1,
    });
  });

  it('removeRecipe sends a DELETE to the collection recipe URL', () => {
    service.removeRecipe('col-1', 'recipe-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections/col-1/recipes/recipe-1`
    );

    expect(request.request.method).toBe('DELETE');

    request.flush({
      message: 'Recipe removed from the collection.',
      recipeCount: 0,
    });
  });

  it('createCollection sends the description and cover image', () => {
    service
      .createCollection('Weekend meals', {
        description: 'Sunday cooking',
        coverImage: 'https://res.cloudinary.com/demo/cover.jpg',
      })
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Weekend meals',
      description: 'Sunday cooking',
      coverImage: 'https://res.cloudinary.com/demo/cover.jpg',
    });

    request.flush({
      message: 'Collection created successfully.',
      collection: {
        _id: 'col-1',
        name: 'Weekend meals',
        recipeCount: 0,
        coverImage: 'https://res.cloudinary.com/demo/cover.jpg',
      },
    });
  });

  it('updateCoverImage patches the cover of a collection', () => {
    service.updateCoverImage('col-1', '').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections/col-1/cover`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ coverImage: '' });

    request.flush({
      message: 'Collection cover removed.',
      collection: {
        _id: 'col-1',
        name: 'Weekend meals',
        recipeCount: 0,
        coverImage: null,
      },
    });
  });

  it('enableSharing posts to the share URL', () => {
    service.enableSharing('col-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections/col-1/share`
    );

    expect(request.request.method).toBe('POST');

    request.flush({
      message: 'Public sharing is on for this collection.',
      collection: {
        _id: 'col-1',
        name: 'Weekend meals',
        recipeCount: 0,
        coverImage: null,
        shareToken: 'token-one',
      },
    });
  });

  it('regenerateShareLink asks for a new link', () => {
    service.regenerateShareLink('col-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections/col-1/share/regenerate`
    );

    expect(request.request.method).toBe('POST');

    request.flush({
      message: 'A new link was created. The old link no longer works.',
      collection: {
        _id: 'col-1',
        name: 'Weekend meals',
        recipeCount: 0,
        coverImage: null,
        shareToken: 'token-two',
      },
    });
  });

  it('disableSharing deletes the public link', () => {
    service.disableSharing('col-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/collections/col-1/share`
    );

    expect(request.request.method).toBe('DELETE');

    request.flush({
      message: 'Public sharing is off. The old link no longer works.',
      collection: {
        _id: 'col-1',
        name: 'Weekend meals',
        recipeCount: 0,
        coverImage: null,
        shareToken: null,
      },
    });
  });

  it('getSharedCollection reads the public endpoint', () => {
    service.getSharedCollection('token-one').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/public/collections/token-one`
    );

    expect(request.request.method).toBe('GET');

    request.flush({
      collection: {
        name: 'Shared shelf',
        description: '',
        coverImage: null,
        recipeCount: 0,
        recipes: [],
      },
    });
  });
});
