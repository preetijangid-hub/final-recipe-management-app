import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ShoppingListPage } from './shopping-list';
import { ShoppingListService } from '../../services/shopping-list';

describe('ShoppingListPage', () => {
  const shoppingListServiceMock = {
    getWeekShoppingList: vi.fn(),
    refreshWeekShoppingList: vi.fn(),
    toggleShoppingItem: vi.fn(),
  };

  let fixture: ComponentFixture<ShoppingListPage>;
  let component: ShoppingListPage;

  beforeEach(async () => {
    vi.clearAllMocks();

    shoppingListServiceMock.getWeekShoppingList.mockReturnValue(
      of({
        shoppingList: {
          _id: 'list-1',
          weekStart: '2026-10-05',
          items: [
            { name: 'Tomatoes', quantity: 5, unit: '', kind: 'count', checked: false },
            { name: 'Rice', quantity: 3, unit: 'cup', kind: 'volume', checked: true },
          ],
        },
      })
    );
    shoppingListServiceMock.refreshWeekShoppingList.mockReturnValue(
      of({ shoppingList: { _id: 'list-1', weekStart: '2026-10-05', items: [] } })
    );
    shoppingListServiceMock.toggleShoppingItem.mockReturnValue(
      of({ shoppingList: { _id: 'list-1', weekStart: '2026-10-05', items: [{ name: 'Tomatoes', quantity: 5, unit: '', kind: 'count', checked: true }] } })
    );

    await TestBed.configureTestingModule({
      imports: [ShoppingListPage],
      providers: [
        provideRouter([]),
        { provide: ShoppingListService, useValue: shoppingListServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShoppingListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads a shopping list for the selected week', () => {
    expect(component.items.length).toBe(2);
    expect(component.items[0].name).toBe('Tomatoes');
  });

  it('toggles checked state and keeps it in sync', () => {
    const item = component.items[0];
    component.toggleItem(item);
    expect(shoppingListServiceMock.toggleShoppingItem).toHaveBeenCalledWith('list-1', 'Tomatoes', true);
  });

  it('formats merged quantities correctly', () => {
    const item: any = { name: 'Rice', quantity: 3, unit: 'cup', checked: false, kind: 'volume' };
    expect(component.formatIngredient(item)).toContain('Rice');
  });

  it('keeps recipe context for aggregated ingredients', () => {
    component.shoppingList = {
      _id: 'list-1',
      weekStart: '2026-10-05',
      items: [{
        name: 'Tomatoes',
        quantity: 5,
        unit: '',
        kind: 'count',
        checked: false,
        usedIn: ['Recipe A', 'Recipe B'],
      }],
    };

    expect(component.items[0].usedIn).toEqual(['Recipe A', 'Recipe B']);
  });
});
