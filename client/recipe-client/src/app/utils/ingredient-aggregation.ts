export type IngredientKind = 'count' | 'weight' | 'volume' | 'unknown';

export interface ParsedIngredient {
  quantity: number;
  unit: string;
  name: string;
  kind: IngredientKind;
}

export interface AggregatedIngredient {
  name: string;
  quantity: number;
  unit: string;
  kind: IngredientKind;
  display: string;
}

const unitAliases: Record<string, { kind: IngredientKind; base: number }> = {
  g: { kind: 'weight', base: 1 },
  gram: { kind: 'weight', base: 1 },
  grams: { kind: 'weight', base: 1 },
  kg: { kind: 'weight', base: 1000 },
  kilogram: { kind: 'weight', base: 1000 },
  kilograms: { kind: 'weight', base: 1000 },
  mg: { kind: 'weight', base: 0.001 },
  oz: { kind: 'weight', base: 28.3495 },
  ounce: { kind: 'weight', base: 28.3495 },
  ounces: { kind: 'weight', base: 28.3495 },
  lb: { kind: 'weight', base: 453.592 },
  lbs: { kind: 'weight', base: 453.592 },
  pound: { kind: 'weight', base: 453.592 },
  pounds: { kind: 'weight', base: 453.592 },
  ml: { kind: 'volume', base: 1 },
  l: { kind: 'volume', base: 1000 },
  liter: { kind: 'volume', base: 1000 },
  litre: { kind: 'volume', base: 1000 },
  liters: { kind: 'volume', base: 1000 },
  litres: { kind: 'volume', base: 1000 },
  cup: { kind: 'volume', base: 240 },
  cups: { kind: 'volume', base: 240 },
  tbsp: { kind: 'volume', base: 15 },
  tablespoon: { kind: 'volume', base: 15 },
  tablespoons: { kind: 'volume', base: 15 },
  tsp: { kind: 'volume', base: 5 },
  teaspoon: { kind: 'volume', base: 5 },
  teaspoons: { kind: 'volume', base: 5 },
  clove: { kind: 'count', base: 1 },
  cloves: { kind: 'count', base: 1 },
  slice: { kind: 'count', base: 1 },
  slices: { kind: 'count', base: 1 },
  whole: { kind: 'count', base: 1 },
  can: { kind: 'count', base: 1 },
  cans: { kind: 'count', base: 1 },
  bunch: { kind: 'count', base: 1 },
  bunches: { kind: 'count', base: 1 },
  packet: { kind: 'count', base: 1 },
  packets: { kind: 'count', base: 1 },
  pack: { kind: 'count', base: 1 },
  packs: { kind: 'count', base: 1 },
  sprig: { kind: 'count', base: 1 },
  sprigs: { kind: 'count', base: 1 },
  piece: { kind: 'count', base: 1 },
  pieces: { kind: 'count', base: 1 },
  pinch: { kind: 'count', base: 1 },
};

const normalizeUnit = (value: string): string => {
  const unit = value.trim().toLowerCase();
  if (!unit) {
    return '';
  }

  if (unitAliases[unit]) {
    return unit.endsWith('s') ? unit.slice(0, -1) : unit;
  }

  const singular = unit.endsWith('s') ? unit.slice(0, -1) : unit;
  return unitAliases[singular] ? singular : unit;
};

const pluralizeUnit = (unit: string, quantity = 1): string => {
  if (!unit) {
    return '';
  }

  const normalized = unit.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (['g', 'kg', 'mg', 'oz', 'lb', 'ml', 'l'].includes(normalized)) {
    return normalized;
  }

  const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
  if (['cup', 'tablespoon', 'teaspoon', 'clove', 'slice', 'whole', 'can', 'bunch', 'packet', 'pack', 'sprig', 'piece', 'pinch'].includes(singular)) {
    return quantity === 1 ? singular : `${singular}s`;
  }

  return singular;
};

const cleanIngredientName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\s/.-]/g, ' ').trim();

const titleCaseName = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length === 1 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');

const parseNumeric = (value: string): number => {
  if (value.includes('/')) {
    const [numerator, denominator] = value.split('/');
    const left = Number(numerator);
    const right = Number(denominator);
    return right === 0 ? 0 : left / right;
  }

  return Number(value);
};

export function parseIngredientQuantity(input: string): ParsedIngredient | null {
  if (!input || !input.trim()) {
    return null;
  }

  const trimmed = input.trim();
  const match = trimmed.match(/^((?:\d+(?:\.\d+)?|\d+\/\d+))(?:\s*(?:x|X))?\s*(?:([A-Za-z]+)\s+)?(.+)$/);

  if (!match) {
    return null;
  }

  const [, rawAmount, rawUnit, remainder] = match;
  const cleaned = remainder ? remainder.trim() : '';
  if (!cleaned) {
    return null;
  }

  const unit = rawUnit ? normalizeUnit(rawUnit) : '';
  const kind = unit && unitAliases[unit] ? unitAliases[unit].kind : 'count';
  const name = cleanIngredientName(cleaned.replace(/^of\s+/i, ''));

  if (!name) {
    return null;
  }

  return {
    quantity: parseNumeric(rawAmount),
    unit,
    name,
    kind,
  };
}

const formatUnitLabel = (unit: string, quantity: number): string => {
  if (!unit) {
    return '';
  }

  const normalized = unit.trim().toLowerCase();
  return pluralizeUnit(normalized, quantity);
};

export function aggregateIngredientList(ingredients: string[], servingsScale = 1): AggregatedIngredient[] {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  const scale = Number(servingsScale) > 0 ? Number(servingsScale) : 1;
  const aggregate = new Map<string, { name: string; quantity: number; unit: string; kind: IngredientKind }>();

  for (const ingredient of ingredients) {
    const parsed = parseIngredientQuantity(ingredient);

    if (!parsed) {
      const cleanText = ingredient.trim();
      if (!cleanText) {
        continue;
      }

      const key = `unknown:${cleanIngredientName(cleanText)}`;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          name: cleanIngredientName(cleanText),
          quantity: 1,
          unit: '',
          kind: 'count',
        });
      }
      continue;
    }

    const key = `${parsed.kind}:${parsed.name}:${parsed.unit || 'count'}`;
    if (!aggregate.has(key)) {
      aggregate.set(key, {
        name: parsed.name,
        quantity: 0,
        unit: parsed.unit,
        kind: parsed.kind,
      });
    }

    const current = aggregate.get(key)!;
    current.quantity += parsed.quantity * scale;
    if (!current.unit && parsed.unit) {
      current.unit = parsed.unit;
    }
  }

  return Array.from(aggregate.values())
    .map((item) => {
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        return null;
      }

      const displayQuantity = Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(2));
      const displayUnit = formatUnitLabel(item.unit, displayQuantity);
      const display = item.unit ? `${displayQuantity} ${displayUnit}` : `${displayQuantity}`;

      return {
        name: titleCaseName(item.name),
        quantity: displayQuantity,
        unit: item.unit,
        kind: item.kind,
        display,
      };
    })
    .filter((item): item is AggregatedIngredient => item !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}
