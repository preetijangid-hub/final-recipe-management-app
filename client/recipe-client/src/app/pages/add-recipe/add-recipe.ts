import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { CUISINES, MEAL_CATEGORIES, Recipe } from '../../models/recipe';
import { RecipeService } from '../../services/recipe';
import { CloudinaryService } from '../../services/cloudinary';

@Component({
  selector: 'app-add-recipe',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './add-recipe.html',
  styleUrl: './add-recipe.css',
})
export class AddRecipePage {
  private readonly recipeService = inject(RecipeService);
  private readonly cloudinaryService = inject(CloudinaryService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);

  saving = false;
  loadingRecipe = false;
  errorMessage = '';
  successMessage = '';

  uploadingImage = false;
  imagePreview = '';
  selectedImageFile: File | null = null;
  readonly maxImageSizeBytes = 5 * 1024 * 1024;

  isEditMode = false;
  editRecipeId = '';

  readonly cuisines = CUISINES;
  readonly mealCategories = MEAL_CATEGORIES;

  categoryOptions: string[] = [...CUISINES];
  mealCategoryOptions: string[] = [...MEAL_CATEGORIES];

  get heading(): string {
    return this.isEditMode ? 'Edit recipe' : 'Add recipe';
  }

  get submitLabel(): string {
    if (this.uploadingImage) {
      return 'Uploading image...';
    }

    if (this.saving) {
      return this.isEditMode ? 'Saving...' : 'Creating...';
    }

    return this.isEditMode ? 'Save changes' : 'Create recipe';
  }

  get previewImage(): string {
    if (this.imagePreview) {
      return this.imagePreview;
    }

    return this.recipeForm.value.image || '';
  }

  get ingredients(): FormArray<FormControl<string | null>> {
    return this.recipeForm.get('ingredients') as FormArray<FormControl<string | null>>;
  }

  get steps(): FormArray<FormControl<string | null>> {
    return this.recipeForm.get('steps') as FormArray<FormControl<string | null>>;
  }

