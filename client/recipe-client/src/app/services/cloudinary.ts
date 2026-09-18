import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CloudinaryService {
  private readonly uploadUrl = `https://api.cloudinary.com/v1_1/${environment.cloudinaryCloudName}/image/upload`;

  // Uses fetch instead of HttpClient on purpose: the app's auth interceptor
  // attaches the JWT to every request and signs the user out on 401, which
  // must not happen for third-party uploads.
  uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinaryUploadPreset);

    console.log(`[Savoré upload] POST ${this.uploadUrl}`);

    return fetch(this.uploadUrl, {
      method: 'POST',
      body: formData,
    })
      .then(async (response) => {
        console.log(`[Savoré upload] HTTP status: ${response.status}`);

        const data = await response.json();

        console.log('[Savoré upload] response:', data);

        if (!response.ok) {
          throw new Error(
            data?.error?.message ||
              `Image upload failed with status ${response.status}.`
          );
        }

        console.log(`[Savoré upload] secure_url: ${data.secure_url}`);

        return data.secure_url as string;
      })
      .catch((error) => {
        console.error('[Savoré upload] request failed:', error);

        throw error;
      });
  }
}
