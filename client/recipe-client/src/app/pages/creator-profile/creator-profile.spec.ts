import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CreatorProfilePage } from './creator-profile';
import { ProfileService } from '../../services/profile';
import { routes } from '../../app.routes';

@Component({
  standalone: true,
  template: '',
})
class RecipeTarget {}

describe('CreatorProfilePage', () => {
  const profileServiceMock = {
    getPublicProfile: vi.fn(),
    getCreatorRecipes: vi.fn(),
  };

  const paramMap = new BehaviorSubject(
    convertToParamMap({ userId: 'creator-1' })
  );

  const sampleProfile = {
    _id: 'creator-1',
    name: 'Preeti Jangid',
    profession: 'Data Scientist',
    profilePhoto: 'https://example.com/creators/preeti.jpg',
  };

  const sampleRecipe = {
    _id: '65a123456789012345678901',
    title: 'Masala Oats',
    description: 'A quick breakfast.',
    image: 'https://example.com/masala-oats.jpg',
    ingredients: ['Oats'],
    steps: ['Cook'],
    category: 'Indian',
    mealCategory: 'Breakfast',
    user: 'creator-1',
  };

  let fixture: ComponentFixture<CreatorProfilePage>;

  const flushAsyncWork = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  const getCompiled = (): HTMLElement =>
    fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();

    profileServiceMock.getPublicProfile.mockReturnValue(
      of({ profile: sampleProfile })
    );
    profileServiceMock.getCreatorRecipes.mockReturnValue(
      of({ recipes: [sampleRecipe] })
    );

    await TestBed.configureTestingModule({
      imports: [CreatorProfilePage],
      providers: [
        provideRouter([
          { path: 'recipes/:id', component: RecipeTarget },
        ]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatorProfilePage);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('loads the profile and recipes for the route user', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    expect(profileServiceMock.getPublicProfile).toHaveBeenCalledWith(
      'creator-1'
    );
    expect(profileServiceMock.getCreatorRecipes).toHaveBeenCalledWith(
      'creator-1'
    );
  });

  it('renders the creator name', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    expect(getCompiled().querySelector('h1')?.textContent).toContain(
      'Preeti Jangid'
    );
  });

  it('renders the profession', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    expect(
      getCompiled().querySelector('.creator-profession')?.textContent
    ).toContain('Data Scientist');
  });

  it('renders the profile photo', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const photo = getCompiled().querySelector(
      '.creator-photo img'
    ) as HTMLImageElement;

    expect(photo.getAttribute('src')).toBe(
      'https://example.com/creators/preeti.jpg'
    );
  });

  it('shows a placeholder when the photo is missing', async () => {
    profileServiceMock.getPublicProfile.mockReturnValue(
      of({ profile: { ...sampleProfile, profilePhoto: '' } })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const compiled = getCompiled();

    expect(compiled.querySelector('.creator-photo img')).toBeNull();
    expect(
      compiled.querySelector('.photo-placeholder')?.textContent
    ).toContain('P');
  });

  it('hides the profession row when the creator has none', async () => {
    profileServiceMock.getPublicProfile.mockReturnValue(
      of({ profile: { ...sampleProfile, profession: '' } })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    expect(getCompiled().querySelector('.creator-profession')).toBeNull();
  });

  it('renders the creator recipes', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const cards = getCompiled().querySelectorAll('.recipe-card');

    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Masala Oats');
  });

  it('renders an empty state when there are no recipes', async () => {
    profileServiceMock.getCreatorRecipes.mockReturnValue(
      of({ recipes: [] })
    );

    fixture.detectChanges();
    await flushAsyncWork();

    expect(
      getCompiled().querySelector('.empty-state')?.textContent
    ).toContain('not published any recipes');
    expect(getCompiled().querySelector('.recipe-card')).toBeNull();
  });

  it('shows a loading state while the profile is fetched', () => {
    profileServiceMock.getPublicProfile.mockReturnValue(NEVER);

    fixture.detectChanges();

    expect(getCompiled().querySelector('.creator-loading')).not.toBeNull();
    expect(getCompiled().querySelector('.creator-card')).toBeNull();
  });

  it('handles a profile API error', async () => {
    profileServiceMock.getPublicProfile.mockReturnValue(
      throwError(() => ({ status: 500 }))
    );

    fixture.detectChanges();
    await flushAsyncWork();

    expect(
      getCompiled().querySelector('.creator-error')?.textContent
    ).toContain('Unable to load this creator profile.');
  });

  it('shows a not-found message for a missing creator', async () => {
    profileServiceMock.getPublicProfile.mockReturnValue(
      throwError(() => ({ status: 404 }))
    );

    fixture.detectChanges();
    await flushAsyncWork();

    expect(
      getCompiled().querySelector('.creator-error')?.textContent
    ).toContain('not found');
  });

  it('handles a recipes API error while keeping the profile visible', async () => {
    profileServiceMock.getCreatorRecipes.mockReturnValue(
      throwError(() => ({ status: 500 }))
    );

    fixture.detectChanges();
    await flushAsyncWork();

    const compiled = getCompiled();

    expect(compiled.querySelector('.recipes-error')?.textContent).toContain(
      'Unable to load recipes'
    );
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Preeti Jangid'
    );
  });

  it('links each creator recipe to its details route', async () => {
    fixture.detectChanges();
    await flushAsyncWork();

    const card = getCompiled().querySelector(
      '.recipe-card'
    ) as HTMLAnchorElement;

    card.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(
      `/recipes/${sampleRecipe._id}`
    );
  });

  it('registers the public creator route', () => {
    const creatorRoute = routes.find(
      (route) => route.path === 'creators/:userId'
    );

    expect(creatorRoute?.component).toBe(CreatorProfilePage);
  });

  it('leaves the public creator route without an auth guard', () => {
    const creatorRoute = routes.find(
      (route) => route.path === 'creators/:userId'
    );

    expect(creatorRoute?.canActivate).toBeUndefined();
  });
});