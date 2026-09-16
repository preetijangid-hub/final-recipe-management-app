import { Component, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private readonly routerEventsSubscription = this.router.events.subscribe(
    () => {
      this.addRecipeLinkActive = this.isAddRecipeCreateMode();
    }
  );

  addRecipeLinkActive = false;

  readonly currentUser = this.authService.getStoredUser();

  isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }

  isAddRecipeCreateMode(): boolean {
    const url = this.router.url;

    return url.startsWith('/add-recipe') && !url.includes('edit=');
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}