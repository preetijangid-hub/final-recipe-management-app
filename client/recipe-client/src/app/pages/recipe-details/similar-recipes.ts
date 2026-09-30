import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';

import { Recipe } from '../../models/recipe';
import { RecipeService } from '../../services/recipe';
import {
  RecipeEmbeddingsService,
  SimilarRecipe,
} from '../../services/recipe-embeddings';

@Component({
  selector: 'app-similar-recipes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './similar-recipes.html',
  styleUrl: './similar-recipes.css',
})
export class SimilarRecipes {
  @Input({ required: true }) recipe!: Recipe;

  private readonly recipeService = inject(RecipeService);

  // Exposed so the template can explain the first-time model download.
  readonly embeddings = inject(RecipeEmbeddingsService);

  readonly suggestions = signal<SimilarRecipe[]>([]);

  readonly searching = signal(false);

  readonly message = signal('');

  // The embeddings are only computed when the user asks for them, so opening
  // a recipe never waits for the AI model.
  async run(): Promise<void> {
    if (this.searching()) {
      return;
    }

    this.searching.set(true);
    this.message.set('');
    this.suggestions.set([]);

    try {
      const response = await firstValueFrom(
        this.recipeService.getRecipes(1, 50).pipe(timeout(10000))
      );

      const candidates = (response?.recipes ?? []).filter(
        (candidate) =>
          /^[a-f0-9]{24}$/i.test(candidate?._id ?? '') &&
          candidate._id !== this.recipe._id
      );

      const similar = await this.embeddings.findSimilarRecipes(
        this.recipe,
        candidates,
        4
      );

      if (similar.length === 0) {
        this.message.set(
          'No close matches were found among the recipes you can see.'
        );

        return;
      }

      this.suggestions.set(similar);
    } catch {
      this.message.set(
        'The AI suggestions are unavailable right now. Search and browsing are not affected.'
      );
    } finally {
      this.searching.set(false);
    }
  }

  matchPercent(score: number): number {
    const bounded = Math.max(0, Math.min(1, score));

    return Math.round(bounded * 100);
  }

  shortText(recipe: Recipe): string {
    if (recipe.description?.trim()) {
      return recipe.description.trim();
    }

    return recipe.ingredients.slice(0, 3).join(', ');
  }
}
