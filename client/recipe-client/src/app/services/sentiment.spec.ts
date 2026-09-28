import { TestBed } from '@angular/core/testing';

import {
  SentimentService,
  isClearlyNeutral,
  mapSentimentResult,
} from './sentiment';

describe('mapSentimentResult', () => {
  it('maps a confident positive prediction', () => {
    expect(
      mapSentimentResult({ label: 'POSITIVE', score: 0.98 })
    ).toBe('Positive');
  });

  it('maps a confident negative prediction', () => {
    expect(
      mapSentimentResult({ label: 'NEGATIVE', score: 0.91 })
    ).toBe('Negative');
  });

  it('treats low-confidence predictions as neutral', () => {
    expect(mapSentimentResult({ label: 'NEGATIVE', score: 0.5 })).toBe(
      'Neutral'
    );
  });

  it('returns Unknown for missing predictions', () => {
    expect(mapSentimentResult(undefined)).toBe('Unknown');
  });

  it('returns Unknown when the score is not a usable number', () => {
    expect(
      mapSentimentResult({ label: 'POSITIVE', score: Number.NaN })
    ).toBe('Unknown');
  });
});

describe('isClearlyNeutral', () => {
  it('recognises a plain neutral word', () => {
    expect(isClearlyNeutral('average')).toBe(true);
  });

  it('recognises short neutral sentences', () => {
    expect(isClearlyNeutral('The taste was average.')).toBe(true);
    expect(isClearlyNeutral('it was okay')).toBe(true);
  });

  it('ignores casing and punctuation', () => {
    expect(isClearlyNeutral('Average!')).toBe(true);
  });

  it('recognises common Hinglish neutral phrases', () => {
    expect(isClearlyNeutral('thik thak')).toBe(true);
    expect(isClearlyNeutral('THEEK THAAK!')).toBe(true);
    expect(isClearlyNeutral('thik-thak')).toBe(true);
    expect(isClearlyNeutral('theek hai')).toBe(true);
    expect(isClearlyNeutral('bas theek')).toBe(true);
    expect(isClearlyNeutral('thik   thak')).toBe(true);
  });

  it('lets opinions through to the model', () => {
    expect(isClearlyNeutral('worst')).toBe(false);
    expect(isClearlyNeutral('worst recipe')).toBe(false);
    expect(isClearlyNeutral('I loved this recipe')).toBe(false);
    expect(isClearlyNeutral('bahut accha khana tha')).toBe(false);
  });

  it('lets negated neutral comments through to the model', () => {
    expect(isClearlyNeutral('not average at all')).toBe(false);
  });

  it('returns false for blank text', () => {
    expect(isClearlyNeutral('   ')).toBe(false);
  });
});

describe('SentimentService', () => {
  // Swaps the real model promise for a fake classifier so the tests
  // stay offline and run quickly.
  const useFakeClassifier = (
    service: SentimentService,
    results: Array<{ label: string; score: number }>
  ): void => {
    const fakeClassifier = async () => results;
    const faked = service as unknown as {
      classifierPromise: Promise<typeof fakeClassifier>;
    };

    faked.classifierPromise = Promise.resolve(fakeClassifier);
  };

  it('labels a neutral comment without loading the model', async () => {
    const service = TestBed.inject(SentimentService);

    expect(await service.analyze('average')).toBe('Neutral');
    expect(service.modelLoading()).toBe(false);
  });

  it('labels Hinglish neutral comments without loading the model', async () => {
    const service = TestBed.inject(SentimentService);

    expect(await service.analyze('thik thak')).toBe('Neutral');
    expect(service.modelLoading()).toBe(false);
  });

  it('keeps positive and negative model results unchanged', async () => {
    const service = TestBed.inject(SentimentService);

    // Scores taken from a quick probe of the real SST-2 model.
    useFakeClassifier(service, [
      { label: 'POSITIVE', score: 0.9998759031295776 },
    ]);
    expect(await service.analyze('I loved this recipe')).toBe('Positive');

    useFakeClassifier(service, [
      { label: 'NEGATIVE', score: 0.9998016357421875 },
    ]);
    expect(await service.analyze('worst')).toBe('Negative');
    expect(await service.analyze('worst recipe')).toBe('Negative');
  });

  it('returns Unknown when the model cannot load', async () => {
    const service = TestBed.inject(SentimentService);
    const faked = service as unknown as {
      classifierPromise: Promise<null>;
    };

    faked.classifierPromise = Promise.resolve(null);

    expect(await service.analyze('terrible')).toBe('Unknown');
  });
});