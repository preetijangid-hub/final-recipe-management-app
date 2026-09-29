import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MyCollectionsPage } from './my-collections';
import { CollectionService } from '../../services/collection';
import { CloudinaryService } from '../../services/cloudinary';
import { CollectionSummary } from '../../models/collection';

describe('MyCollectionsPage', () => {
  // The page reads its page number from the URL, so the mock lets the
  // tests push new params like the router would after a navigation.
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));

  const collectionServiceMock = {
    getMyCollections: vi.fn(),
    getCollectionById: vi.fn(),
    createCollection: vi.fn(),
    removeRecipe: vi.fn(),
    updateCoverImage: vi.fn(),
    enableSharing: vi.fn(),
    disableSharing: vi.fn(),
    regenerateShareLink: vi.fn(),
  };

  const cloudinaryServiceMock = {
    uploadImage: vi.fn(),
  };

  const routerMock = {
    navigate: vi.fn(() => Promise.resolve(true)),
  };

  let fixture: ComponentFixture<MyCollectionsPage>;

  const sampleCollection = {
    _id: 'col-1',
    name: 'Weekend meals',
    recipeCount: 2,
    coverImage: 'https://example.com/pasta.jpg',
  };

  // Response used while a test does not need any collection.
  const emptyPage = {
    collections: [] as CollectionSummary[],
    pagination: { page: 1, limit: 9, total: 0, totalPages: 1 },
  };

  const flushAsyncWork = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  // Sends a picked file to the page, either for a new collection or for
  // an existing card.
  const pickCover = (
    component: MyCollectionsPage,
    file: File,
    collection?: CollectionSummary
  ): void => {
    const event = {
      target: { files: [file], value: 'C:\\fake\\cover.jpg' },
    } as unknown as Event;

    if (collection) {
      component.onCardCoverSelected(event, collection);
      return;
    }

    component.onCoverSelected(event);
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    URL.createObjectURL = vi.fn(
      () => 'blob:cover-preview'
    ) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    await TestBed.configureTestingModule({
      imports: [MyCollectionsPage],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        { provide: Router, useValue: routerMock },
        { provide: CollectionService, useValue: collectionServiceMock },
        { provide: CloudinaryService, useValue: cloudinaryServiceMock },
      ],
    }).compileComponents();

    // The page loads page 1 as soon as it is created, so the service starts
    // with a safe empty response. Tests that need data stub their own
    // response and load the page again.
    collectionServiceMock.getMyCollections.mockReturnValue(of(emptyPage));

    fixture = TestBed.createComponent(MyCollectionsPage);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('renders collection cards with name, count and cover', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    fixture.componentInstance.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    const compiled = fixture.nativeElement as HTMLElement;
    const card = compiled.querySelector('.collection-card');

    expect(card?.querySelector('h3')?.textContent).toContain(
      'Weekend meals'
    );
    expect(card?.querySelector('.recipe-count')?.textContent).toContain('2');
    expect(card?.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/pasta.jpg'
    );
  });

  it('shows the empty state when the user has no collections', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [],
        pagination: { page: 1, limit: 9, total: 0, totalPages: 1 },
      })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.empty-state')?.textContent).toContain(
      'No collections yet'
    );
  });

  it('shows an error message when loading fails', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      throwError(() => ({ error: { message: 'Not authorized.' } }))
    );

    fixture.componentInstance.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    expect(fixture.componentInstance.errorMessage()).toContain(
      'Not authorized.'
    );
  });


  it('falls back to page 1 for an invalid page param', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    queryParamMap.next(convertToParamMap({ page: 'abc' }));
    await flushAsyncWork();

    expect(collectionServiceMock.getMyCollections).toHaveBeenLastCalledWith(
      1,
      9
    );
  });

  it('creates a collection through the modal', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [],
        pagination: { page: 1, limit: 9, total: 0, totalPages: 1 },
      })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;
    component.openCreateModal();
    component.createForm.controls.name.setValue('Weekend meals');

    collectionServiceMock.createCollection.mockReturnValue(
      of({
        message: 'Collection created successfully.',
        collection: sampleCollection,
      })
    );

    component.createCollection();
    await flushAsyncWork();

    expect(collectionServiceMock.createCollection).toHaveBeenCalledWith(
      'Weekend meals',
      { description: '', coverImage: '' }
    );
    expect(component.showCreateModal()).toBe(false);
    expect(component.successMessage()).toContain('created');

    // New collections are shown on page one.
    expect(routerMock.navigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { page: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('blocks creation on invalid names', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [],
        pagination: { page: 1, limit: 9, total: 0, totalPages: 1 },
      })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    component.openCreateModal();
    component.createForm.controls.name.setValue('a');
    component.createCollection();
    await flushAsyncWork();

    expect(collectionServiceMock.createCollection).not.toHaveBeenCalled();
  });

  it('removes a recipe from the expanded collection', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    fixture.componentInstance.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    collectionServiceMock.getCollectionById.mockReturnValue(
      of({
        collection: {
          _id: 'col-1',
          name: 'Weekend meals',
          recipeCount: 1,
          recipes: [{ _id: 'recipe-1', title: 'Pasta', image: '' }],
        },
      })
    );

    component.toggleRecipes(sampleCollection);
    await flushAsyncWork();

    expect(component.selectedCollection()?.recipes).toHaveLength(1);

    collectionServiceMock.removeRecipe.mockReturnValue(
      of({
        message: 'Recipe removed from the collection.',
        recipeCount: 0,
      })
    );

    component.removeRecipe(component.selectedCollection()!, 'recipe-1');
    await flushAsyncWork();

    expect(collectionServiceMock.removeRecipe).toHaveBeenCalledWith(
      'col-1',
      'recipe-1'
    );
    expect(component.selectedCollection()?.recipes).toHaveLength(0);
    expect(component.selectedCollection()?.recipeCount).toBe(0);
  });

  it('navigates to the next page when Next is clicked', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 12, totalPages: 2 },
      })
    );

    fixture.componentInstance.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.pagination button')
    );

    const nextButton = buttons.find((button) =>
      button.textContent?.includes('Next')
    ) as HTMLButtonElement;

    expect(nextButton.disabled).toBe(false);
    nextButton.click();

    expect(routerMock.navigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { page: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('shows the fallback cover when a collection has no image', async () => {
    const component = fixture.componentInstance;

    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [{ ...sampleCollection, coverImage: null }],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    component.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    const cover = (
      fixture.nativeElement as HTMLElement
    ).querySelector('.collection-cover');

    expect(cover?.querySelector('img')).toBeNull();
    expect(cover?.querySelector('.cover-fallback')).not.toBeNull();
  });

  it('uploads the chosen cover while creating a collection', async () => {
    collectionServiceMock.getMyCollections.mockReturnValue(of(emptyPage));
    cloudinaryServiceMock.uploadImage.mockResolvedValue(
      'https://res.cloudinary.com/demo/cover.jpg'
    );
    collectionServiceMock.createCollection.mockReturnValue(
      of({
        message: 'Collection created successfully.',
        collection: {
          ...sampleCollection,
          coverImage: 'https://res.cloudinary.com/demo/cover.jpg',
        },
      })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;
    const coverFile = new File(['cover-bytes'], 'cover.jpg', {
      type: 'image/jpeg',
    });

    component.openCreateModal();
    component.createForm.controls.name.setValue('Weekend meals');
    component.createForm.controls.description.setValue('Sunday cooking');

    pickCover(component, coverFile);

    expect(component.coverPreview()).toBe('blob:cover-preview');

    component.createCollection();
    await flushAsyncWork();

    expect(cloudinaryServiceMock.uploadImage).toHaveBeenCalledWith(coverFile);
    expect(collectionServiceMock.createCollection).toHaveBeenCalledWith(
      'Weekend meals',
      {
        description: 'Sunday cooking',
        coverImage: 'https://res.cloudinary.com/demo/cover.jpg',
      }
    );
  });

  it('refuses covers that are not images or are too large', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    component.openCreateModal();

    pickCover(component, new File(['notes'], 'notes.pdf', {
      type: 'application/pdf',
    }));

    expect(component.errorMessage()).toContain('valid image file');
    expect(component.coverFile()).toBeNull();

    pickCover(
      component,
      new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', {
        type: 'image/jpeg',
      })
    );

    expect(component.errorMessage()).toContain('5 MB');
    expect(cloudinaryServiceMock.uploadImage).not.toHaveBeenCalled();
  });

  it('changes the cover of an existing collection', async () => {
    const component = fixture.componentInstance;

    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    component.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    const newCover = 'https://res.cloudinary.com/demo/new-cover.jpg';

    cloudinaryServiceMock.uploadImage.mockResolvedValue(newCover);
    collectionServiceMock.updateCoverImage.mockReturnValue(
      of({
        message: 'Collection cover updated.',
        collection: { ...sampleCollection, coverImage: newCover },
      })
    );

    const coverFile = new File(['cover-bytes'], 'cover.jpg', {
      type: 'image/jpeg',
    });

    pickCover(component, coverFile, sampleCollection);
    await flushAsyncWork();

    expect(cloudinaryServiceMock.uploadImage).toHaveBeenCalledWith(coverFile);
    expect(collectionServiceMock.updateCoverImage).toHaveBeenCalledWith(
      'col-1',
      newCover
    );
    expect(component.collections()[0].coverImage).toBe(newCover);
    expect(component.updatingCoverId()).toBe('');
  });

  it('keeps the existing cover when the update request fails', async () => {
    const component = fixture.componentInstance;

    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    component.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    cloudinaryServiceMock.uploadImage.mockResolvedValue(
      'https://res.cloudinary.com/demo/new-cover.jpg'
    );
    collectionServiceMock.updateCoverImage.mockReturnValue(
      throwError(() => ({ error: { message: 'Update failed.' } }))
    );

    pickCover(
      component,
      new File(['cover-bytes'], 'cover.jpg', { type: 'image/jpeg' }),
      sampleCollection
    );
    await flushAsyncWork();

    expect(component.collections()[0].coverImage).toBe(
      sampleCollection.coverImage
    );
    expect(component.errorMessage()).toBe('Update failed.');
    expect(component.updatingCoverId()).toBe('');
  });

  it('clears a cover again and reports a failed upload', async () => {
    const component = fixture.componentInstance;

    collectionServiceMock.getMyCollections.mockReturnValue(
      of({
        collections: [sampleCollection],
        pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
      })
    );

    component.loadCollections(1);
    fixture.detectChanges();
    await flushAsyncWork();

    collectionServiceMock.updateCoverImage.mockReturnValue(
      of({
        message: 'Collection cover removed.',
        collection: { ...sampleCollection, coverImage: null },
      })
    );

    component.removeCover(sampleCollection);
    await flushAsyncWork();

    expect(collectionServiceMock.updateCoverImage).toHaveBeenCalledWith(
      'col-1',
      ''
    );
    expect(component.collections()[0].coverImage).toBeNull();

    cloudinaryServiceMock.uploadImage.mockRejectedValue(
      new Error('Cloudinary down')
    );

    pickCover(
      component,
      new File(['cover-bytes'], 'cover.jpg', { type: 'image/jpeg' }),
      sampleCollection
    );
    await flushAsyncWork();

    expect(collectionServiceMock.updateCoverImage).toHaveBeenCalledTimes(1);
    expect(component.errorMessage()).toContain('Unable to upload the cover');
    expect(component.updatingCoverId()).toBe('');
  });

  it('enables sharing and builds the public link', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;
    const privateCollection: CollectionSummary = {
      ...sampleCollection,
      shareToken: null,
    };

    component.openShareModal(privateCollection);

    expect(component.showShareModal()).toBe(true);
    expect(component.shareUrl).toBe('');

    collectionServiceMock.enableSharing.mockReturnValue(
      of({
        message: 'Public sharing is on for this collection.',
        collection: { ...privateCollection, shareToken: 'token-one' },
      })
    );

    component.enableSharing();
    await flushAsyncWork();

    expect(collectionServiceMock.enableSharing).toHaveBeenCalledWith('col-1');
    expect(component.shareMessage()).toContain('Public sharing is on');
    expect(component.shareUrl).toContain('/shared/token-one');
  });

  it('turns sharing off and drops the link', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    component.openShareModal({ ...sampleCollection, shareToken: 'token-one' });

    expect(component.shareUrl).toContain('/shared/token-one');

    collectionServiceMock.disableSharing.mockReturnValue(
      of({
        message: 'Public sharing is off. The old link no longer works.',
        collection: { ...sampleCollection, shareToken: null },
      })
    );

    component.disableSharing();
    await flushAsyncWork();

    expect(collectionServiceMock.disableSharing).toHaveBeenCalledWith('col-1');
    expect(component.shareUrl).toBe('');
    expect(component.shareMessage()).toContain('no longer works');
  });

  it('replaces the link when a new one is generated', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    component.openShareModal({ ...sampleCollection, shareToken: 'token-one' });

    collectionServiceMock.regenerateShareLink.mockReturnValue(
      of({
        message: 'A new link was created. The old link no longer works.',
        collection: { ...sampleCollection, shareToken: 'token-two' },
      })
    );

    component.regenerateShareLink();
    await flushAsyncWork();

    expect(collectionServiceMock.regenerateShareLink).toHaveBeenCalledWith(
      'col-1'
    );
    expect(component.shareUrl).toContain('/shared/token-two');
    expect(component.shareUrl).not.toContain('token-one');
  });

  it('copies the public link to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    component.openShareModal({ ...sampleCollection, shareToken: 'token-one' });
    await component.copyShareLink();

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('/shared/token-one')
    );
    expect(component.copyMessage()).toContain('copied');
  });

  it('keeps the last message when a sharing change fails', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const component = fixture.componentInstance;

    component.openShareModal({ ...sampleCollection, shareToken: null });

    collectionServiceMock.enableSharing.mockReturnValue(
      throwError(() => ({
        error: { message: 'You are not allowed to access this collection.' },
      }))
    );

    component.enableSharing();
    await flushAsyncWork();

    expect(component.errorMessage()).toContain('not allowed');
    expect(component.shareUrl).toBe('');

    component.closeShareModal();

    expect(component.showShareModal()).toBe(false);
    expect(component.sharingCollection()).toBeNull();
  });
});
