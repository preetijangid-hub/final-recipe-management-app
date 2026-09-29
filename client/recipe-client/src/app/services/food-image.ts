import { Injectable, signal } from '@angular/core';

import { isSupportedImage } from '../utils/image-file';

// MobileNet answers with one of the 1000 ImageNet classes. That list has no
// single "food" label, so the predictions are matched against the words
// below: the dishes, fruit and vegetables it knows, plus the plates, bowls
// and pans that a photo of homemade food usually looks like. Kitchen
// context words count as food on purpose, so a real meal is never wrongly
// flagged.
const FOOD_KEYWORDS = [
  // Dishes and prepared food.
  'guacamole', 'consomme', 'hot pot', 'hotpot', 'trifle', 'carbonara',
  'chocolate sauce', 'chocolate syrup', 'pizza', 'potpie', 'burrito',
  'meat loaf', 'meatloaf', 'dough', 'mashed potato',
  // Bread, snacks and sweets.
  'french loaf', 'bagel', 'pretzel', 'cheeseburger', 'hotdog', 'hot dog',
  'ice cream', 'icecream', 'ice lolly', 'lolly', 'popsicle', 'eggnog',
  // Fruit and vegetables.
  'cabbage', 'broccoli', 'cauliflower', 'zucchini', 'courgette', 'squash',
  'cucumber', 'artichoke', 'bell pepper', 'cardoon', 'mushroom',
  'granny smith', 'strawberry', 'orange', 'lemon', 'fig', 'pineapple',
  'ananas', 'banana', 'jackfruit', 'custard apple', 'pomegranate', 'corn',
  // Drinks.
  'red wine', 'espresso',
  // Plates, bowls and tableware.
  'plate', 'soup bowl', 'mixing bowl', 'cup', 'coffee mug', 'goblet',
  'teapot', 'coffeepot', 'water jug', 'whiskey jug', 'tray', 'wooden spoon',
  'spatula', 'ladle', 'napkin',
  // Cooking and kitchen equipment.
  'wok', 'dutch oven', 'crock pot', 'caldron', 'cauldron', 'frying pan',
  'skillet', 'stove', 'waffle iron', 'microwave', 'refrigerator',
  'measuring cup', 'saltshaker', 'salt shaker', 'dining table', 'dishrag',
  'dishcloth',
  // Food shops and menus.
  'menu', 'restaurant', 'grocery store', 'food market', 'bakery',
  'butcher shop', 'meat market', 'confectionery', 'candy store',
  // Bottles and jars that usually hold food or drink.
  'milk can', 'water bottle', 'wine bottle', 'beer bottle', 'pop bottle',
  'soda bottle', 'beer glass', 'corkscrew', 'can opener', 'bottlecap',
];

// MobileNet spreads its probability over the 1000 ImageNet classes, so even
// a subject it names correctly usually lands between 0.2 and 0.5: a pizza
// reaches about 0.9, but a photo of a dog, a temple or a painting is named at
// 0.2 to 0.6. Judging that number against a fixed 0.6 cut-off threw away most
// honest answers, so the leading guess is trusted when it clears this floor
// and clearly beats the class behind it.
export const MIN_FOOD_CONFIDENCE = 0.25;
export const MIN_LEADING_RATIO = 2;

// The model is loaded from Google's hosting because the package default
// still points at TF Hub, which no longer serves these models. This is the
// 224x224 MobileNetV2 build with pixel values in the [0, 1] range.
const MOBILENET_MODEL_URL =
  'https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json';

export type FoodImageStatus = 'food' | 'not-food' | 'uncertain';

export interface ImagePrediction {
  className: string;
  probability: number;
}

interface ImageModel {
  classify(
    image: HTMLImageElement,
    topk?: number
  ): Promise<ImagePrediction[]>;
}

export const isFoodLabel = (className: string): boolean => {
  const label = className.toLowerCase();

  return FOOD_KEYWORDS.some((keyword) => label.includes(keyword));
};

// The first few guesses are read together. A food or kitchen class anywhere
// among them means the picture may well be a meal, so the user is never
// warned about their own cooking. The picture is only called non-food when
// the leading class says something else and is clearly ahead of the runner
// up; anything the model hedges over stays "uncertain" so the user gets a
// neutral message instead of a false accusation.
export const evaluateFoodImage = (
  predictions?: ImagePrediction[]
): FoodImageStatus => {
  const guesses = predictions ?? [];
  const bestGuess = guesses[0];

  if (!bestGuess || !Number.isFinite(bestGuess.probability)) {
    return 'uncertain';
  }

  if (guesses.some((guess) => isFoodLabel(guess.className))) {
    return 'food';
  }

  const runnerUp = guesses[1]?.probability ?? 0;
  const clearlyLeads =
    bestGuess.probability >= MIN_FOOD_CONFIDENCE &&
    bestGuess.probability >= MIN_LEADING_RATIO * runnerUp;

  return clearlyLeads ? 'not-food' : 'uncertain';
};

// Reads the picked file into an image element through an object URL, so the
// picture stays on the device. The URL is released as soon as it is read.
const loadImageElement = (file: File): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
};

@Injectable({
  providedIn: 'root',
})
export class FoodImageService {
  // The template shows the two loading steps separately: the first download
  // of the model, then the check itself.
  readonly modelLoading = signal(false);
  readonly checking = signal(false);

  private modelPromise: Promise<ImageModel | null> | null = null;

  // Nothing is uploaded for this check - the classification runs in the
  // browser. Any problem (unreadable file, model unavailable, browser
  // without WebGL) is reported as 'uncertain' so saving recipes always keeps
  // working without the hint.
  async checkImage(file: File): Promise<FoodImageStatus> {
    if (!isSupportedImage(file)) {
      return 'uncertain';
    }

    const model = await this.getModel();

    if (!model) {
      return 'uncertain';
    }

    this.checking.set(true);

    try {
      const image = await loadImageElement(file);

      if (!image) {
        return 'uncertain';
      }

      const predictions = await model.classify(image, 3);

      return evaluateFoodImage(predictions);
    } catch {
      // The loaded model misbehaved, so drop it and reload next time.
      this.modelPromise = null;

      return 'uncertain';
    } finally {
      this.checking.set(false);
    }
  }

  // The model is downloaded once and reused for every later picture. A
  // failed download is not kept, so choosing another picture tries again
  // instead of leaving the check unavailable until the page is reloaded.
  private async getModel(): Promise<ImageModel | null> {
    if (!this.modelPromise) {
      this.modelLoading.set(true);

      // MobileNet only pulls in tfjs-core, so a tfjs backend has to be
      // registered before the model can run. Importing the full TensorFlow.js
      // package does that; without it loading the weights fails with "No
      // backend found in registry" and every picture ends up as 'uncertain'.
      this.modelPromise = Promise.all([
        import('@tensorflow/tfjs'),
        import('@tensorflow-models/mobilenet'),
      ])
        .then(async ([tf, mobilenet]) => {
          await tf.ready();

          const model = await mobilenet.load({
            version: 2,
            alpha: 1,
            modelUrl: MOBILENET_MODEL_URL,
            inputRange: [0, 1],
          });

          return model as ImageModel;
        })
        .catch((error) => {
          console.warn('Food image model could not be loaded.', error);

          return null;
        })
        .finally(() => this.modelLoading.set(false));
    }

    const model = await this.modelPromise;

    if (!model) {
      this.modelPromise = null;
    }

    return model;
  }
}
