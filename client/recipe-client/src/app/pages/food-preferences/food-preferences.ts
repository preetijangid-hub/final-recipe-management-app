import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-food-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './food-preferences.html',
  styleUrl: './food-preferences.css',
})
export class FoodPreferences implements OnInit {
  private readonly recipeService = inject(RecipeService);

  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';

  preferences = {
    allergies: '',
    avoidIngredients: '',
    preferredIngredients: '',
    dietaryPreferences: '',
    spiceLevel: '',
    sweetnessLevel: '',
  };

  readonly spiceOptions = ['Mild', 'Medium', 'Hot', 'Very Hot'];
  readonly sweetnessOptions = ['Not Sweet', 'Lightly Sweet', 'Sweet', 'Very Sweet'];

  ngOnInit(): void {
    this.loadPreferences();
  }

  loadPreferences(): void {
    this.loading = true;
    this.errorMessage = '';

    this.recipeService.getPreferences().subscribe({
      next: (response) => {
        this.preferences = {
          allergies: response.preferences?.allergies?.join(', ') || '',
          avoidIngredients: response.preferences?.avoidIngredients?.join(', ') || '',
          preferredIngredients: response.preferences?.preferredIngredients?.join(', ') || '',
          dietaryPreferences: response.preferences?.dietaryPreferences?.join(', ') || '',
          spiceLevel: response.preferences?.spiceLevel || '',
          sweetnessLevel: response.preferences?.sweetnessLevel || '',
        };
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load your food preferences.';
        this.loading = false;
      },
    });
  }

  save(): void {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload = {
      allergies: this.commaList(this.preferences.allergies),
      avoidIngredients: this.commaList(this.preferences.avoidIngredients),
      preferredIngredients: this.commaList(this.preferences.preferredIngredients),
      dietaryPreferences: this.commaList(this.preferences.dietaryPreferences),
      spiceLevel: this.preferences.spiceLevel,
      sweetnessLevel: this.preferences.sweetnessLevel,
    };

    this.recipeService.updatePreferences(payload).subscribe({
      next: () => {
        this.successMessage = 'Food preferences saved.';
        this.saving = false;
      },
      error: () => {
        this.errorMessage = 'Unable to save food preferences.';
        this.saving = false;
      },
    });
  }

  private commaList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
