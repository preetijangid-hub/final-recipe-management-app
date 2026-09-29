import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { finalize } from 'rxjs';

import {
  CollectionDetail,
  CollectionSummary,
} from '../../models/collection';
import { CollectionService } from '../../services/collection';
import { CloudinaryService } from '../../services/cloudinary';
import {
  exceedsImageSizeLimit,
  isSupportedImage,
} from '../../utils/image-file';

@Component({
  selector: 'app-my-collections',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './my-collections.html',
  styleUrl: './my-collections.css',
})
export class MyCollectionsPage {
  private readonly collectionService = inject(CollectionService);

  private readonly cloudinaryService = inject(CloudinaryService);

  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly fb = inject(FormBuilder);

  readonly pageLimit = 9;

  readonly collections = signal<CollectionSummary[]>([]);

  readonly totalItems = signal(0);

  readonly totalPages = signal(1);

  readonly currentPage = signal(1);

  readonly loading = signal(true);

  readonly errorMessage = signal('');

  readonly successMessage = signal('');

  readonly showCreateModal = signal(false);

  readonly creating = signal(false);

  // Cover picked in the create modal, before the collection exists.
  readonly coverPreview = signal('');

  readonly coverFile = signal<File | null>(null);

  // Cover upload/update state of the cards.
  readonly updatingCoverId = signal('');

