const { aggregateIngredientList } = require("../utils/ingredientAggregation");

describe("ingredient aggregation helper", () => {
  test("combines identical count items", () => {
    const result = aggregateIngredientList(["2 tomatoes", "3 tomatoes"]);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Tomatoes",
          quantity: 5,
          kind: "count",
        }),
      ])
    );
  });

  test("combines compatible volume units", () => {
    const result = aggregateIngredientList(["1 cup rice", "2 cups rice"]);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Rice",
          quantity: 3,
          unit: "cup",
          kind: "volume",
        }),
      ])
    );
  });

  test("combines compatible weight units", () => {
    const result = aggregateIngredientList(["500 g flour", "250 g flour"]);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Flour",
          quantity: 750,
          unit: "g",
          kind: "weight",
        }),
      ])
    );
  });

  test("keeps incompatible units separate", () => {
    const result = aggregateIngredientList(["1 kg flour", "2 cups flour"]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.name)).toEqual(["Flour", "Flour"]);
    expect(result.map((item) => item.unit)).toEqual(["kg", "cup"]);
  });
});
