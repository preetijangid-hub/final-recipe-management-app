import { Injectable, signal } from '@angular/core';

import { Recipe } from '../models/recipe';

// Sentence embedding model, small enough to run in the browser and good at
// matching recipes that are described with different words. It is loaded
// through Transformers.js, so no recipe text ever leaves the device.
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type FeatureExtractor = (
  text: string,
  options: {
    pooling: 'mean';
    normalize: boolean;
  }
) => Promise<{ data: ArrayLike<number> }>;

export interface SimilarRecipe {
  recipe: Recipe;
  score: number;
}

// Cosine similarity of two embedding vectors. It is exported on its own so
// it can be unit tested without downloading the model.
export const cosineSimilarity = (
  first: ArrayLike<number>,
  second: ArrayLike<number>
): number => {
  if (!first || !second || first.length === 0 || first.length !== second.length) {
    return 0;
  }

  let dotProduct = 0;
  let firstLength = 0;
  let secondLength = 0;

  for (let index = 0; index < first.length; index += 1) {
    dotProduct += first[index] * second[index];
    firstLength += first[index] * first[index];
    secondLength += second[index] * second[index];
  }

  if (firstLength === 0 || secondLength === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(firstLength) * Math.sqrt(secondLength));
};

// Title, ingredients and description carry the meaning of a recipe. The
// steps are left out because they are long and add little to the match.
export const buildEmbeddingText = (recipe: Recipe): string => {
  const parts = [
    recipe.title,
    recipe.category,
    recipe.mealCategory,
    recipe.description,
    (recipe.ingredients ?? []).join(', '),
  ];

  return parts
    .filter((part) => !!part && String(part).trim().length > 0)
    .join('. ');
};

// Cheap content fingerprint, so a cached embedding is reused only while the
// text it was built from is still the same.
const hashText = (text: string): string => {
  let hash = 5381;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) % 2147483647;
  }

  return hash.toString(36);
};

@Injectable({
  providedIn: 'root',
})
export class RecipeEmbeddingsService {
  // True while the model is being downloaded, so the UI can explain the
  // wait without blocking anything else.
  readonly modelLoading = signal(false);

  // Set when the model cannot be used at all on this device.
  readonly unavailable = signal(false);

  private extractorPromise: Promise<FeatureExtractor | null> | null = null;

  private readonly cache = new Map<string, number[]>();

  // Ranks the candidates by how close they are to the target recipe. The
  // target itself is never part of the result, and recipes the model could
  // not be embedded for are simply skipped.
  async findSimilarRecipes(
    target: Recipe,
    candidates: Recipe[],
    limit = 4
  ): Promise<SimilarRecipe[]> {
    const targetVector = await this.embedRecipe(target);

    if (!targetVector) {
      return [];
    }

    const scored: SimilarRecipe[] = [];

    for (const candidate of candidates) {
      if (candidate._id === target._id) {
        continue;
      }

      const vector = await this.embedRecipe(candidate);

      if (!vector) {
        continue;
      }

      scored.push({
        recipe: candidate,
        score: cosineSimilarity(targetVector, vector),
      });
    }

    return scored
      .sort((first, second) => second.score - first.score)
      .slice(0, limit);
  }

  // Returns null whenever the model is unavailable, which the caller shows
  // as a friendly message instead of an error.
  async embedRecipe(recipe: Recipe): Promise<number[] | null> {
    const text = buildEmbeddingText(recipe);
    const cacheKey = `${recipe._id}:${hashText(text)}`;

    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const extractor = await this.getExtractor();

    if (!extractor) {
      return null;
    }

    try {
      const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      const vector = Array.from(output.data);

      this.cache.set(cacheKey, vector);

      return vector;
    } catch {
      return null;
    }
  }

  private getExtractor(): Promise<FeatureExtractor | null> {
    if (!this.extractorPromise) {
      this.modelLoading.set(true);

      // The model is imported only on the first call, so browsing and
      // searching stay fast for users who never open the suggestions.
      this.extractorPromise = import('@huggingface/transformers')
        .then((transformers) => {
          transformers.env.allowLocalModels = false;

          return transformers.pipeline(
            'feature-extraction',
            EMBEDDING_MODEL
          ) as unknown as Promise<FeatureExtractor>;
        })
        .catch(() => {
          this.unavailable.set(true);

          return null;
        })
        .finally(() => this.modelLoading.set(false));
    }

    return this.extractorPromise;
  }
}
