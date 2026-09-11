import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { RecipeDetails } from './recipe-details';

describe('RecipeDetails', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeDetails],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RecipeDetails);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should report a missing recipe id as an error state', () => {
    const fixture = TestBed.createComponent(RecipeDetails);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage).toContain(
      'Recipe ID was not found'
    );
  });
});

