import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (vars) {
      const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
      return `${key}(${parts.join(',')})`;
    }
    return key;
  },
}));

import { FaceSearchModal } from '@/components/gallery/face-search-modal';

/**
 * Patche Image et HTMLCanvasElement une seule fois pour le suite.
 * Le pipeline canvas (drawImage / toDataURL) n'existe pas en jsdom.
 */
const ImageOriginal = global.Image;
class FakeImage {
  onload: ((this: unknown, ev?: unknown) => unknown) | null = null;
  onerror: ((this: unknown, ev?: unknown) => unknown) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return '';
  }
}
const canvasGetContextOriginal = HTMLCanvasElement.prototype.getContext;
const canvasToDataUrlOriginal = HTMLCanvasElement.prototype.toDataURL;
const objectUrlOriginal = URL.createObjectURL;
const revokeOriginal = URL.revokeObjectURL;

beforeEach(() => {
  vi.clearAllMocks();
  (global as { Image: unknown }).Image = FakeImage;
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue({ drawImage: vi.fn() }) as never;
  HTMLCanvasElement.prototype.toDataURL = vi
    .fn()
    .mockReturnValue('data:image/jpeg;base64,AAA');
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  (global as { Image: unknown }).Image = ImageOriginal;
  HTMLCanvasElement.prototype.getContext = canvasGetContextOriginal;
  HTMLCanvasElement.prototype.toDataURL = canvasToDataUrlOriginal;
  URL.createObjectURL = objectUrlOriginal;
  URL.revokeObjectURL = revokeOriginal;
});

describe('FaceSearchModal', () => {
  it('does not render anything when closed', () => {
    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn();
    render(
      <FaceSearchModal open={false} onClose={onClose} onResult={onResult} search={search} />,
    );
    expect(screen.queryByTestId('face-search-modal')).toBeNull();
  });

  it('starts on the consent step and disables submit until checkbox is ticked', async () => {
    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn();
    const user = userEvent.setup();

    render(
      <FaceSearchModal open onClose={onClose} onResult={onResult} search={search} />,
    );

    expect(screen.getByTestId('face-search-modal')).toBeInTheDocument();
    const submit = screen.getByTestId('face-search-consent-submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();

    await user.click(screen.getByTestId('face-search-consent-checkbox'));
    expect(submit).not.toBeDisabled();
  });

  it('moves to capture step after consent and exposes upload + camera buttons (when supported)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });

    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn();
    const user = userEvent.setup();

    render(
      <FaceSearchModal open onClose={onClose} onResult={onResult} search={search} />,
    );

    await user.click(screen.getByTestId('face-search-consent-checkbox'));
    await user.click(screen.getByTestId('face-search-consent-submit'));

    expect(screen.getByTestId('face-search-upload-btn')).toBeInTheDocument();
    expect(screen.getByTestId('face-search-camera-btn')).toBeInTheDocument();
  });

  it('hides camera button when getUserMedia is not available', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });

    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn();
    const user = userEvent.setup();

    render(
      <FaceSearchModal open onClose={onClose} onResult={onResult} search={search} />,
    );

    await user.click(screen.getByTestId('face-search-consent-checkbox'));
    await user.click(screen.getByTestId('face-search-consent-submit'));

    expect(screen.queryByTestId('face-search-camera-btn')).toBeNull();
    expect(screen.getByTestId('face-search-upload-btn')).toBeInTheDocument();
  });

  it('renders the success state with view matches CTA when search returns matches', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });

    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn().mockResolvedValue({
      ok: true,
      photoIds: ['photo_a', 'photo_b'],
      matchCount: 2,
    });
    const user = userEvent.setup();

    render(<FaceSearchModal open onClose={onClose} onResult={onResult} search={search} />);

    await user.click(screen.getByTestId('face-search-consent-checkbox'));
    await user.click(screen.getByTestId('face-search-consent-submit'));

    const file = new File(['fakeimg'], 'me.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('face-search-file-input') as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId('face-search-result-ok')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('face-search-view-matches'));
    expect(onResult).toHaveBeenCalledWith(['photo_a', 'photo_b']);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders an error state when search returns NO_FACE_DETECTED', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });

    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn().mockResolvedValue({ ok: false, error: 'NO_FACE_DETECTED' });
    const user = userEvent.setup();

    render(<FaceSearchModal open onClose={onClose} onResult={onResult} search={search} />);

    await user.click(screen.getByTestId('face-search-consent-checkbox'));
    await user.click(screen.getByTestId('face-search-consent-submit'));

    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('face-search-file-input') as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId('face-search-result-error')).toBeInTheDocument();
    });
    expect(screen.getByText('errors.noFace')).toBeInTheDocument();
  });

  it('renders an empty result when matchCount is zero', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });

    const onClose = vi.fn();
    const onResult = vi.fn();
    const search = vi.fn().mockResolvedValue({ ok: true, photoIds: [], matchCount: 0 });
    const user = userEvent.setup();

    render(<FaceSearchModal open onClose={onClose} onResult={onResult} search={search} />);

    await user.click(screen.getByTestId('face-search-consent-checkbox'));
    await user.click(screen.getByTestId('face-search-consent-submit'));

    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('face-search-file-input') as HTMLInputElement, file);

    await waitFor(() => {
      expect(screen.getByTestId('face-search-result-ok')).toBeInTheDocument();
    });
    expect(screen.getByText('resultEmpty')).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });
});
