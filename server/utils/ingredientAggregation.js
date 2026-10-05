const UNIT_ALIASES = {
  g: { kind: "weight", base: 1 },
  gram: { kind: "weight", base: 1 },
  grams: { kind: "weight", base: 1 },
  kg: { kind: "weight", base: 1000 },
  kilogram: { kind: "weight", base: 1000 },
  kilograms: { kind: "weight", base: 1000 },
  mg: { kind: "weight", base: 0.001 },
  oz: { kind: "weight", base: 28.3495 },
  ounce: { kind: "weight", base: 28.3495 },
  ounces: { kind: "weight", base: 28.3495 },
  lb: { kind: "weight", base: 453.592 },
  lbs: { kind: "weight", base: 453.592 },
  pound: { kind: "weight", base: 453.592 },
  pounds: { kind: "weight", base: 453.592 },
  ml: { kind: "volume", base: 1 },
  l: { kind: "volume", base: 1000 },
  litre: { kind: "volume", base: 1000 },
  liters: { kind: "volume", base: 1000 },
  liter: { kind: "volume", base: 1000 },
  litres: { kind: "volume", base: 1000 },
  cup: { kind: "volume", base: 240 },
  cups: { kind: "volume", base: 240 },
  tbsp: { kind: "volume", base: 15 },
  tablespoon: { kind: "volume", base: 15 },
  tablespoons: { kind: "volume", base: 15 },
  tsp: { kind: "volume", base: 5 },
  teaspoon: { kind: "volume", base: 5 },
  teaspoons: { kind: "volume", base: 5 },
  clove: { kind: "count", base: 1 },
  cloves: { kind: "count", base: 1 },
  slice: { kind: "count", base: 1 },
  slices: { kind: "count", base: 1 },
  whole: { kind: "count", base: 1 },
  can: { kind: "count", base: 1 },
  cans: { kind: "count", base: 1 },
  bunch: { kind: "count", base: 1 },
  bunches: { kind: "count", base: 1 },
  packet: { kind: "count", base: 1 },
  packets: { kind: "count", base: 1 },
  pack: { kind: "count", base: 1 },
  packs: { kind: "count", base: 1 },
  sprig: { kind: "count", base: 1 },
  sprigs: { kind: "count", base: 1 },
  piece: { kind: "count", base: 1 },
  pieces: { kind: "count", base: 1 },
  pinch: { kind: "count", base: 1 },
};

const normalizeUnitName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (UNIT_ALIASES[normalized]) {
    return normalized.replace(/s$/, "");
  }

  const singular = normalized.replace(/s$/, "");
  return UNIT_ALIASES[singular] ? singular : normalized;
};

const pluralizeUnit = (unit, quantity = 1) => {
  if (!unit || typeof unit !== "string") {
    return "";
  }

  const normalized = unit.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (["g", "kg", "mg", "oz", "lb", "ml", "l"].includes(normalized)) {
    return normalized;
  }

  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;

  if (["cup", "tablespoon", "teaspoon", "clove", "slice", "whole", "can", "bunch", "packet", "pack", "sprig", "piece", "pinch"].includes(singular)) {
    return Number(quantity) === 1 ? singular : `${singular}s`;
  }

  return singular;
};

const normalizeIngredientName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const titleCaseName = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length === 1) {
        return word.toUpperCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

const parseFraction = (value) => {
  if (typeof value !== "string") {
    return Number(value) || 0;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.includes("/")) {
    const [numerator, denominator] = trimmed.split("/");
    const left = Number(numerator);
    const right = Number(denominator);

    if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
      return 0;
    }

    return left / right;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseIngredientQuantity = (ingredientText) => {
  if (typeof ingredientText !== "string") {
    return null;
  }

  const trimmed = ingredientText.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^((?:\d+(?:\.\d+)?|\d+\/\d+))(?:\s*(?:x|X))?\s*(?:([A-Za-z]+)\s+)?(.+)$/);

  if (!match) {
    return null;
  }

  const [, rawAmount, rawUnit, remainder] = match;
  const amount = parseFraction(rawAmount);
  const cleanedRemainder = remainder ? remainder.trim() : "";

  if (!cleanedRemainder) {
    return null;
  }

  let normalizedUnit = rawUnit ? normalizeUnitName(rawUnit) : "";
  const unitMetadata = normalizedUnit ? UNIT_ALIASES[normalizedUnit] : null;
  const kind = unitMetadata ? unitMetadata.kind : "count";
  const name = normalizeIngredientName(cleanedRemainder.replace(/^of\s+/i, ""));

  if (!name) {
    return null;
  }

  if (!unitMetadata && rawUnit && rawUnit.trim()) {
    normalizedUnit = "";
  }

  return {
    original: trimmed,
    quantity: Number.isFinite(amount) ? amount : 0,
    unit: normalizedUnit,
    name,
    kind,
  };
};

const formatUnitLabel = (unit, quantity) => {
  if (!unit) {
    return "";
  }

  const normalized = unit.trim().toLowerCase();
  const numericQuantity = Number(quantity) || 0;

  return pluralizeUnit(normalized, numericQuantity);
};

const formatDisplayQuantity = (quantity, unit) => {
  const safeQuantity = Number(quantity) || 0;
  const rounded = Number.isInteger(safeQuantity) ? safeQuantity : Number(safeQuantity.toFixed(2));
  const unitLabel = formatUnitLabel(unit, rounded);

  if (!unit) {
    return String(rounded);
  }

  return `${rounded} ${unitLabel}`;
};

const formatQuantityForDisplay = (quantity, unit) => {
  const number = Number(quantity) || 0;
  const normalized = Number.isInteger(number) ? number : Number(number.toFixed(2));
  const unitLabel = formatUnitLabel(unit, normalized);

  if (!unit) {
    return String(normalized);
  }

  return `${normalized} ${unitLabel}`;
};

const aggregateIngredientList = (ingredients, servingsScale = 1) => {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  const scale = Number(servingsScale) > 0 ? Number(servingsScale) : 1;
  const aggregate = new Map();

  for (const ingredient of ingredients) {
    const parsed = parseIngredientQuantity(ingredient);

    if (!parsed) {
      const cleanText = String(ingredient || "").trim();
      if (!cleanText) {
        continue;
      }

      const key = `unknown:${normalizeIngredientName(cleanText)}`;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          name: normalizeIngredientName(cleanText),
          quantity: 1,
          unit: "",
          kind: "count",
          label: titleCaseName(cleanText),
        });
      }
      continue;
    }

    const quantity = parsed.quantity * scale;
    const key = `${parsed.kind}:${parsed.name}:${parsed.unit || "count"}`;
    if (!aggregate.has(key)) {
      aggregate.set(key, {
        name: parsed.name,
        quantity: 0,
        unit: parsed.unit,
        kind: parsed.kind,
      });
    }

    const current = aggregate.get(key);
    current.quantity += quantity;
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

      const displayName = titleCaseName(item.name);
      const unit = item.unit || "";
      const normalizedUnit = unit ? normalizeUnitName(unit) : "";
      return {
        name: displayName,
        quantity,
        unit: normalizedUnit || unit,
        kind: item.kind,
        display: formatQuantityForDisplay(quantity, normalizedUnit || unit),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
};

module.exports = {
  parseIngredientQuantity,
  aggregateIngredientList,
  formatDisplayQuantity,
  formatQuantityForDisplay,
  normalizeIngredientName,
  titleCaseName,
  normalizeUnitName,
  UNIT_ALIASES,
};
