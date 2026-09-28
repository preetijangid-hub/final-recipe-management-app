import { Injectable, signal } from '@angular/core';

import { Sentiment } from '../models/review';

// DistilBERT classifier fine-tuned on the SST-2 sentiment dataset.
// It runs fully in the browser through Transformers.js, so no review
// text ever leaves the user's device.
const SENTIMENT_MODEL =
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english';

// Scores below this value mean the model is not confident enough about
// either class, so the review is treated as neutral.
const NEUTRAL_CONFIDENCE = 0.75;

type ClassifierResult = {
  label: string;
  score: number;
};

type SentimentClassifier = (
  text: string
) => Promise<ClassifierResult[]>;

// SST-2 can only answer positive or negative, so it has no real neutral
// class and confidently labels short neutral comments too ("average"
// comes back as POSITIVE). It is English-only as well, so Hinglish
// replies like "thik thak" mean nothing to it. Comments made up of
// clearly neutral words are therefore recognised here before the model
// runs. A comment only counts as neutral when every single word is on
// this list, so opinions like "I loved this recipe" or "worst" still
// reach the model. Words like "not" are left out on purpose, so
// negated comments such as "not average" are judged by the model too.
const NEUTRAL_WORDS = new Set([
  'a', 'an', 'the', 'it', 'its', 'this', 'that',
  'was', 'is', 'were',
  'average', 'okay', 'ok', 'meh', 'mediocre', 'so',
  'taste', 'tasted', 'flavor', 'food', 'dish', 'recipe', 'meal',
  'pretty', 'really', 'quite', 'just', 'very', 'overall', 'honestly',
  // Roman Hindi words for "just okay" replies like "thik thak".
  'thik', 'thak', 'theek', 'thaak', 'hai', 'bas',
]);

export const isClearlyNeutral = (text: string): boolean => {
  const words = text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return false;
  }

  return words.every((word) => NEUTRAL_WORDS.has(word));
};

export const mapSentimentResult = (
  result?: ClassifierResult
): Sentiment => {
  if (!result || !Number.isFinite(result.score)) {
    return 'Unknown';
  }

  if (result.score < NEUTRAL_CONFIDENCE) {
    return 'Neutral';
  }

  const label = result.label.toUpperCase();

  if (label.includes('POS')) {
    return 'Positive';
  }

  if (label.includes('NEG')) {
    return 'Negative';
  }

  return 'Unknown';
};

@Injectable({
  providedIn: 'root',
})
export class SentimentService {
  readonly modelLoading = signal(false);

  private classifierPromise: Promise<SentimentClassifier | null> | null = null;

  // Returns 'Unknown' whenever the model is unavailable so that
  // submitting reviews keeps working without the tone badge.
  async analyze(text: string): Promise<Sentiment> {
    if (isClearlyNeutral(text)) {
      return 'Neutral';
    }

    const classifier = await this.getClassifier();

    if (!classifier) {
      return 'Unknown';
    }

    try {
      const results = await classifier(text);

      return mapSentimentResult(results[0]);
    } catch {
      return 'Unknown';
    }
  }

  private getClassifier(): Promise<SentimentClassifier | null> {
    if (!this.classifierPromise) {
      this.modelLoading.set(true);

      this.classifierPromise = import('@huggingface/transformers')
        .then((transformers) => {
          transformers.env.allowLocalModels = false;

          return transformers.pipeline(
            'sentiment-analysis',
            SENTIMENT_MODEL
          ) as Promise<SentimentClassifier>;
        })
        .catch(() => null)
        .finally(() => this.modelLoading.set(false));
    }

    return this.classifierPromise;
  }
}