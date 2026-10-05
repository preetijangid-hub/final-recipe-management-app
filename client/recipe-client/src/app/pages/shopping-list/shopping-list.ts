import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ShoppingListDocument, ShoppingListItem } from '../../models/shopping-list';
import { ShoppingListService } from '../../services/shopping-list';

@Component({
  selector: 'app-shopping-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shopping-list.html',
  styleUrl: './shopping-list.css',
})
export class ShoppingListPage implements OnInit {
  private readonly shoppingListService = inject(ShoppingListService);

  selectedWeekStart = this.getStartOfCurrentWeek();
  shoppingList: ShoppingListDocument | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.loadWeekShoppingList();
  }

  get items(): ShoppingListItem[] {
    return this.shoppingList?.items ?? [];
  }

  loadWeekShoppingList(): void {
    this.loading = true;
    this.error = '';

    this.shoppingListService.getWeekShoppingList(this.selectedWeekStart).subscribe({
      next: ({ shoppingList }) => {
        this.shoppingList = shoppingList;
        this.loading = false;
      },
      error: () => {
        this.error = 'We could not load your shopping list.';
        this.loading = false;
      },
    });
  }

  refreshShoppingList(): void {
    this.shoppingListService.refreshWeekShoppingList(this.selectedWeekStart).subscribe({
      next: ({ shoppingList }) => {
        this.shoppingList = shoppingList;
      },
      error: () => {
        this.error = 'The shopping list could not be refreshed.';
      },
    });
  }

  toggleItem(item: ShoppingListItem): void {
    if (!this.shoppingList?._id) {
      return;
    }

    this.shoppingListService.toggleShoppingItem(this.shoppingList._id, item.name, !item.checked).subscribe({
      next: ({ shoppingList }) => {
        this.shoppingList = shoppingList;
      },
      error: () => {
        this.error = 'The item could not be updated.';
      },
    });
  }

  printPage(): void {
    window.print();
  }

  previousWeek(): void {
    const currentDate = this.parseDateKey(this.selectedWeekStart);
    const previous = new Date(currentDate);
    previous.setDate(previous.getDate() - 7);
    this.selectedWeekStart = this.formatDateKey(previous);
    this.loadWeekShoppingList();
  }

  nextWeek(): void {
    const currentDate = this.parseDateKey(this.selectedWeekStart);
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    this.selectedWeekStart = this.formatDateKey(next);
    this.loadWeekShoppingList();
  }

  jumpToCurrentWeek(): void {
    this.selectedWeekStart = this.getStartOfCurrentWeek();
    this.loadWeekShoppingList();
  }

  formatIngredient(item: ShoppingListItem): string {
    const quantity = Number(item.quantity) || 0;
    const amountText = Number.isInteger(quantity) ? String(quantity) : Number(quantity.toFixed(2)).toString();
    const unitText = item.unit ? ` ${this.formatUnit(item.unit, quantity)}` : '';
    return `${item.name} — ${amountText}${unitText}`;
  }

  private formatUnit(unit: string, quantity: number): string {
    if (!unit) {
      return '';
    }

    if (unit === 'cup') {
      return quantity === 1 ? 'cup' : 'cups';
    }

    if (['g', 'kg', 'ml', 'l', 'lb', 'oz', 'tbsp', 'tsp'].includes(unit)) {
      return unit;
    }

    if (unit.endsWith('s')) {
      return unit;
    }

    return quantity === 1 ? unit : `${unit}s`;
  }

  private parseDateKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getStartOfCurrentWeek(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayIndex = (today.getDay() + 6) % 7;
    today.setDate(today.getDate() - dayIndex);
    return this.formatDateKey(today);
  }
}
