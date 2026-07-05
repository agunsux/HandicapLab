import { Readable } from 'stream';

export interface StorageOptions {
  contentType?: string;
  compress?: 'gzip' | 'none';
}

export interface IObjectStorage {
  exists(key: string): Promise<boolean>;
  upload(key: string, content: Buffer | string, options?: StorageOptions): Promise<void>;
  download(key: string): Promise<Buffer>;
  streamUpload(key: string, stream: Readable, options?: StorageOptions): Promise<void>;
  streamDownload(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  move(sourceKey: string, destKey: string): Promise<void>;
  copy(sourceKey: string, destKey: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  generateChecksum(key: string): Promise<string>;
}
