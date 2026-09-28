import { TestBed } from '@angular/core/testing';

import { ToxicityService, isFlaggedAsToxic } from './toxicity';

describe('isFlaggedAsToxic', () => {
  it('flags a review when any model label matched', () => {
    expect(
      isFlaggedAsToxic([
        { label: 'toxicity', results: [{ match: false }, { match: true }] },
        { label: 'insult', results: [{ match: false }] },
      ])
    ).toBe(true);
  });

  it('does not flag clean reviews', () => {
    expect(
      isFlaggedAsToxic([
        { label: 'toxicity', results: [{ match: false }] },
        { label: 'threat', results: [{ match: false }] },
      ])
    ).toBe(false);
  });

  it('does not flag when predictions are unavailable', () => {
    expect(isFlaggedAsToxic(undefined)).toBe(false);
  });
});

describe('ToxicityService', () => {
  type FakeModel = {
    classify: (texts: string[]) => Promise<
      Array<{
        label: string;
        results: Array<{ match: boolean }>;
      }>
    >;
  };

  // Swaps the real model promise for a fake so the tests stay offline
  // and never download the actual TensorFlow.js model.
  const useFakeModel = (
    service: ToxicityService,
    model: FakeModel | null
  ): void => {
    const faked = service as unknown as {
      modelPromise: Promise<FakeModel | null>;
    };

    faked.modelPromise = Promise.resolve(model);
  };

  it('lets a normal review pass', async () => {
    const service = TestBed.inject(ToxicityService);

    useFakeModel(service, {
      classify: async () => [
        { label: 'toxicity', results: [{ match: false }] },
        { label: 'insult', results: [{ match: false }] },
      ],
    });

    expect(await service.check('Great recipe, thank you!')).toBe(false);
  });

  it('flags a clearly toxic review', async () => {
    const service = TestBed.inject(ToxicityService);

    useFakeModel(service, {
      classify: async () => [
        { label: 'toxicity', results: [{ match: true }] },
        { label: 'insult', results: [{ match: false }] },
      ],
    });

    expect(await service.check('you are all idiots')).toBe(true);
  });

  it('returns null when the model cannot load and allows a retry', async () => {
    const service = TestBed.inject(ToxicityService);
    const faked = service as unknown as {
      modelPromise: Promise<null>;
    };

    faked.modelPromise = Promise.resolve(null);

    expect(await service.check('hello there')).toBe(null);
    expect(faked.modelPromise).toBe(null);

    // The next attempt loads a working model, like when the network
    // recovers, instead of moderation staying broken all session.
    useFakeModel(service, {
      classify: async () => [
        { label: 'toxicity', results: [{ match: false }] },
      ],
    });

    expect(await service.check('hello there')).toBe(false);
  });

  it('returns null when inference fails and allows a retry', async () => {
    const service = TestBed.inject(ToxicityService);

    useFakeModel(service, {
      classify: async () => {
        throw new Error('inference failed');
      },
    });

    expect(await service.check('hello there')).toBe(null);

    const faked = service as unknown as {
      modelPromise: Promise<unknown> | null;
    };

    expect(faked.modelPromise).toBe(null);
  });
});