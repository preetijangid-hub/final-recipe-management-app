import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Recipes } from './pages/recipes/recipes';
import { NotFound } from './pages/not-found/not-found';
import { RecipeDetails } from './pages/recipe-details/recipe-details';

import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'recipes', pathMatch: 'full' },

  { path: 'login', component: Login },

  { path: 'register', component: Register },

  {
    path: 'recipes',
    component: Recipes,
    canActivate: [authGuard],
  },

  {
    path: 'recipes/:id',
    component: RecipeDetails,
    canActivate: [authGuard],
  },

  { path: '**', component: NotFound },
];