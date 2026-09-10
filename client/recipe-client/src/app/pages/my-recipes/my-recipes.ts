import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Recipe, RecipeListResponse } from '../../models/recipe';
import { AuthService } from '../../services/auth';
import { RecipeService } from '../../services/recipe';

@Component({
  selector: 'app-my-recipes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-recipes.html',
  styleUrl: './my-recipes.css',
})
export class MyRecipesPage implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly authService = inject(AuthService);

  readonly currentUser = this.authService.getStoredUser();

  recipes: Recipe[] = [];
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadMyRecipes();
  }

  loadMyRecipes(): void {
    this.loading = true;
    this.errorMessage = '';

    this.recipeService
      .getMyRecipes()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.recipes = response.recipes ?? [];
        },
        error: () => {
          this.errorMessage = 'Unable to load your recipes.';
        },
      });
  }

  canManage(recipe: Recipe): boolean {
    const user = this.currentUser;
    if (!user) {
      return false;
    }

    if (user.role === 'admin') {
      return true;
    }

    const owner = typeof recipe.user === 'string' ? recipe.user : recipe.user?._id;
    return owner === user._id;
  }

  deleteRecipe(recipeId: string): void {
    this.recipeService.deleteRecipe(recipeId).subscribe({
      next: () => this.loadMyRecipes(),
      error: () => this.errorMessage = 'Unable to delete recipe.',
    });
  }
}
