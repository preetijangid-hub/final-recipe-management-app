import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import {
  evaluateFoodImage,
  FoodImageService,
  isFoodLabel,
  MIN_FOOD_CONFIDENCE,
  MIN_LEADING_RATIO,
} from './food-image';

const { loadMock, readyMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  readyMock: vi.fn(() => Promise.resolve()),
}));

// The real module downloads a model, so the packaged loader is replaced.
// The dynamic import inside the service picks the mock up as well.
vi.mock('@tensorflow-models/mobilenet', () => ({ load: loadMock }));

// The service also asks TensorFlow.js for a ready backend, which a test
// environment cannot provide, so only that call is replaced.
vi.mock('@tensorflow/tfjs', () => ({ ready: readyMock }));

// jsdom has no image decoding, so a tiny stand-in reports the load result
// as soon as the source is set, exactly like a decoded picture would.
type ModelConfig = {
  version?: number;
  alpha?: number;
  modelUrl?: string;
  inputRange?: [number, number];
};

let imageFailsToLoad = false;
let lastModelConfig: ModelConfig | null = null;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    if (imageFailsToLoad) {
      this.onerror?.();
      return;
    }

    this.onload?.();
  }
}

describe('food image helpers', () => {
  it('recognises the food and kitchen classes MobileNet can return', () => {
    expect(isFoodLabel('pizza, pizza pie')).toBe(true);
    expect(isFoodLabel('soup bowl')).toBe(true);
    expect(isFoodLabel('Granny Smith')).toBe(true);
    expect(isFoodLabel('dutch oven')).toBe(true);
  });

  it('does not treat unrelated classes as food', () => {
    expect(isFoodLabel('sports car, sport car')).toBe(false);
    expect(isFoodLabel('tabby, tabby cat')).toBe(false);
    // A bare "dish" is not a keyword, so a Petri dish stays non-food.
    expect(isFoodLabel('Petri dish')).toBe(false);
  });

  it('accepts a confident food prediction', () => {
    expect(
      evaluateFoodImage([{ className: 'cheeseburger', probability: 0.92 }])
    ).toBe('food');
  });

  it('flags a confident non-food prediction', () => {
    expect(
      evaluateFoodImage([{ className: 'sports car', probability: 0.81 }])
    ).toBe('not-food');
  });

  it('reports low confidence as uncertain instead of non-food', () => {
    expect(
      evaluateFoodImage([
        { className: 'sports car', probability: MIN_FOOD_CONFIDENCE - 0.01 },
      ])
    ).toBe('uncertain');
  });

  // MobileNet spreads its probability over 1000 classes, so a picture it
  // names correctly often scores far below 0.6. The picture of Radha-Krishna
  // that started this bug was named "hoopskirt" at 0.46, which is a clear
  // answer and has to be reported as non-food.
  it('flags a non-food picture that the model names with a modest score', () => {
    expect(
      evaluateFoodImage([
        { className: 'hoopskirt, crinoline', probability: 0.46 },
        {
          className: 'carousel, carrousel, merry-go-round, roundabout',
          probability: 0.041,
        },
      ])
    ).toBe('not-food');
  });

  it('needs the leading guess to pull ahead of the runner up', () => {
    expect(
      evaluateFoodImage([
        { className: 'hoopskirt, crinoline', probability: 0.4 },
        { className: 'stole', probability: 0.4 / MIN_LEADING_RATIO },
      ])
    ).toBe('not-food');

    expect(
      evaluateFoodImage([
        { className: 'hoopskirt, crinoline', probability: 0.4 },
        { className: 'stole', probability: 0.4 / MIN_LEADING_RATIO + 0.01 },
      ])
    ).toBe('uncertain');
  });

  it('stays uncertain when the guesses are spread over similar classes', () => {
    // A car photo where two car classes are almost level says nothing about
    // whether the picture is food, so the user gets the neutral message.
    expect(
      evaluateFoodImage([
        { className: 'cab, hack, taxi, taxicab', probability: 0.244 },
        { className: 'convertible', probability: 0.241 },
      ])
    ).toBe('uncertain');
  });

  it('treats a food class among the top guesses as food', () => {
    // A home-cooked dish is often named "plate" with a modest score, and the
    // user should never be warned about their own cooking.
    expect(
      evaluateFoodImage([
        { className: 'plate', probability: 0.209 },
        { className: 'pizza, pizza pie', probability: 0.091 },
      ])
    ).toBe('food');
  });

  it('reports missing or malformed predictions as uncertain', () => {
    expect(evaluateFoodImage()).toBe('uncertain');
    expect(evaluateFoodImage([])).toBe('uncertain');
    expect(
      evaluateFoodImage([{ className: 'pizza', probability: Number.NaN }])
    ).toBe('uncertain');
  });
});

