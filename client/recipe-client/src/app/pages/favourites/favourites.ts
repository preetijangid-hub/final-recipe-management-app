import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Recipe } from '../../models/recipe';
import { FavouritesService } from '../../services/favourites';

@Component({
  selector: 'app-favourites',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favourites.html',
  styleUrl: './favourites.css',
})
export class FavouritesPage implements OnInit {
  private readonly favouritesService = inject(FavouritesService);

  // Exposed for the saved list and the heart controls in the template.
  readonly favourites = this.favouritesService;

  ngOnInit(): void {
    // Read the saved list again so the page never shows stale data.
    this.favouritesService.loadFavourites(true);
  }

  reload(): void {
    this.favouritesService.clearMessages();
    this.favouritesService.loadFavourites(true);
  }

  removeFavourite(recipe: Recipe): void {
    if (this.favourites.isToggling(recipe._id)) {
      return;
    }

    // Everything listed here is saved already, so a toggle removes it.
    // The service drops the recipe from the list once the API confirms.
    this.favouritesService.toggleFavourite(recipe._id);
  }

  getIngredients(recipe: Recipe): string {
    return recipe.ingredients.join(', ') || 'No ingredients listed';
  }
}
