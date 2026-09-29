import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { SharedCollection } from '../../models/collection';
import { CollectionService } from '../../services/collection';

// Public, read-only page behind a share link. It shows only what the public
// endpoint returns, and there is nothing on it a visitor could change.
@Component({
  selector: 'app-shared-collection',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shared-collection.html',
  styleUrl: './shared-collection.css',
})
export class SharedCollectionPage implements OnInit {
  private readonly collectionService = inject(CollectionService);

  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);

  readonly collection = signal<SharedCollection | null>(null);

  readonly unavailable = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';

    if (!token) {
      this.loading.set(false);
      this.unavailable.set(true);
      return;
    }

    this.collectionService
      .getSharedCollection(token)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.collection.set(response?.collection ?? null);
        },
        // Unknown, switched-off and regenerated links all look the same to a
        // visitor, and the API deliberately does not say which it was.
        error: () => {
          this.unavailable.set(true);
        },
      });
  }
}