describe('FoodImageService', () => {
  let service: FoodImageService;

  const sampleFile = new File(['image-bytes'], 'dish.jpg', {
    type: 'image/jpeg',
  });

  const documentFile = new File(['pdf-bytes'], 'notes.pdf', {
    type: 'application/pdf',
  });

  const stubModel = (predictions: Array<Record<string, unknown>>): void => {
    loadMock.mockImplementation((config: ModelConfig) => {
      lastModelConfig = config;

      return Promise.resolve({
        classify: vi.fn(() => Promise.resolve(predictions)),
      });
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    imageFailsToLoad = false;
    lastModelConfig = null;

    URL.createObjectURL = vi.fn(
      () => 'blob:fake-image'
    ) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    vi.stubGlobal('Image', FakeImage);

    await TestBed.configureTestingModule({}).compileComponents();

    service = TestBed.inject(FoodImageService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a food picture as food', async () => {
    stubModel([{ className: 'soup bowl', probability: 0.88 }]);

    await expect(service.checkImage(sampleFile)).resolves.toBe('food');
    expect(service.checking()).toBe(false);
  });

  it('reports a confident non-food picture as not-food', async () => {
    stubModel([{ className: 'sports car', probability: 0.79 }]);

    await expect(service.checkImage(sampleFile)).resolves.toBe('not-food');
  });

  it('flags the modest non-food answer MobileNet gives for a painting', async () => {
    // The answer a real Radha-Krishna photo produced: named, but under 0.6.
    stubModel([
      { className: 'hoopskirt, crinoline', probability: 0.46 },
      {
        className: 'carousel, carrousel, merry-go-round, roundabout',
        probability: 0.041,
      },
    ]);

    await expect(service.checkImage(sampleFile)).resolves.toBe('not-food');
  });

  it('stays neutral when the model is unsure', async () => {
    // MobileNet always answers with the top three classes, and an unsure
    // answer is a low score that is barely ahead of the next one.
    stubModel([
      { className: 'sports car, sport car', probability: 0.19 },
      { className: 'convertible', probability: 0.17 },
    ]);

    await expect(service.checkImage(sampleFile)).resolves.toBe(
      'uncertain'
    );
  });

  it('loads the model from Google hosting instead of the dead TF Hub URL', async () => {
    stubModel([{ className: 'pizza', probability: 0.9 }]);

    await service.checkImage(sampleFile);

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(lastModelConfig?.modelUrl).toContain('storage.googleapis.com');
    expect(lastModelConfig?.inputRange).toEqual([0, 1]);
  });

  // MobileNet alone has no backend to run on, which made every picture look
  // unchecked in the browser, so a ready backend comes first.
  it('prepares a TensorFlow.js backend before loading the model', async () => {
    stubModel([{ className: 'pizza', probability: 0.9 }]);

    await service.checkImage(sampleFile);

    expect(readyMock).toHaveBeenCalledTimes(1);
    expect(readyMock.mock.invocationCallOrder[0]).toBeLessThan(
      loadMock.mock.invocationCallOrder[0]
    );
  });

  it('reuses the loaded model for later pictures', async () => {
    stubModel([{ className: 'pizza', probability: 0.9 }]);

    await service.checkImage(sampleFile);
    await service.checkImage(sampleFile);

    expect(loadMock).toHaveBeenCalledTimes(1);
  });

  it('stays neutral when the model cannot be loaded', async () => {
    loadMock.mockRejectedValue(new Error('offline'));

    await expect(service.checkImage(sampleFile)).resolves.toBe(
      'uncertain'
    );
    expect(service.modelLoading()).toBe(false);
  });

  it('tries the model again for the next picture after a failed download', async () => {
    loadMock.mockRejectedValueOnce(new Error('offline'));
    stubModel([{ className: 'pizza', probability: 0.9 }]);

    await expect(service.checkImage(sampleFile)).resolves.toBe(
      'uncertain'
    );
    await expect(service.checkImage(sampleFile)).resolves.toBe('food');

    expect(loadMock).toHaveBeenCalledTimes(2);
  });

  it('stays neutral when the classification fails', async () => {
    loadMock.mockResolvedValue({
      classify: vi.fn(() => Promise.reject(new Error('bad tensor'))),
    });

    await expect(service.checkImage(sampleFile)).resolves.toBe(
      'uncertain'
    );
  });

  it('stays neutral when the picture cannot be decoded', async () => {
    imageFailsToLoad = true;
    stubModel([{ className: 'pizza', probability: 0.9 }]);

    await expect(service.checkImage(sampleFile)).resolves.toBe(
      'uncertain'
    );
  });

  it('skips the check for files that are not images', async () => {
    await expect(service.checkImage(documentFile)).resolves.toBe(
      'uncertain'
    );
    expect(loadMock).not.toHaveBeenCalled();
  });
});
