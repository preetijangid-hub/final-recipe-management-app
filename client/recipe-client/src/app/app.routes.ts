import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Recipes } from './pages/recipes/recipes';
import { NotFound } from './pages/not-found/not-found';
import { RecipeDetails } from './pages/recipe-details/recipe-details';
import { Dashboard } from './pages/dashboard/dashboard';
import { FoodPreferences } from './pages/food-preferences/food-preferences';
import { AssistantPage } from './pages/assistant/assistant';
import { CategoriesPage } from './pages/categories/categories';
import { MyRecipesPage } from './pages/my-recipes/my-recipes';
import { AddRecipePage } from './pages/add-recipe/add-recipe';

import { authGuard, publicGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    component: Login,
    canActivate: [publicGuard],
  },

  {
    path: 'register',
    component: Register,
    canActivate: [publicGuard],
  },

  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
  },

  {
    path: 'discover',
    component: Recipes,
    canActivate: [authGuard],
  },

  {
    path: 'recipes',
    component: Recipes,
    canActivate: [authGuard],
  },

  {
    path: 'categories',
    component: CategoriesPage,
    canActivate: [authGuard],
  },

  {
    path: 'my-recipes',
    component: MyRecipesPage,
    canActivate: [authGuard],
  },

  {
    path: 'add-recipe',
    component: AddRecipePage,
    canActivate: [authGuard],
  },

  {
    path: 'food-assistant',
    component: AssistantPage,
    canActivate: [authGuard],
  },

  {
    path: 'preferences',
    component: FoodPreferences,
    canActivate: [authGuard],
  },

  {
    path: 'assistant',
    component: AssistantPage,
    canActivate: [authGuard],
  },

  {
    path: 'recipes/:id',
    component: RecipeDetails,
    canActivate: [authGuard],
  },

  { path: '**', component: NotFound },
];