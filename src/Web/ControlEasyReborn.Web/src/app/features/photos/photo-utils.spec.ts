import { compressImage, DEFAULT_COMPRESSION, uploadWithRetry } from './photo-utils';
import { of, throwError } from 'rxjs';

function fakeContext(): unknown {
  return {
    fillStyle: '',
    fillRect: () => undefined,
    drawImage: () => undefined,
  };
}

describe('compressImage', () => {
  /**
   * The image-compression pipeline relies on HTMLCanvasElement / Image,
   * neither of which jsdom implements faithfully. We mock the relevant
   * primitives on the prototype for the duration of each test.
   */
  let toBlobSpy: jasmine.Spy;
  let decodeSpy: jasmine.Spy;
  let getContextSpy: jasmine.Spy;

  beforeEach(() => {
    decodeSpy = spyOn(HTMLImageElement.prototype, 'decode').and.callFake(async () => undefined);
    getContextSpy = spyOn(HTMLCanvasElement.prototype, 'getContext').and.callFake((() => fakeContext()) as never);
  });

  afterEach(() => {
    toBlobSpy?.calls.reset();
    decodeSpy.calls.reset();
    getContextSpy.calls.reset();
  });

  it('honours the initial 0.8 quality', async () => {
    toBlobSpy = spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(((cb: (b: Blob | null) => void) =>
      cb(new Blob([new Uint8Array(100)], { type: 'image/jpeg' }))) as any);
    const blob = new Blob([new Uint8Array(10)], { type: 'image/jpeg' });
    await compressImage(blob);
    expect(toBlobSpy.calls.mostRecent().args[2]).toBe(DEFAULT_COMPRESSION.initialQuality);
  });

  it('throws FILE_TOO_LARGE_AFTER_COMPRESSION when floor quality still exceeds the budget', async () => {
    const huge = new Blob([new Uint8Array(1024 * 1024)], { type: 'image/jpeg' });
    toBlobSpy = spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(((cb: (b: Blob | null) => void) =>
      cb(huge)) as any);
    await expectAsync(compressImage(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }))).toBeRejectedWithError(
      'FILE_TOO_LARGE_AFTER_COMPRESSION',
    );
  });

  it('retries at fallback quality when initial exceeds maxBytes', async () => {
    const calls: number[] = [];
    let callIndex = 0;
    toBlobSpy = spyOn(HTMLCanvasElement.prototype, 'toBlob').and.callFake(((
      cb: (b: Blob | null) => void,
      _mime?: string,
      q?: number,
    ) => {
      callIndex++;
      calls.push(q ?? -1);
      const size = callIndex === 1 ? DEFAULT_COMPRESSION.maxBytes + 1 : 1024;
      cb(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
    }) as any);
    const result = await compressImage(new Blob([new Uint8Array(10)], { type: 'image/jpeg' }));
    expect(calls).toContain(DEFAULT_COMPRESSION.initialQuality);
    expect(calls).toContain(DEFAULT_COMPRESSION.fallbackQuality);
    expect(result.size).toBe(1024);
  });
});

describe('uploadWithRetry', () => {
  it('returns the first successful result', async () => {
    const obs = () => of({ id: 'photo-1' });
    const result = await uploadWithRetry(obs, { maxAttempts: 3, delays: [1, 1, 1] });
    expect(result.id).toBe('photo-1');
  });

  it('retries up to maxAttempts and resolves with the eventual success', async () => {
    let calls = 0;
    const obs = () => {
      calls++;
      if (calls < 3) return throwError(() => new Error('transient'));
      return of({ id: 'photo-3' });
    };
    const result = await uploadWithRetry(obs, { maxAttempts: 3, delays: [1, 1, 1] });
    expect(calls).toBe(3);
    expect(result.id).toBe('photo-3');
  });

  it('throws after exhausting all attempts', async () => {
    const obs = () => throwError(() => new Error('persistent'));
    await expectAsync(uploadWithRetry(obs, { maxAttempts: 2, delays: [1, 1] })).toBeRejectedWithError('persistent');
  });

  it('awaits each retry delay before the next attempt', async () => {
    const stamps: number[] = [];
    let calls = 0;
    const obs = () => {
      stamps.push(Date.now());
      calls++;
      if (calls < 3) return throwError(() => new Error('transient'));
      return of({ id: 'photo-x' });
    };
    await uploadWithRetry(obs, { maxAttempts: 3, delays: [30, 30, 30] });
    expect(stamps.length).toBe(3);
    const gap1 = stamps[1]! - stamps[0]!;
    const gap2 = stamps[2]! - stamps[1]!;
    expect(gap1).toBeGreaterThanOrEqual(25);
    expect(gap2).toBeGreaterThanOrEqual(25);
  });

  it('integrates with rxjs firstValueFrom for Observable unwrapping', async () => {
    const { firstValueFrom } = await import('rxjs');
    const result = await firstValueFrom(of({ ok: true }));
    expect(result.ok).toBe(true);
  });
});
