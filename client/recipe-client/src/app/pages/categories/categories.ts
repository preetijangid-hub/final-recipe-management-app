import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CUISINES, MEAL_CATEGORIES } from '../../models/recipe';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class CategoriesPage {
  private readonly router = inject(Router);

  readonly cuisines = CUISINES;
  readonly mealCategories = MEAL_CATEGORIES;

  browseCuisine(name: string): void {
    this.router.navigate(['/discover'], {
      queryParams: { category: name },
    });
  }

  browseMealCategory(name: string): void {
    this.router.navigate(['/discover'], {
      queryParams: { mealCategory: name },
    });
  }
}
