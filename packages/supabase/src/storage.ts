import type { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseStorageService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
  ) {}

  get bucketName(): string {
    return this.bucket;
  }

  async createSignedUploadUrl(
    path: string,
    options?: { upsert: boolean },
  ): Promise<{ path: string; token: string; signedUrl: string }> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path, options);
    if (error) {
      throw error;
    }
    if (!data?.signedUrl || !data.token) {
      throw new Error("createSignedUploadUrl returned no URL or token");
    }
    return {
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  async removeObject(objectPath: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([objectPath]);
    if (error) {
      throw error;
    }
  }

  async createSignedDownloadUrl(
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, expiresInSeconds);
    if (error) {
      throw error;
    }
    if (!data?.signedUrl) {
      throw new Error("createSignedUrl returned no URL");
    }
    return data.signedUrl;
  }
}
