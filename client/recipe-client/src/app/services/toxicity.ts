import { Injectable, signal } from '@angular/core';

// A high threshold keeps moderation conservative: only reviews that are
// clearly toxic get blocked. This is a helpful filter, not a perfect one.
const TOXICITY_THRESHOLD = 0.9;

const TOXIC_LABELS = [
  'identity_attack',
  'insult',
  'obscene',
  'severe_toxicity',
  'sexual_explicit',
  'threat',
  'toxicity',
];

type ToxicityPrediction = {
  label: string;
  results: Array<{ match: boolean }>;
};

// @tensorflow-models/toxicity still loads its model from TF Hub, which
// no longer serves the model (the request now returns a Kaggle web
// page), so the model is loaded from Google's current location instead.
const TOXICITY_MODEL_URL =
  'https://storage.googleapis.com/tfjs-models/savedmodel/toxicity/model.json';

type ToxicityModel = {
  classify: (texts: string[]) => Promise<ToxicityPrediction[]>;
};

export const isFlaggedAsToxic = (
  predictions?: ToxicityPrediction[]
): boolean => {
  if (!predictions) {
    return false;
  }

  return predictions.some((prediction) =>
    prediction.results.some((result) => result.match === true)
  );
};

@Injectable({
  providedIn: 'root',
})
export class ToxicityService {
  readonly modelLoading = signal(false);

  private modelPromise: Promise<ToxicityModel | null> | null = null;

  // Returns null when the model is unavailable so callers can fall back
  // to submitting the review without AI moderation. Nothing is cached
  // after a failure, so the next review will try loading the model again.
  async check(text: string): Promise<boolean | null> {
    const model = await this.getModel();

    if (!model) {
      return null;
    }

    try {
      const predictions = await model.classify([text]);

      return isFlaggedAsToxic(predictions);
    } catch {
      // The loaded model misbehaved, so drop it and reload next time.
      this.modelPromise = null;

      return null;
    }
  }

  private async getModel(): Promise<ToxicityModel | null> {
    if (!this.modelPromise) {
      this.modelLoading.set(true);

      this.modelPromise = import('@tensorflow-models/toxicity')
        .then(async (toxicity) => {
          const classifier = new toxicity.ToxicityClassifier(
            TOXICITY_THRESHOLD,
            TOXIC_LABELS
          );

          // The package's own loadModel() still points at TF Hub, so the
          // graph model is loaded from the current address and handed to
          // the classifier. Tokenizing and classifying stay library code.
          const tf = await import('@tensorflow/tfjs');
          const model = await tf.loadGraphModel(TOXICITY_MODEL_URL);
          const tokenizer = await classifier.loadTokenizer();

          const parts = classifier as unknown as {
            model: typeof model;
            tokenizer: typeof tokenizer;
            labels: string[];
          };

          parts.model = model;
          parts.tokenizer = tokenizer;
          parts.labels = model.outputs.map(
            (output) => output.name.split('/')[0]
          );

          return classifier as ToxicityModel;
        })
        .catch((error) => {
          // Surface the real reason (offline, blocked download, backend
          // error) instead of failing silently.
          console.warn('Toxicity model could not be loaded.', error);

          return null;
        })
        .finally(() => this.modelLoading.set(false));
    }

    const model = await this.modelPromise;

    // A failed load is not remembered, so the next review will retry
    // instead of moderation staying unavailable for the whole session.
    if (!model) {
      this.modelPromise = null;
    }

    return model;
  }
}