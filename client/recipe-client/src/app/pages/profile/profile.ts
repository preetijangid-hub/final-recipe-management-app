import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ProfileService } from '../../services/profile';
import { UserProfile } from '../../models/user';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfilePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);

  // The app runs without zone change detection, so async subscription
  // callbacks must refresh their own view. Same pattern as meal-planner
  // and recipe-details.
  private readonly changeDetector = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';

  // Loaded from the backend on every visit; the form below edits a copy.
  profile: UserProfile | null = null;

  profileForm = this.fb.nonNullable.group({
    profession: ['', [Validators.maxLength(100)]],
    profilePhoto: [
      '',
      [
        Validators.maxLength(500),
        // Empty is allowed so the photo can be cleared.
        Validators.pattern(/^https?:\/\/\S+$/),
      ],
    ],
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.profileService.getMyProfile().subscribe({
      next: (response) => {
        this.applyProfile(response.profile);
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Unable to load your profile.';
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  save(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    if (this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { profession, profilePhoto } = this.profileForm.getRawValue();

    this.profileService
      .updateMyProfile(profilePhoto.trim(), profession.trim())
      .subscribe({
        next: (response) => {
          this.applyProfile(response.profile);
          this.successMessage = 'Profile updated successfully.';
          this.saving = false;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            'Unable to save your profile. Please try again.';
          this.saving = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  clearPhoto(): void {
    this.profileForm.controls.profilePhoto.setValue('');
    this.profileForm.controls.profilePhoto.markAsTouched();
    this.errorMessage = '';
    this.successMessage = '';
  }

  /** Live preview of the URL currently in the form. */
  get photoPreview(): string {
    return this.profileForm.controls.profilePhoto.value.trim();
  }

  /** First letter of the name, used by the placeholder avatar. */
  get profileInitial(): string {
    const name = this.profile?.name?.trim();

    return name ? name.slice(0, 1).toUpperCase() : 'S';
  }

  private applyProfile(profile: UserProfile): void {
    if (!profile) {
      return;
    }

    this.profile = profile;
    this.profileForm.setValue({
      profession: profile.profession || '',
      profilePhoto: profile.profilePhoto || '',
    });
  }
}