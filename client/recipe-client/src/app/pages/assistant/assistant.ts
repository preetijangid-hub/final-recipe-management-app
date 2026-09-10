import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RecipeService } from '../../services/recipe';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
})
export class AssistantPage implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly authService = inject(AuthService);

  readonly currentUser = this.authService.getStoredUser();

  message = '';
  reply = '';
  loading = false;
  errorMessage = '';
  matches: Array<{ recipeId: string; title: string; level: string; reasons: string[]; spiceLevel?: string; sweetnessLevel?: string }> = [];

  ngOnInit(): void {
    this.reply = 'Tell me about allergies, ingredients to avoid, preferred ingredients, or your spice and sweetness preference.';
  }

  askAssistant(): void {
    const clean = this.message.trim();
    if (!clean) {
      this.errorMessage = 'Tell me something about your food preferences first.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.reply = '';

    this.recipeService.parseAssistant(clean).subscribe({
      next: (response) => {
        this.reply = response.reply || 'I found a few recipes that may suit your profile.';
        this.matches = response.matches || [];
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'The food assistant could not answer right now.';
        this.loading = false;
      },
    });
  }
}
