import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { CUISINES, MEAL_CATEGORIES } from '../../models/recipe';
import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-add-recipe',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './add-recipe.html',
  styleUrl: './add-recipe.css',
})
export class AddRecipePage {
  private readonly recipeService = inject(RecipeService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  saving = false;
  errorMessage = '';
  successMessage = '';

  readonly cuisines = CUISINES;
  readonly mealCategories = MEAL_CATEGORIES;

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

  submit(): void {
    if (this.recipeForm.invalid) {
      this.errorMessage = 'Please complete the required recipe fields.';
      this.recipeForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      title: this.recipeForm.value.title,
      category: this.recipeForm.value.category,
      mealCategory: this.recipeForm.value.mealCategory,
      ingredients: this.recipeForm.value.ingredients.filter(Boolean),
      steps: this.recipeForm.value.steps.filter(Boolean),
      spiceLevel: this.recipeForm.value.spiceLevel,
      sweetnessLevel: this.recipeForm.value.sweetnessLevel,
      image: this.recipeForm.value.image || '',
    };

    this.recipeService
      .createRecipe(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = 'Recipe created successfully.';
          this.recipeForm.reset();
          this.router.navigate(['/recipes', response.recipe._id]);
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'Unable to create recipe.';
        },
      });
  }
}
