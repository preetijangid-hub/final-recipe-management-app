import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ProfilePage } from './profile';
import { ProfileService } from '../../services/profile';
import { routes } from '../../app.routes';
import { authGuard } from '../../guards/auth-guard';

describe('ProfilePage', () => {
  const profileServiceMock = {
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
  };

  const sampleProfile = {
    _id: 'user-1',
    name: 'Profile Alpha',
    email: 'alpha@example.com',
    profession: 'Chef',
    profilePhoto: 'https://example.com/avatar.jpg',
  };

  let fixture: ComponentFixture<ProfilePage>;
  let component: ProfilePage;

  const flushAsyncWork = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  const getCompiled = (): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  // Types into a form field the way a user would.
  const setField = (selector: string, value: string): void => {
    const input = getCompiled().querySelector(selector) as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    refreshView();
  };

  // The test change detector only refreshes views marked dirty, so state
  // changed outside an event or lifecycle hook needs an explicit
  // markForCheck before detectChanges.
  const refreshView = (): void => {
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    profileServiceMock.getMyProfile.mockReturnValue(
      of({ profile: sampleProfile })
    );

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('loads the authenticated profile and displays the name', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    expect(profileServiceMock.getMyProfile).toHaveBeenCalledTimes(1);

    const nameInput = getCompiled().querySelector(
      '#name'
    ) as HTMLInputElement;

    expect(nameInput.value).toBe('Profile Alpha');
    // Renaming is not part of this phase.
    expect(nameInput.readOnly).toBe(true);
  });

  it('populates the profession field from the API', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const professionInput = getCompiled().querySelector(
      '#profession'
    ) as HTMLInputElement;

    expect(professionInput.value).toBe('Chef');
  });

  it('populates the photo url field and preview from the API', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const photoInput = getCompiled().querySelector(
      '#profilePhoto'
    ) as HTMLInputElement;

    expect(photoInput.value).toBe('https://example.com/avatar.jpg');

    const preview = getCompiled().querySelector(
      '.photo-preview img'
    ) as HTMLImageElement;

    expect(preview.getAttribute('src')).toBe(
      'https://example.com/avatar.jpg'
    );
  });

  it('shows a placeholder when no photo exists', async () => {
    profileServiceMock.getMyProfile.mockReturnValue(
      of({ profile: { ...sampleProfile, profilePhoto: '' } })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const compiled = getCompiled();

    expect(compiled.querySelector('.photo-preview img')).toBeNull();

    const placeholder = compiled.querySelector('.photo-placeholder');

    expect(placeholder?.textContent).toContain('P');
  });

  it('shows a loading state while the profile is fetched', () => {
    profileServiceMock.getMyProfile.mockReturnValue(NEVER);

    fixture.detectChanges();

    const compiled = getCompiled();

    expect(compiled.querySelector('.profile-loading')).not.toBeNull();
    expect(compiled.querySelector('#name')).toBeNull();
  });

  it('rejects a profession longer than 100 characters', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    setField('#profession', 'a'.repeat(101));
    component.profileForm.controls.profession.markAsTouched();
    refreshView();

    expect(component.profileForm.invalid).toBe(true);

    const compiled = getCompiled();

    expect(compiled.querySelector('.field-error')?.textContent).toContain(
      '100 characters'
    );

    const saveButton = compiled.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);

    component.save();
    expect(profileServiceMock.updateMyProfile).not.toHaveBeenCalled();
  });

  it('rejects an invalid profile photo url', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    setField('#profilePhoto', 'not-a-url');
    component.profileForm.controls.profilePhoto.markAsTouched();
    refreshView();

    expect(component.profileForm.invalid).toBe(true);

    const compiled = getCompiled();

    expect(compiled.querySelector('.field-error')?.textContent).toContain(
      'valid http(s) image URL'
    );

    const saveButton = compiled.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);

    component.save();
    expect(profileServiceMock.updateMyProfile).not.toHaveBeenCalled();
  });

  it('clear photo sets the profile photo field to an empty string', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const clearButton = Array.from(
      getCompiled().querySelectorAll('button')
    ).find((button) =>
      button.textContent?.includes('Clear Photo')
    ) as HTMLButtonElement;

    clearButton.click();

    // The click itself updates the form; this refresh stands in for the
    // framework's post-event change detection tick in a real browser.
    refreshView();

    expect(component.profileForm.controls.profilePhoto.value).toBe('');

    const compiled = getCompiled();

    expect(compiled.querySelector('.photo-preview img')).toBeNull();
    expect(compiled.querySelector('.photo-placeholder')).not.toBeNull();
  });

  it('save sends the trimmed profession and photo to the API', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    profileServiceMock.updateMyProfile.mockReturnValue(
      of({
        message: 'Profile updated successfully.',
        profile: { ...sampleProfile },
      })
    );

    setField('#profession', '  Pastry Chef  ');
    setField('#profilePhoto', 'https://example.com/pastry.jpg');

    component.save();

    expect(profileServiceMock.updateMyProfile).toHaveBeenCalledTimes(1);
    expect(profileServiceMock.updateMyProfile).toHaveBeenCalledWith(
      'https://example.com/pastry.jpg',
      'Pastry Chef'
    );
  });

  it('save success updates the form and shows a success message', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    profileServiceMock.updateMyProfile.mockReturnValue(
      of({
        message: 'Profile updated successfully.',
        profile: {
          ...sampleProfile,
          profession: 'Baker',
          profilePhoto: 'https://example.com/new-plate.jpg',
        },
      })
    );

    setField('#profession', 'Baker');
    setField('#profilePhoto', 'https://example.com/new-plate.jpg');

    component.save();
    refreshView();

    const compiled = getCompiled();

    expect(
      compiled.querySelector('.save-message')?.textContent
    ).toContain('Profile updated successfully.');

    const professionInput = compiled.querySelector(
      '#profession'
    ) as HTMLInputElement;

    expect(professionInput.value).toBe('Baker');

    const preview = compiled.querySelector(
      '.photo-preview img'
    ) as HTMLImageElement;

    expect(preview.getAttribute('src')).toBe(
      'https://example.com/new-plate.jpg'
    );

    const saveButton = compiled.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(false);
  });

  it('shows a user-facing message when saving fails', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    profileServiceMock.updateMyProfile.mockReturnValue(
      throwError(() => ({ error: { message: 'Validation failed.' } }))
    );

    component.save();
    refreshView();

    expect(
      getCompiled().querySelector('.server-error')?.textContent
    ).toContain('Validation failed.');

    // A raw network error never leaks through to the user.
    profileServiceMock.updateMyProfile.mockReturnValue(
      throwError(() => new Error('socket hang up'))
    );

    component.save();
    refreshView();

    const errorBox = getCompiled().querySelector('.server-error');

    expect(errorBox?.textContent).toContain(
      'Unable to save your profile'
    );
    expect(errorBox?.textContent).not.toContain('socket hang up');
  });

  it('disables save while a request runs and blocks duplicate submits', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    profileServiceMock.updateMyProfile.mockReturnValue(NEVER);

    component.save();
    refreshView();

    const saveButton = getCompiled().querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
    expect(saveButton.textContent).toContain('Saving');

    component.save();
    expect(profileServiceMock.updateMyProfile).toHaveBeenCalledTimes(1);
  });

  it('shows a user-facing error when the profile fails to load', async () => {
    profileServiceMock.getMyProfile.mockReturnValue(
      throwError(() => new Error('internal stack trace'))
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const errorState = getCompiled().querySelector('.profile-error');

    expect(errorState?.textContent).toContain(
      'Unable to load your profile.'
    );
    expect(errorState?.textContent).not.toContain('internal stack');
  });

  it('renders the profile as soon as the async load completes', async () => {
    const pendingProfile = new Subject<{
      profile: typeof sampleProfile;
    }>();

    profileServiceMock.getMyProfile.mockReturnValue(
      pendingProfile.asObservable()
    );

    fixture.detectChanges();

    // While the request is in flight the loading state is shown.
    expect(getCompiled().querySelector('.profile-loading')).not.toBeNull();

    pendingProfile.next({ profile: sampleProfile });

    // No fixture.detectChanges() on purpose: the component itself must
    // refresh the view when the async response arrives.
    expect(getCompiled().querySelector('.profile-loading')).toBeNull();

    const nameInput = getCompiled().querySelector(
      '#name'
    ) as HTMLInputElement;

    expect(nameInput.value).toBe('Profile Alpha');
  });

  it('clears the saving state as soon as the update completes', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const pendingUpdate = new Subject<{
      message: string;
      profile: typeof sampleProfile;
    }>();

    profileServiceMock.updateMyProfile.mockReturnValue(
      pendingUpdate.asObservable()
    );

    component.save();

    expect(component.saving).toBe(true);

    pendingUpdate.next({
      message: 'Profile updated successfully.',
      profile: sampleProfile,
    });

    // No fixture.detectChanges() on purpose: the component itself must
    // clear the saving state and show the success message.
    const saveButton = getCompiled().querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(false);
    expect(saveButton.textContent).toContain('Save Changes');
    expect(
      getCompiled().querySelector('.save-message')?.textContent
    ).toContain('Profile updated successfully.');
  });
});

describe('ProfilePage route protection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('registers the profile page behind the existing auth guard', () => {
    const profileRoute = routes.find((route) => route.path === 'profile');

    expect(profileRoute?.component).toBe(ProfilePage);
    expect(profileRoute?.canActivate).toContain(authGuard);
  });

  it('redirects unauthenticated visitors away from the profile page', async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/profile' } as RouterStateSnapshot
      )
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/login');
  });
});