  readonly recipeForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    category: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    mealCategory: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    ingredients: this.fb.array<FormControl<string | null>>([this.fb.control('', Validators.required)]),
    steps: this.fb.array<FormControl<string | null>>([this.fb.control('', Validators.required)]),
    spiceLevel: ['Mild'],
    sweetnessLevel: ['Not Sweet'],
    image: [''],
  });

  constructor() {
    this.route.queryParams.subscribe((params) => {
      const editId = (params['edit'] ?? '').toString();

      if (editId) {
        this.startEditMode(editId);
      } else {
        this.resetToCreateMode();
      }
    });
  }

  addIngredientRow(): void {
    this.ingredients.push(this.fb.control('', Validators.required));
  }

  addStepRow(): void {
    this.steps.push(this.fb.control('', Validators.required));
  }

  removeIngredientRow(index: number): void {
    if (this.ingredients.length > 1) {
      this.ingredients.removeAt(index);
    }
  }

  removeStepRow(index: number): void {
    if (this.steps.length > 1) {
      this.steps.removeAt(index);
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please choose a valid image file.';
      input.value = '';
      return;
    }

    if (file.size > this.maxImageSizeBytes) {
      this.errorMessage = 'Image must be 5 MB or smaller.';
      input.value = '';
      return;
    }

    this.errorMessage = '';

    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
    }

    this.selectedImageFile = file;
    this.imagePreview = URL.createObjectURL(file);
    input.value = '';
  }

  removeSelectedImage(): void {
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
    }

    this.selectedImageFile = null;
    this.imagePreview = '';
  }

  private async uploadSelectedImage(): Promise<string> {
    if (!this.selectedImageFile) {
      console.log('[Savoré upload] No new image selected, keeping the existing image.');

      return this.recipeForm.value.image || '';
    }

    this.uploadingImage = true;
    this.errorMessage = '';

    console.log('[Savoré upload] Starting image upload');
    console.log(`[Savoré upload] file name: ${this.selectedImageFile.name}`);
    console.log(`[Savoré upload] file type: ${this.selectedImageFile.type}`);
    console.log(`[Savoré upload] file size: ${this.selectedImageFile.size} bytes`);

    try {
      const secureUrl = await this.cloudinaryService.uploadImage(
        this.selectedImageFile
      );

      console.log(`[Savoré upload] uploadSelectedImage resolved with: ${secureUrl}`);

      return secureUrl;
    } catch (error) {
      console.error('[Savoré upload] upload failed:', error);
      this.errorMessage =
        'Unable to upload the image. Please try again.';
      return '';
    } finally {
      this.uploadingImage = false;
    }
  }

  submit(): void {
    if (this.recipeForm.invalid) {
      this.errorMessage = 'Please complete the required recipe fields.';
      this.recipeForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.uploadSelectedImage()
      .then((imageUrl) => {
        console.log(`[Savoré save] continuing with image URL: ${imageUrl || '(empty)'}`);

        if (this.selectedImageFile && !imageUrl) {
          console.log('[Savoré save] upload failed, skipping recipe save.');
          // Upload failed, keep the form open so the user can retry.
          this.saving = false;
          this.changeDetector.detectChanges();
          return;
        }

        this.saveRecipe(imageUrl);
      });
  }

  private saveRecipe(imageUrl: string): void {
    this.changeDetector.detectChanges();

    const payload = {
      title: this.recipeForm.value.title,
      category: this.recipeForm.value.category,
      mealCategory: this.recipeForm.value.mealCategory,
      ingredients: this.recipeForm.value.ingredients.filter(Boolean),
      steps: this.recipeForm.value.steps.filter(Boolean),
      spiceLevel: this.recipeForm.value.spiceLevel,
      sweetnessLevel: this.recipeForm.value.sweetnessLevel,
      image: imageUrl,
    };

    console.log('[Savoré save] payload:', payload);

    if (this.isEditMode) {
      console.log(`[Savoré save] calling updateRecipe() for recipe ${this.editRecipeId}`);

      this.recipeService
        .updateRecipe(this.editRecipeId, payload)
        .pipe(
          finalize(() => {
            this.saving = false;
            this.changeDetector.detectChanges();
          })
        )
        .subscribe({
          next: (response) => {
            console.log(`[Savoré save] recipe updated: ${response.recipe._id}`);
            this.successMessage = 'Recipe updated successfully.';
            this.recipeForm.reset();
            this.isEditMode = false;
            this.editRecipeId = '';
            this.router.navigate(['/recipes', response.recipe._id]);
          },
          error: (error) => {
            console.error('[Savoré save] update failed:', error);
            this.errorMessage =
              error?.error?.message || 'Unable to update recipe.';
          },
        });

      return;
    }

    console.log('[Savoré save] calling createRecipe()');

    this.recipeService
      .createRecipe(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.changeDetector.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          console.log(`[Savoré save] recipe created: ${response.recipe._id}`);
          this.successMessage = 'Recipe created successfully.';
          this.recipeForm.reset();
          this.router.navigate(['/recipes', response.recipe._id]);
        },
        error: (error) => {
          console.error('[Savoré save] create failed:', error);
          this.errorMessage = error?.error?.message || 'Unable to create recipe.';
        },
      });
  }

  private startEditMode(recipeId: string): void {
    this.isEditMode = true;
    this.editRecipeId = recipeId;
    this.loadingRecipe = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.removeSelectedImage();

    this.recipeService
      .getRecipeById(recipeId)
      .pipe(finalize(() => (this.loadingRecipe = false)))
      .subscribe({
        next: (response) => {
          if (response.recipe) {
            this.populateForm(response.recipe);
          } else {
            this.resetToCreateMode();
            this.errorMessage = 'Recipe not found.';
          }
        },
        error: (error) => {
          this.resetToCreateMode();
          this.errorMessage =
            error?.error?.message || 'Unable to load recipe for editing.';
        },
      });
  }

  private populateForm(recipe: Recipe): void {
    this.categoryOptions = this.mergeOption(CUISINES, recipe.category);
    this.mealCategoryOptions = this.mergeOption(
      MEAL_CATEGORIES,
      recipe.mealCategory
    );

    this.recipeForm.patchValue({
      title: recipe.title ?? '',
      category: recipe.category ?? '',
      mealCategory: recipe.mealCategory ?? '',
      spiceLevel: recipe.spiceLevel || 'Mild',
      sweetnessLevel: recipe.sweetnessLevel || 'Not Sweet',
      image: recipe.image || '',
    });

    this.fillRows(this.ingredients, recipe.ingredients ?? []);
    this.fillRows(this.steps, recipe.steps ?? []);
  }

  private mergeOption(baseOptions: string[], value?: string): string[] {
    if (!value || baseOptions.includes(value)) {
      return [...baseOptions];
    }

    return [...baseOptions, value];
  }

  private fillRows(
    array: FormArray<FormControl<string | null>>,
    values: string[]
  ): void {
    const filledValues = values.filter(
      (value) => value && value.trim().length > 0
    );

    array.clear();

    for (const value of filledValues.length > 0 ? filledValues : ['']) {
      array.push(this.fb.control(value, Validators.required));
    }
  }

  private resetToCreateMode(): void {
    if (!this.isEditMode) {
      return;
    }

    this.isEditMode = false;
    this.editRecipeId = '';
    this.loadingRecipe = false;
    this.errorMessage = '';
    this.successMessage = '';

    this.removeSelectedImage();

    this.recipeForm.reset({
      title: '',
      category: '',
      mealCategory: '',
      spiceLevel: 'Mild',
      sweetnessLevel: 'Not Sweet',
      image: '',
    });

    this.categoryOptions = [...CUISINES];
    this.mealCategoryOptions = [...MEAL_CATEGORIES];

    this.fillRows(this.ingredients, []);
    this.fillRows(this.steps, []);
  }
}
