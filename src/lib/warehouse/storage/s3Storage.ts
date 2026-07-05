import { Readable } from 'stream';
import { IObjectStorage, StorageOptions } from './storage.interface';
import { StorageHelpers } from './helpers';

export class S3Storage implements IObjectStorage {
  private readonly bucketName: string;
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(config: {
    bucketName: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.bucketName = config.bucketName;
    // Default to AWS S3 if endpoint not specified
    this.endpoint = config.endpoint || `https://${this.bucketName}.s3.amazonaws.com`;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
  }

  private getUrl(key: string): string {
    return `${this.endpoint}/${key}`;
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const res = await fetch(this.getUrl(key), { method: 'HEAD' });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  public async upload(key: string, content: Buffer | string, options?: StorageOptions): Promise<void> {
    const body = typeof content === 'string' ? Buffer.from(content) : content;
    const url = this.getUrl(key);

    const headers: Record<string, string> = {
      'Content-Type': options?.contentType || 'application/octet-stream'
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: body as any
    });

    if (!res.ok) {
      throw new Error(`S3 upload failed: HTTP status ${res.status}`);
    }

    // Generate and upload checksum alongside the file
    const checksum = StorageHelpers.sha256(body);
    const checksumUrl = `${url}.sha256`;
    await fetch(checksumUrl, {
      method: 'PUT',
      body: checksum
    });
  }

  public async download(key: string): Promise<Buffer> {
    const res = await fetch(this.getUrl(key));
    if (!res.ok) {
      throw new Error(`S3 download failed: HTTP status ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  public async streamUpload(key: string, stream: Readable, options?: StorageOptions): Promise<void> {
    // For native fetch stream upload in Node.js environment, we consume the stream into a buffer first
    // to align with standard fetch support.
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const finalBuffer = Buffer.concat(chunks);
    await this.upload(key, finalBuffer, options);
  }

  public async streamDownload(key: string): Promise<Readable> {
    const buffer = await this.download(key);
    return Readable.from(buffer);
  }

  public async delete(key: string): Promise<void> {
    const res = await fetch(this.getUrl(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 delete failed: HTTP status ${res.status}`);
    }
    // Delete checksum
    await fetch(`${this.getUrl(key)}.sha256`, { method: 'DELETE' });
  }

  public async move(sourceKey: string, destKey: string): Promise<void> {
    await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
  }

  public async copy(sourceKey: string, destKey: string): Promise<void> {
    const content = await this.download(sourceKey);
    await this.upload(destKey, content);
  }

  public async list(prefix = ''): Promise<string[]> {
    // Simple S3 XML list mock/parsing integration
    const url = `${this.endpoint}?prefix=${prefix}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    
    const text = await res.text();
    // Parse Key tags from response using regex
    const matches = [...text.matchAll(/<Key>([^<]+)<\/Key>/g)];
    return matches.map(m => m[1]).filter(k => !k.endsWith('.sha256'));
  }

  public async generateChecksum(key: string): Promise<string> {
    const content = await this.download(key);
    return StorageHelpers.sha256(content);
  }
}
