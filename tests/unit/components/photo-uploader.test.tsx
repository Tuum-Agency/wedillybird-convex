import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const compressMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('@/lib/photos/compress', () => ({
  compressForUpload: (file: File) => compressMock(file),
  ALLOWED_CONTENT_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (vars) {
      const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
      return `${key}(${parts.join(',')})`;
    }
    return key;
  },
}));

import { PhotoUploader } from '@/components/gallery/photo-uploader';

beforeEach(() => {
  compressMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function makeFile(): File {
  return new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
}

describe('PhotoUploader (owner mode)', () => {
  it('compresses, uploads, confirms, and calls onUploaded', async () => {
    const compressedBlob = new Blob(['compressed'], { type: 'image/jpeg' });
    Object.defineProperty(compressedBlob, 'size', { value: 1234 });
    compressMock.mockResolvedValue({
      file: compressedBlob,
      width: 1000,
      height: 800,
      contentType: 'image/jpeg',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: 'stg_123' }),
    });

    const getUploadUrl = vi.fn().mockResolvedValue({ ok: true, uploadUrl: 'https://u/1' });
    const confirm = vi.fn().mockResolvedValue({ ok: true, id: 'photo_1' });
    const onUploaded = vi.fn();

    const user = userEvent.setup();
    render(
      <PhotoUploader
        mode="owner"
        eventId="evt_1"
        getUploadUrl={getUploadUrl}
        confirm={confirm}
        onUploaded={onUploaded}
      />,
    );

    const input = screen.getByTestId('photo-uploader-input') as HTMLInputElement;
    await user.upload(input, makeFile());

    await waitFor(() => expect(getUploadUrl).toHaveBeenCalledWith('evt_1'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe('https://u/1');
    expect(fetchMock.mock.calls[0]![1].method).toBe('POST');

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        eventId: 'evt_1',
        storageId: 'stg_123',
        sizeBytes: 1234,
        contentType: 'image/jpeg',
        width: 1000,
        height: 800,
      }),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
  });

  it('surfaces an error when upload fetch fails', async () => {
    const compressedBlob = new Blob(['x'], { type: 'image/jpeg' });
    Object.defineProperty(compressedBlob, 'size', { value: 1 });
    compressMock.mockResolvedValue({ file: compressedBlob, contentType: 'image/jpeg' });
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    const getUploadUrl = vi.fn().mockResolvedValue({ ok: true, uploadUrl: 'https://u' });
    const confirm = vi.fn();

    const user = userEvent.setup();
    render(
      <PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={getUploadUrl} confirm={confirm} />,
    );

    await user.upload(screen.getByTestId('photo-uploader-input'), makeFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(/network/);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reports compress failure for unsupported types', async () => {
    compressMock.mockRejectedValue(new Error('INVALID_CONTENT_TYPE'));
    const getUploadUrl = vi.fn();
    const confirm = vi.fn();

    const user = userEvent.setup();
    render(
      <PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={getUploadUrl} confirm={confirm} />,
    );

    await user.upload(screen.getByTestId('photo-uploader-input'), makeFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(/type/);
    expect(getUploadUrl).not.toHaveBeenCalled();
  });
});

describe('PhotoUploader (guest mode)', () => {
  it('passes uploaderName to confirm', async () => {
    const compressedBlob = new Blob(['z'], { type: 'image/jpeg' });
    Object.defineProperty(compressedBlob, 'size', { value: 42 });
    compressMock.mockResolvedValue({ file: compressedBlob, contentType: 'image/jpeg' });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ storageId: 'stg_99' }) });

    const getUploadUrl = vi.fn().mockResolvedValue({ ok: true, uploadUrl: 'https://u' });
    const confirm = vi.fn().mockResolvedValue({ ok: true, id: 'p1' });

    const user = userEvent.setup();
    render(
      <PhotoUploader
        mode="guest"
        token="QR123"
        uploaderName="Awa"
        getUploadUrl={getUploadUrl}
        confirm={confirm}
      />,
    );

    await user.upload(screen.getByTestId('photo-uploader-input'), makeFile());

    await waitFor(() => expect(getUploadUrl).toHaveBeenCalledWith('QR123'));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'QR123',
          storageId: 'stg_99',
          uploaderName: 'Awa',
        }),
      ),
    );
  });
});
