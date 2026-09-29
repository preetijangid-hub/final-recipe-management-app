// Shared rules for the image pickers in Savoré. Recipe photos, collection
// covers and the AI check all accept the same formats and size.
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// Browsers report the MIME type of the selected file, which is enough to
// catch documents and videos picked by mistake.
export const isSupportedImage = (file: File): boolean =>
  file.type.startsWith('image/');

export const exceedsImageSizeLimit = (
  file: File,
  maxBytes: number = MAX_IMAGE_SIZE_BYTES
): boolean => file.size > maxBytes;
