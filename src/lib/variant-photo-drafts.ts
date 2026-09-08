export type VariationPhotoDraft = {
  id: string;
  previewUrl: string;
  file?: File;
  imageUrl?: string;
  altText: string;
  primary: boolean;
  attached?: boolean;
  primaryApplied?: boolean;
  sortOrder?: number;
};

export function validateVariationPhoto(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type))
    throw new Error("Choose a JPG, PNG, WebP, GIF or AVIF image.");
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new Error("Each image must be between 1 byte and 8 MB.");
}

/** Retain completed stages so a retry never creates a second image association. */
export async function persistVariationPhotos(
  photos: VariationPhotoDraft[],
  adapter: {
    upload: (photo: VariationPhotoDraft) => Promise<string>;
    attach: (photo: VariationPhotoDraft, url: string) => Promise<void>;
    makePrimary: (id: string) => Promise<void>;
  },
) {
  for (const photo of photos) {
    photo.imageUrl ??= await adapter.upload(photo);
    if (!photo.attached) {
      await adapter.attach(photo, photo.imageUrl);
      photo.attached = true;
    }
    if (photo.primary && !photo.primaryApplied) {
      await adapter.makePrimary(photo.id);
      photo.primaryApplied = true;
    }
  }
}
