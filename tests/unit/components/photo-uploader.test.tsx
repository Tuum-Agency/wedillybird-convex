import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('compresses, PUTs to S3 presigned URL, confirms with s3Key, and calls onUploaded', async () => {
    const compressedBlob = new Blob(['compressed'], { type: 'image/jpeg' });
    Object.defineProperty(compressedBlob, 'size', { value: 1234 });
    compressMock.mockResolvedValue({
      file: compressedBlob,
      width: 1000,
      height: 800,
      contentType: 'image/jpeg',
    });
    fetchMock.mockResolvedValue({ ok: true });

    const getUploadUrl = vi.fn().mockResolvedValue({
      ok: true,
      uploadUrl: 'https://s3.example/presigned',
      s3Key: 'incoming/evt_1/abc-123.jpg',
    });
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

    await waitFor(() => expect(getUploadUrl).toHaveBeenCalledWith('evt_1', 'image/jpeg'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe('https://s3.example/presigned');
    expect(fetchMock.mock.calls[0]![1].method).toBe('PUT');
    expect(fetchMock.mock.calls[0]![1].headers['Content-Type']).toBe('image/jpeg');

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        eventId: 'evt_1',
        s3Key: 'incoming/evt_1/abc-123.jpg',
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
    fetchMock.mockResolvedValue({ ok: false });

    const getUploadUrl = vi
      .fn()
      .mockResolvedValue({ ok: true, uploadUrl: 'https://u', s3Key: 'incoming/evt_1/x.jpg' });
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

describe('PhotoUploader (drag-and-drop)', () => {
  it('expose une dropzone accessible avec role=button et label', () => {
    render(<PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={vi.fn()} confirm={vi.fn()} />);
    const dropzone = screen.getByTestId('photo-uploader-dropzone');
    expect(dropzone).toHaveAttribute('role', 'button');
    expect(dropzone).toHaveAttribute('aria-label', 'dropzoneTitle');
    expect(dropzone).toHaveAttribute('data-drag-over', 'false');
  });

  it('bascule data-drag-over=true pendant dragenter et false au drop', async () => {
    const compressedBlob = new Blob(['x'], { type: 'image/jpeg' });
    Object.defineProperty(compressedBlob, 'size', { value: 1 });
    compressMock.mockResolvedValue({ file: compressedBlob, contentType: 'image/jpeg' });
    fetchMock.mockResolvedValue({ ok: true });
    const getUploadUrl = vi
      .fn()
      .mockResolvedValue({ ok: true, uploadUrl: 'https://u', s3Key: 'incoming/evt_1/x.jpg' });
    const confirm = vi.fn().mockResolvedValue({ ok: true, id: 'p1' });

    render(
      <PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={getUploadUrl} confirm={confirm} />,
    );

    const dropzone = screen.getByTestId('photo-uploader-dropzone');
    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [makeFile()] } });
    expect(dropzone).toHaveAttribute('data-drag-over', 'true');

    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } });
    expect(dropzone).toHaveAttribute('data-drag-over', 'false');

    await waitFor(() => expect(getUploadUrl).toHaveBeenCalledWith('evt_1', 'image/jpeg'));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
  });

  it("drop d'un fichier accepté déclenche le pipeline upload complet", async () => {
    const compressedBlob = new Blob(['data'], { type: 'image/png' });
    Object.defineProperty(compressedBlob, 'size', { value: 999 });
    compressMock.mockResolvedValue({
      file: compressedBlob,
      width: 800,
      height: 600,
      contentType: 'image/png',
    });
    fetchMock.mockResolvedValue({ ok: true });
    const getUploadUrl = vi.fn().mockResolvedValue({
      ok: true,
      uploadUrl: 'https://s3/x',
      s3Key: 'incoming/evt_1/png.png',
    });
    const confirm = vi.fn().mockResolvedValue({ ok: true, id: 'p1' });
    const onUploaded = vi.fn();

    render(
      <PhotoUploader
        mode="owner"
        eventId="evt_1"
        getUploadUrl={getUploadUrl}
        confirm={confirm}
        onUploaded={onUploaded}
      />,
    );

    const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('photo-uploader-dropzone'), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(getUploadUrl).toHaveBeenCalledWith('evt_1', 'image/png'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ s3Key: 'incoming/evt_1/png.png', contentType: 'image/png' }),
      ),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
  });

  it("drop d'un type non supporté affiche errors.type sans appeler le backend", async () => {
    const getUploadUrl = vi.fn();
    const confirm = vi.fn();

    render(
      <PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={getUploadUrl} confirm={confirm} />,
    );

    const pdf = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.drop(screen.getByTestId('photo-uploader-dropzone'), {
      dataTransfer: { files: [pdf] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/type/);
    expect(getUploadUrl).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('drop sans fichier (drag de texte) ne déclenche aucun appel', () => {
    const getUploadUrl = vi.fn();
    const confirm = vi.fn();

    render(
      <PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={getUploadUrl} confirm={confirm} />,
    );

    fireEvent.drop(screen.getByTestId('photo-uploader-dropzone'), { dataTransfer: { files: [] } });

    expect(getUploadUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clic sur la dropzone ouvre le file picker (déclenche input.click)', async () => {
    render(<PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={vi.fn()} confirm={vi.fn()} />);

    const input = screen.getByTestId('photo-uploader-input') as HTMLInputElement;
    const inputClick = vi.spyOn(input, 'click');

    const user = userEvent.setup();
    await user.click(screen.getByTestId('photo-uploader-dropzone'));

    expect(inputClick).toHaveBeenCalled();
  });

  it('clavier Enter sur la dropzone ouvre le file picker', () => {
    render(<PhotoUploader mode="owner" eventId="evt_1" getUploadUrl={vi.fn()} confirm={vi.fn()} />);

    const input = screen.getByTestId('photo-uploader-input') as HTMLInputElement;
    const inputClick = vi.spyOn(input, 'click');
    const dropzone = screen.getByTestId('photo-uploader-dropzone');

    dropzone.focus();
    fireEvent.keyDown(dropzone, { key: 'Enter' });

    expect(inputClick).toHaveBeenCalled();
  });
});

describe('PhotoUploader (guest mode)', () => {
  it('passes uploaderName and s3Key to confirm', async () => {
    const compressedBlob = new Blob(['z'], { type: 'image/jpeg' });
    Object.defineProperty(compressedBlob, 'size', { value: 42 });
    compressMock.mockResolvedValue({ file: compressedBlob, contentType: 'image/jpeg' });
    fetchMock.mockResolvedValue({ ok: true });

    const getUploadUrl = vi.fn().mockResolvedValue({
      ok: true,
      uploadUrl: 'https://u',
      s3Key: 'incoming/evt_2/xyz.jpg',
    });
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

    await waitFor(() => expect(getUploadUrl).toHaveBeenCalledWith('QR123', 'image/jpeg'));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'QR123',
          s3Key: 'incoming/evt_2/xyz.jpg',
          uploaderName: 'Awa',
        }),
      ),
    );
  });
});
