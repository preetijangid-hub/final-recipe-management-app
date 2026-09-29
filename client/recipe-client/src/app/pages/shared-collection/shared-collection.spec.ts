import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SharedCollectionPage } from './shared-collection';
import { CollectionService } from '../../services/collection';

describe('SharedCollectionPage', () => {
  const collectionServiceMock = {
    getSharedCollection: vi.fn(),
  };

  const routeMock = {
    snapshot: { paramMap: convertToParamMap({ token: 'token-one' }) },
  };

  const routerMock = {
    navigate: vi.fn(() => Promise.resolve(true)),
  };

  const sharedCollection = {
    name: 'Shared shelf',
    description: 'Recipes I cook on Sundays',
    coverImage: 'https://res.cloudinary.com/demo/cover.jpg',
    recipeCount: 1,
    recipes: [
      {
        _id: 'recipe-1',
        title: 'Shared Pasta',
        image: 'https://example.com/pasta.jpg',
        category: 'Italian',
      },
    ],
  };

  const flushAsyncWork = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    routeMock.snapshot.paramMap = convertToParamMap({ token: 'token-one' });

    await TestBed.configureTestingModule({
      imports: [SharedCollectionPage],
      providers: [
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: Router, useValue: routerMock },
        { provide: CollectionService, useValue: collectionServiceMock },
      ],
    }).compileComponents();
  });

  it('shows the collection name, description, cover and recipes', async () => {
    collectionServiceMock.getSharedCollection.mockReturnValue(
      of({ collection: sharedCollection })
    );

    const fixture: ComponentFixture<SharedCollectionPage> =
      TestBed.createComponent(SharedCollectionPage);

    fixture.detectChanges();
    await flushAsyncWork();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      collectionServiceMock.getSharedCollection
    ).toHaveBeenCalledWith('token-one');

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Shared shelf'
    );
    expect(compiled.querySelector('.description')?.textContent).toContain(
      'Recipes I cook on Sundays'
    );
    expect(compiled.querySelector('.cover img')?.getAttribute('src')).toBe(
      sharedCollection.coverImage
    );
    expect(compiled.querySelector('.recipe-card h2')?.textContent).toContain(
      'Shared Pasta'
    );
    expect(compiled.querySelector('.state-card')).toBeNull();

    fixture.destroy();
  });

  it('shows a friendly message when the link is no longer available', async () => {
    collectionServiceMock.getSharedCollection.mockReturnValue(
      throwError(() => ({ status: 404 }))
    );

    const fixture = TestBed.createComponent(SharedCollectionPage);

    fixture.detectChanges();
    await flushAsyncWork();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('no longer available');
    expect(compiled.querySelector('.recipe-card')).toBeNull();

    fixture.destroy();
  });

  it('does not call the API without a token in the link', async () => {
    routeMock.snapshot.paramMap = convertToParamMap({});

    const fixture = TestBed.createComponent(SharedCollectionPage);

    fixture.detectChanges();
    await flushAsyncWork();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(collectionServiceMock.getSharedCollection).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('no longer available');

    fixture.destroy();
  });
});
