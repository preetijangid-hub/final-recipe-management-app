import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  catchError,
  finalize,
  of,
  timeout,
} from 'rxjs';

import { Recipe } from '../../models/recipe';
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

  readonly recipes = signal<Recipe[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadMyRecipes();
  }

  loadMyRecipes(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.recipes.set([]);

    this.recipeService
      .getMyRecipes()
      .pipe(
        timeout(10000),
        catchError((error) => {
          if (error?.name === 'TimeoutError') {
            this.errorMessage.set(
              'The request is taking too long. Please check that the backend is running.'
            );
          } else if (error?.status === 401) {
            this.errorMessage.set(
              'Your session has expired. Please log in again.'
            );
          } else if (error?.error?.message) {
            this.errorMessage.set(error.error.message);
          } else {
            this.errorMessage.set('Unable to load your recipes.');
          }

          this.recipes.set([]);

          return of({
            recipes: [],
          });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((response) => {
        this.recipes.set(response?.recipes ?? []);
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

    const currentUserId =
      user._id ||
      (user as UserWithId).id ||
      '';

    const ownerId =
      typeof recipe.user === 'string'
        ? recipe.user
        : recipe.user?._id;

    return ownerId === currentUserId;
  }

  deleteRecipe(recipeId: string): void {
    const confirmed = window.confirm(
      'Are you sure you want to delete this recipe?'
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage.set('');

    this.recipeService.deleteRecipe(recipeId).subscribe({
      next: () => {
        this.loadMyRecipes();
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message ||
            'Unable to delete recipe.'
        );
      },
    });
  }
}

interface UserWithId {
  id?: string;
}
