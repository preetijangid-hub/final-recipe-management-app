import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { AddRecipePage } from './add-recipe';
import { Recipe } from '../../models/recipe';
import { RecipeService } from '../../services/recipe';
import { CloudinaryService } from '../../services/cloudinary';

describe('AddRecipePage', () => {
  const queryParams = new Subject<Record<string, string | undefined>>();

  const recipeServiceMock = {
    getRecipeById: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
  };

  const cloudinaryServiceMock = {
    uploadImage: vi.fn(),
  };

  const routerMock = {
    navigate: vi.fn(() => Promise.resolve(true)),
  };

  const existingRecipe: Recipe = {
    _id: 'recipe-1',
    title: 'Old title',
    ingredients: ['Salt', 'Flour'],
    steps: ['Mix', 'Bake'],
    category: 'Italian',
    mealCategory: 'Dinner',
    image: 'https://res.cloudinary.com/demo/old.jpg',
    spiceLevel: 'Mild',
    sweetnessLevel: 'Not Sweet',
    user: 'user-1',
  };

  const sampleFile = new File(['image-bytes'], 'new-photo.jpg', {
    type: 'image/jpeg',
  });

  let fixture: ComponentFixture<AddRecipePage>;

  const openEditMode = async (recipe: Recipe): Promise<AddRecipePage> => {
    recipeServiceMock.getRecipeById.mockReturnValue(of({ recipe }));

    queryParams.next({ edit: recipe._id });
    await fixture.whenStable();

    return fixture.componentInstance;
  };

  const selectImage = (component: AddRecipePage, file: File): void => {
    component.onImageSelected({
      target: { files: [file], value: 'C:\\fake\\new-photo.jpg' },
    } as unknown as Event);
  };

  const flushAsyncWork = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    URL.createObjectURL = vi.fn(
      () => 'blob:preview'
    ) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    await TestBed.configureTestingModule({
      imports: [AddRecipePage],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams } },
        { provide: Router, useValue: routerMock },
        { provide: RecipeService, useValue: recipeServiceMock },
        { provide: CloudinaryService, useValue: cloudinaryServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddRecipePage);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('loads the existing recipe into the form when the edit query param is set', async () => {
    const component = await openEditMode(existingRecipe);

    expect(component.isEditMode).toBe(true);
    expect(component.editRecipeId).toBe('recipe-1');
    expect(component.recipeForm.value.title).toBe('Old title');
    expect(component.recipeForm.value.category).toBe('Italian');
    expect(component.recipeForm.value.mealCategory).toBe('Dinner');
    expect(component.recipeForm.value.image).toBe(existingRecipe.image);
    expect(component.ingredients.length).toBe(2);
    expect(component.steps.length).toBe(2);
  });

  it('saves edited details without uploading or changing the existing image', async () => {
    const component = await openEditMode(existingRecipe);

    recipeServiceMock.updateRecipe.mockReturnValue(of({ recipe: existingRecipe }));

    component.recipeForm.patchValue({
      title: 'Updated title',
      spiceLevel: 'Hot',
      sweetnessLevel: 'Sweet',
    });

    component.submit();
    await fixture.whenStable();

    expect(cloudinaryServiceMock.uploadImage).not.toHaveBeenCalled();
    expect(recipeServiceMock.createRecipe).not.toHaveBeenCalled();
    expect(recipeServiceMock.updateRecipe).toHaveBeenCalledWith(
      'recipe-1',
      expect.objectContaining({
        title: 'Updated title',
        category: 'Italian',
        mealCategory: 'Dinner',
        ingredients: ['Salt', 'Flour'],
        steps: ['Mix', 'Bake'],
        spiceLevel: 'Hot',
        sweetnessLevel: 'Sweet',
        image: existingRecipe.image,
      })
    );
  });

  it('keeps an empty image when no new image is selected', async () => {
    const recipeWithoutImage: Recipe = { ...existingRecipe, image: '' };
    const component = await openEditMode(recipeWithoutImage);

    recipeServiceMock.updateRecipe.mockReturnValue(
      of({ recipe: recipeWithoutImage })
    );

    component.submit();
    await fixture.whenStable();

    expect(cloudinaryServiceMock.uploadImage).not.toHaveBeenCalled();
    expect(recipeServiceMock.createRecipe).not.toHaveBeenCalled();
    expect(recipeServiceMock.updateRecipe).toHaveBeenCalledWith(
      'recipe-1',
      expect.objectContaining({ image: '' })
    );
  });

  it('uploads a new image for a recipe without one and updates the same recipe', async () => {
    const recipeWithoutImage: Recipe = { ...existingRecipe, image: '' };
    const component = await openEditMode(recipeWithoutImage);

    cloudinaryServiceMock.uploadImage.mockResolvedValue(
      'https://res.cloudinary.com/demo/new.jpg'
    );
    recipeServiceMock.updateRecipe.mockReturnValue(
      of({
        recipe: {
          ...recipeWithoutImage,
          image: 'https://res.cloudinary.com/demo/new.jpg',
        },
      })
    );

    selectImage(component, sampleFile);
    component.submit();
    await flushAsyncWork();

    expect(cloudinaryServiceMock.uploadImage).toHaveBeenCalledWith(sampleFile);
    expect(recipeServiceMock.createRecipe).not.toHaveBeenCalled();
    expect(recipeServiceMock.updateRecipe).toHaveBeenCalledWith(
      'recipe-1',
      expect.objectContaining({
        title: 'Old title',
        image: 'https://res.cloudinary.com/demo/new.jpg',
      })
    );
  });

  it('replaces an existing image with a newly selected one on the same recipe', async () => {
    const component = await openEditMode(existingRecipe);

    cloudinaryServiceMock.uploadImage.mockResolvedValue(
      'https://res.cloudinary.com/demo/replacement.jpg'
    );
    recipeServiceMock.updateRecipe.mockReturnValue(
      of({
        recipe: {
          ...existingRecipe,
          image: 'https://res.cloudinary.com/demo/replacement.jpg',
        },
      })
    );

    selectImage(component, sampleFile);
    component.submit();
    await flushAsyncWork();

    expect(cloudinaryServiceMock.uploadImage).toHaveBeenCalledWith(sampleFile);
    expect(recipeServiceMock.createRecipe).not.toHaveBeenCalled();
    expect(recipeServiceMock.updateRecipe).toHaveBeenCalledWith(
      'recipe-1',
      expect.objectContaining({
        image: 'https://res.cloudinary.com/demo/replacement.jpg',
      })
    );
  });

  it('updates only the image when no detail was changed', async () => {
    const component = await openEditMode(existingRecipe);

    cloudinaryServiceMock.uploadImage.mockResolvedValue(
      'https://res.cloudinary.com/demo/replacement.jpg'
    );
    recipeServiceMock.updateRecipe.mockReturnValue(of({ recipe: existingRecipe }));

    selectImage(component, sampleFile);
    component.submit();
    await flushAsyncWork();

    expect(recipeServiceMock.updateRecipe).toHaveBeenCalledWith(
      'recipe-1',
      expect.objectContaining({
        title: 'Old title',
        ingredients: ['Salt', 'Flour'],
        steps: ['Mix', 'Bake'],
        image: 'https://res.cloudinary.com/demo/replacement.jpg',
      })
    );
  });

  it('stops the save and keeps the form intact when the image upload fails', async () => {
    const component = await openEditMode(existingRecipe);

    cloudinaryServiceMock.uploadImage.mockRejectedValue(
      new Error('Cloudinary down')
    );
    recipeServiceMock.updateRecipe.mockReturnValue(of({ recipe: existingRecipe }));

    component.recipeForm.patchValue({ title: 'Updated title' });
    selectImage(component, sampleFile);

    component.submit();
    await flushAsyncWork();

    expect(recipeServiceMock.updateRecipe).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Unable to upload the image');
    expect(component.uploadingImage).toBe(false);
    expect(component.saving).toBe(false);
    expect(component.recipeForm.value.title).toBe('Updated title');
    expect(component.selectedImageFile).toBe(sampleFile);
  });

  it('creates a new recipe with the uploaded image when adding', async () => {
    const component = fixture.componentInstance;

    cloudinaryServiceMock.uploadImage.mockResolvedValue(
      'https://res.cloudinary.com/demo/added.jpg'
    );
    recipeServiceMock.createRecipe.mockReturnValue(
      of({ recipe: { ...existingRecipe, _id: 'recipe-2' } })
    );

    component.recipeForm.patchValue({
      title: 'New recipe',
      category: 'Italian',
      mealCategory: 'Dinner',
      ingredients: ['Salt'],
      steps: ['Mix'],
    });
    selectImage(component, sampleFile);

    component.submit();
    await flushAsyncWork();

    expect(cloudinaryServiceMock.uploadImage).toHaveBeenCalledWith(sampleFile);
    expect(recipeServiceMock.updateRecipe).not.toHaveBeenCalled();
    expect(recipeServiceMock.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New recipe',
        image: 'https://res.cloudinary.com/demo/added.jpg',
      })
    );
    expect(routerMock.navigate).toHaveBeenCalledWith(['/recipes', 'recipe-2']);
  });
});