  createForm = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
      ],
    ],
    description: ['', [Validators.maxLength(200)]],
  });

  // Public sharing of a single collection.
  readonly showShareModal = signal(false);

  readonly sharingCollection = signal<CollectionSummary | null>(null);

  readonly sharingBusy = signal(false);

  readonly shareMessage = signal('');

  readonly copyMessage = signal('');

  // Expanded collection whose recipes are listed on the page.
  readonly selectedCollection = signal<CollectionDetail | null>(null);

  readonly loadingRecipes = signal(false);

  readonly removingRecipeId = signal('');

  constructor() {
    // The page number lives in the URL, so refreshes and the back
    // button keep the user on the same page.
    this.route.queryParamMap.subscribe((params) => {
      const requested = Number(params.get('page'));
      const page = Number.isInteger(requested) && requested > 0
        ? requested
        : 1;

      this.loadCollections(page);
    });
  }

  loadCollections(page: number): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.collectionService
      .getMyCollections(page, this.pageLimit)
      .subscribe({
        next: (response) => {
          const pagination = response?.pagination;
          const pageCollections = response?.collections ?? [];

          this.totalItems.set(pagination?.total ?? 0);
          this.totalPages.set(pagination?.totalPages ?? 1);

          // Snap back to the last page when a saved page is past the end.
          if (
            page > 1 &&
            pageCollections.length === 0 &&
            pagination &&
            pagination.total > 0
          ) {
            this.goToPage(pagination.totalPages);
            return;
          }

          this.currentPage.set(page);
          this.collections.set(pageCollections);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.errorMessage.set(
            error?.error?.message ||
              'Unable to load your collections.'
          );
          this.collections.set([]);
        },
      });
  }

  goToPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  openCreateModal(): void {
    this.createForm.reset();
    this.clearCreateCover();
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  // Cover for a collection that is still being created.
  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    input.value = '';

    if (!file) {
      return;
    }

    if (!isSupportedImage(file)) {
      this.errorMessage.set('Please choose a valid image file.');
      return;
    }

    if (exceedsImageSizeLimit(file)) {
      this.errorMessage.set('Image must be 5 MB or smaller.');
      return;
    }

    this.errorMessage.set('');
    this.releaseCoverPreview();
    this.coverFile.set(file);
    this.coverPreview.set(URL.createObjectURL(file));
  }

  clearCreateCover(): void {
    this.releaseCoverPreview();
    this.coverFile.set(null);
    this.coverPreview.set('');
  }

  private releaseCoverPreview(): void {
    const preview = this.coverPreview();

    if (preview) {
      URL.revokeObjectURL(preview);
    }
  }

  createCollection(): void {
    if (this.creating()) {
      return;
    }

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    this.errorMessage.set('');

    this.uploadCreateCover().then((coverImage) => {
      // The upload failed, so the modal stays open for another try.
      if (this.coverFile() && !coverImage) {
        this.creating.set(false);
        return;
      }

      this.sendCreateRequest(coverImage);
    });
  }

  private async uploadCreateCover(): Promise<string> {
    const file = this.coverFile();

    if (!file) {
      return '';
    }

    try {
      return await this.cloudinaryService.uploadImage(file);
    } catch {
      this.errorMessage.set(
        'Unable to upload the cover image. Please try again.'
      );

      return '';
    }
  }

  private sendCreateRequest(coverImage: string): void {
    this.collectionService
      .createCollection(this.createForm.controls.name.value.trim(), {
        description: this.createForm.controls.description.value.trim(),
        coverImage,
      })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (response) => {
          this.showCreateModal.set(false);
          this.clearCreateCover();
          this.successMessage.set(
            response?.message || 'Collection created successfully.'
          );

          // New collections appear first, so go back to page one.
          this.goToPage(1);
        },
        error: (error) => {
          this.errorMessage.set(
            error?.error?.message ||
              'Unable to create the collection.'
          );
        },
      });
  }

  toggleRecipes(collection: CollectionSummary): void {
    const selected = this.selectedCollection();

    if (selected?._id === collection._id) {
      this.selectedCollection.set(null);
      return;
    }

    this.selectedCollection.set(null);
    this.loadingRecipes.set(true);
    this.errorMessage.set('');

    this.collectionService
      .getCollectionById(collection._id)
      .pipe(finalize(() => this.loadingRecipes.set(false)))
      .subscribe({
        next: (response) => {
          this.selectedCollection.set(
            response?.collection ?? null
          );
        },
        error: (error) => {
          this.errorMessage.set(
            error?.error?.message ||
              'Unable to load the recipes of this collection.'
          );
        },
      });
  }

  removeRecipe(
    collection: CollectionDetail,
    recipeId: string
  ): void {
    if (this.removingRecipeId()) {
      return;
    }

    this.removingRecipeId.set(recipeId);
    this.errorMessage.set('');

    this.collectionService
      .removeRecipe(collection._id, recipeId)
      .subscribe({
        next: (response) => {
          this.removingRecipeId.set('');
          this.successMessage.set(
            response?.message || 'Recipe removed from the collection.'
          );

          // Update the open recipe list and refresh the stored counts.
          this.selectedCollection.set({
            ...collection,
            recipeCount: response?.recipeCount ?? collection.recipeCount,
            recipes: collection.recipes.filter(
              (recipe) => recipe._id !== recipeId
            ),
          });

          this.loadCollections(this.currentPage());
        },
        error: (error) => {
          this.removingRecipeId.set('');
          this.errorMessage.set(
            error?.error?.message ||
              'Unable to remove the recipe.'
          );
        },
      });
  }

  clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  removeSelectedRecipe(recipeId: string): void {
    const selected = this.selectedCollection();

    if (!selected) {
      return;
    }

    this.removeRecipe(selected, recipeId);
  }

  isRecipeListOpen(collectionId: string): boolean {
    return this.selectedCollection()?._id === collectionId;
  }

  // Cover change for a collection that already exists. Only the owner of a
  // collection can reach these cards, and the API checks ownership again.
  onCardCoverSelected(event: Event, collection: CollectionSummary): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    input.value = '';

    if (!file) {
      return;
    }

    if (!isSupportedImage(file)) {
      this.errorMessage.set('Please choose a valid image file.');
      return;
    }

    if (exceedsImageSizeLimit(file)) {
      this.errorMessage.set('Image must be 5 MB or smaller.');
      return;
    }

    this.errorMessage.set('');
    this.updatingCoverId.set(collection._id);

    void this.uploadAndSaveCover(collection, file);
  }

  removeCover(collection: CollectionSummary): void {
    if (this.updatingCoverId()) {
      return;
    }

    this.successMessage.set('');
    this.updatingCoverId.set(collection._id);

    this.saveCover(collection, '');
  }

  private async uploadAndSaveCover(
    collection: CollectionSummary,
    file: File
  ): Promise<void> {
    try {
      const coverImage = await this.cloudinaryService.uploadImage(file);

      this.saveCover(collection, coverImage);
    } catch {
      this.updatingCoverId.set('');
      this.errorMessage.set(
        'Unable to upload the cover image. Please try again.'
      );
    }
  }

  private saveCover(
    collection: CollectionSummary,
    coverImage: string
  ): void {
    this.collectionService
      .updateCoverImage(collection._id, coverImage)
      .pipe(finalize(() => this.updatingCoverId.set('')))
      .subscribe({
        next: (response) => {
          this.successMessage.set(
            response?.message || 'Collection cover updated.'
          );

          this.replaceCollection({
            ...collection,
            coverImage: response?.collection?.coverImage ?? null,
          });
        },
        error: (error) => {
          this.errorMessage.set(
            error?.error?.message ||
              'Unable to update the collection cover.'
          );
        },
      });
  }

  openShareModal(collection: CollectionSummary): void {
    this.sharingCollection.set(collection);
    this.shareMessage.set('');
    this.copyMessage.set('');
    this.showShareModal.set(true);
  }

  closeShareModal(): void {
    this.showShareModal.set(false);
    this.sharingCollection.set(null);
    this.shareMessage.set('');
    this.copyMessage.set('');
  }

  // The public link of the collection that is open in the share modal.
  get shareUrl(): string {
    const token = this.sharingCollection()?.shareToken;

    return token ? `${window.location.origin}/shared/${token}` : '';
  }

  enableSharing(): void {
    this.runSharingRequest('enable');
  }

  regenerateShareLink(): void {
    this.runSharingRequest('regenerate');
  }

  disableSharing(): void {
    this.runSharingRequest('disable');
  }

  private runSharingRequest(
    action: 'enable' | 'regenerate' | 'disable'
  ): void {
    const collection = this.sharingCollection();

    if (!collection || this.sharingBusy()) {
      return;
    }

    this.sharingBusy.set(true);
    this.errorMessage.set('');
    this.shareMessage.set('');
    this.copyMessage.set('');

    const request = this.buildSharingRequest(action, collection._id);

    request
      .pipe(finalize(() => this.sharingBusy.set(false)))
      .subscribe({
        next: (response) => {
          this.shareMessage.set(response?.message || '');

          if (response?.collection) {
            this.sharingCollection.set(response.collection);
            this.replaceCollection(response.collection);
          }
        },
        error: (error) => {
          this.errorMessage.set(
            error?.error?.message ||
              'Unable to update sharing for this collection.'
          );
        },
      });
  }

  private buildSharingRequest(
    action: 'enable' | 'regenerate' | 'disable',
    collectionId: string
  ) {
    if (action === 'enable') {
      return this.collectionService.enableSharing(collectionId);
    }

    if (action === 'regenerate') {
      return this.collectionService.regenerateShareLink(collectionId);
    }

    return this.collectionService.disableSharing(collectionId);
  }

  private replaceCollection(updated: CollectionSummary): void {
    this.collections.update((items) =>
      items.map((item) =>
        item._id === updated._id ? { ...item, ...updated } : item
      )
    );
  }

  async copyShareLink(): Promise<void> {
    const url = this.shareUrl;

    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      this.copyMessage.set('Link copied to your clipboard.');
    } catch {
      this.copyMessage.set(
        'Copying is blocked in this browser. Select the link and copy it manually.'
      );
    }
  }
}
