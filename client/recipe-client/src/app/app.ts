import { Component, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AuthService } from './services/auth';
import { FavouritesService } from './services/favourites';
import { NotificationService } from './services/notification';
import { NotificationBell } from './components/notification-bell/notification-bell';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    NotificationBell,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly favouritesService = inject(FavouritesService);
  private readonly notificationService = inject(NotificationService);

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

    // Drop the cached favourites so the next user starts fresh.
    this.favouritesService.reset();

    // Close the notification socket and clear private notifications.
    this.notificationService.reset();

    this.router.navigate(['/login']);
  }
}