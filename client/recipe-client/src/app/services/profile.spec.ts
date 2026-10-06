import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ProfileService } from './profile';
import { environment } from '../../environments/environment';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpTesting: HttpTestingController;

  const sampleProfile = {
    _id: 'user-1',
    name: 'Profile Alpha',
    email: 'alpha@example.com',
    profession: 'Chef',
    profilePhoto: 'https://example.com/avatar.jpg',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(ProfileService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('getMyProfile requests the authenticated profile endpoint', () => {
    service.getMyProfile().subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/profiles/me`
    );

    expect(request.request.method).toBe('GET');

    request.flush({ profile: sampleProfile });
  });

  it('updateMyProfile patches profession and photo to the my-profile endpoint', () => {
    service
      .updateMyProfile('https://example.com/new.jpg', 'Food Blogger')
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/profiles/me`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      profilePhoto: 'https://example.com/new.jpg',
      profession: 'Food Blogger',
    });

    request.flush({
      message: 'Profile updated successfully.',
      profile: { ...sampleProfile, profession: 'Food Blogger' },
    });
  });

  it('updateMyProfile sends an empty string to clear the photo', () => {
    service.updateMyProfile('', 'Chef').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/profiles/me`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      profilePhoto: '',
      profession: 'Chef',
    });

    request.flush({
      message: 'Profile updated successfully.',
      profile: { ...sampleProfile, profilePhoto: '' },
    });
  });

  it('getPublicProfile requests the public profile endpoint', () => {
    service.getPublicProfile('user-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/profiles/user-1`
    );

    expect(request.request.method).toBe('GET');

    request.flush({
      profile: {
        _id: 'user-1',
        name: 'Profile Alpha',
        profession: 'Chef',
        profilePhoto: '',
      },
    });
  });

  it('getCreatorRecipes requests the public creator recipes endpoint', () => {
    service.getCreatorRecipes('user-1').subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/profiles/user-1/recipes`
    );

    expect(request.request.method).toBe('GET');

    request.flush({ recipes: [] });
  });
});