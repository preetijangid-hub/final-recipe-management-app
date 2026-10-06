import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProfileService } from '../../services/profile';
import { PublicCreatorProfile } from '../../models/user';
import { Recipe } from '../../models/recipe';

@Component({
  selector: 'app-creator-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './creator-profile.html',
  styleUrl: './creator-profile.css',
})
export class CreatorProfilePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly profileService = inject(ProfileService);

  loading = true;
  profileError = '';

  recipesLoading = true;
  recipesError = '';
  recipes: Recipe[] = [];

  profile: PublicCreatorProfile | null = null;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const userId = params.get('userId');

        if (!userId) {
          this.loading = false;
          this.recipesLoading = false;
          this.profileError = 'This creator profile was not found.';

          return;
        }

        this.loadProfile(userId);
        this.loadRecipes(userId);
      });
  }

  loadProfile(userId: string): void {
    this.loading = true;
    this.profileError = '';

    this.profileService.getPublicProfile(userId).subscribe({
      next: (response) => {
        this.profile = response.profile;
        this.loading = false;
      },
      error: (error) => {
        this.profileError =
          error?.status === 404
            ? 'This creator profile was not found.'
            : 'Unable to load this creator profile. Please try again.';
        this.loading = false;
      },
    });
  }

  loadRecipes(userId: string): void {
    this.recipesLoading = true;
    this.recipesError = '';

    this.profileService.getCreatorRecipes(userId).subscribe({
      next: (response) => {
        this.recipes = response.recipes ?? [];
        this.recipesLoading = false;
      },
      error: () => {
        this.recipes = [];
        this.recipesError =
          'Unable to load recipes for this creator. Please try again.';
        this.recipesLoading = false;
      },
    });
  }

  get profileInitial(): string {
    const name = this.profile?.name?.trim();

    return name ? name.slice(0, 1).toUpperCase() : 'S';
  }
}