import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class CategoriesPage implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly router = inject(Router);

  categories: string[] = [];
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.errorMessage = '';

    this.recipeService
      .getRecipes(1, 100)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          const names = [...new Set(
            response.recipes
              .map((recipe) => recipe.category?.trim())
              .filter((category): category is string => Boolean(category))
          )].sort((a, b) => a.localeCompare(b));

          this.categories = names;
        },
        error: () => {
          this.errorMessage = 'Unable to load categories right now.';
        },
      });
  }

  openCategory(category: string): void {
    this.router.navigate(['/discover'], {
      queryParams: { category },
    });
  }
}
