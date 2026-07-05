import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { IObjectStorage, StorageOptions } from './storage.interface';
import { StorageHelpers } from './helpers';

const streamPipeline = promisify(pipeline);

export class LocalStorage implements IObjectStorage {
  private readonly baseDir: string;

  constructor(config: { baseDir: string }) {
    this.baseDir = path.resolve(config.baseDir);
  }

  private getFullPath(key: string): string {
    return path.join(this.baseDir, key);
  }

  private async retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 100): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient = ['EMFILE', 'ENOSPC', 'EAGAIN', 'EBUSY', 'ETIMEDOUT'].includes(err.code);
      if (isTransient && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.retry(fn, retries - 1, delayMs * 2);
      }
      throw err;
    }
  }

  public async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await fsPromises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  public async upload(key: string, content: Buffer | string, options?: StorageOptions): Promise<void> {
    const fullPath = this.getFullPath(key);
    const parentDir = path.dirname(fullPath);

    await this.retry(async () => {
      await fsPromises.mkdir(parentDir, { recursive: true });
      let finalContent = typeof content === 'string' ? Buffer.from(content) : content;

      if (options?.compress === 'gzip') {
        finalContent = zlib.gzipSync(finalContent);
      }

      await fsPromises.writeFile(fullPath, finalContent);
      
      // Calculate and store checksum
      const checksum = StorageHelpers.sha256(finalContent);
      await fsPromises.writeFile(`${fullPath}.sha256`, checksum);
    });
  }

  public async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return await this.retry(async () => {
      const content = await fsPromises.readFile(fullPath);
      
      // Verification of checksum if available
      const checksumPath = `${fullPath}.sha256`;
      try {
        const storedChecksum = (await fsPromises.readFile(checksumPath, 'utf8')).trim();
        const currentChecksum = StorageHelpers.sha256(content);
        if (storedChecksum !== currentChecksum) {
          throw new Error(`Checksum mismatch for key: ${key}`);
        }
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }

      return content;
    });
  }

  public async streamUpload(key: string, stream: Readable, options?: StorageOptions): Promise<void> {
    const fullPath = this.getFullPath(key);
    const parentDir = path.dirname(fullPath);

    await this.retry(async () => {
      await fsPromises.mkdir(parentDir, { recursive: true });
      const writeStream = fs.createWriteStream(fullPath);

      if (options?.compress === 'gzip') {
        const gzip = zlib.createGzip();
        await streamPipeline(stream, gzip, writeStream);
      } else {
        await streamPipeline(stream, writeStream);
      }

      // Read back to generate checksum for metadata safety
      const finalContent = await fsPromises.readFile(fullPath);
      const checksum = StorageHelpers.sha256(finalContent);
      await fsPromises.writeFile(`${fullPath}.sha256`, checksum);
    });
  }

  public async streamDownload(key: string): Promise<Readable> {
    const fullPath = this.getFullPath(key);
    return await this.retry(async () => {
      return fs.createReadStream(fullPath);
    });
  }

  public async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    await this.retry(async () => {
      try {
        await fsPromises.unlink(fullPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
      try {
        await fsPromises.unlink(`${fullPath}.sha256`);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    });
  }

  public async move(sourceKey: string, destKey: string): Promise<void> {
    const srcPath = this.getFullPath(sourceKey);
    const destPath = this.getFullPath(destKey);
    const destDir = path.dirname(destPath);

    await this.retry(async () => {
      await fsPromises.mkdir(destDir, { recursive: true });
      await fsPromises.rename(srcPath, destPath);
      
      // Also move checksum if it exists
      try {
        await fsPromises.rename(`${srcPath}.sha256`, `${destPath}.sha256`);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    });
  }

  public async copy(sourceKey: string, destKey: string): Promise<void> {
    const srcPath = this.getFullPath(sourceKey);
    const destPath = this.getFullPath(destKey);
    const destDir = path.dirname(destPath);

    await this.retry(async () => {
      await fsPromises.mkdir(destDir, { recursive: true });
      await fsPromises.copyFile(srcPath, destPath);
      
      // Also copy checksum if it exists
      try {
        await fsPromises.copyFile(`${srcPath}.sha256`, `${destPath}.sha256`);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    });
  }

  public async list(prefix = ''): Promise<string[]> {
    const searchDir = path.join(this.baseDir, prefix);
    try {
      const files = await fsPromises.readdir(searchDir, { recursive: true });
      return (files as string[])
        .map(f => path.join(prefix, f).replace(/\\/g, '/'))
        .filter(f => !f.endsWith('.sha256'));
    } catch {
      return [];
    }
  }

  public async generateChecksum(key: string): Promise<string> {
    const fullPath = this.getFullPath(key);
    const content = await fsPromises.readFile(fullPath);
    return StorageHelpers.sha256(content);
  }
}
