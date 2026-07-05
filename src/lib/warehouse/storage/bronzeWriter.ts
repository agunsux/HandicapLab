import { IObjectStorage } from './storage.interface';
import { StorageHelpers } from './helpers';

export interface BronzeMetadata {
  importedAt: string;
  provider: string;
  league: string;
  season: number;
  endpoint: string;
  custom?: any;
}

export interface BronzeVersion {
  version: number;
  checksum: string;
  path: string;
  timestamp: string;
  metadata: BronzeMetadata;
}

export interface BronzeManifest {
  provider: string;
  league: string;
  season: number;
  endpoint: string;
  versions: BronzeVersion[];
}

export class BronzeWriter {
  private readonly storage: IObjectStorage;

  constructor(storage: IObjectStorage) {
    this.storage = storage;
  }

  private getManifestKey(provider: string, league: string, season: number, endpoint: string): string {
    const cleanProvider = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLeague = league.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanEndpoint = endpoint.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `bronze/${cleanProvider}/${cleanLeague}/${season}/${cleanEndpoint}/manifest.json`;
  }

  private getRawFileKey(provider: string, league: string, season: number, endpoint: string, version: number): string {
    const cleanProvider = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLeague = league.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanEndpoint = endpoint.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `bronze/${cleanProvider}/${cleanLeague}/${season}/${cleanEndpoint}/raw_v${version}.json.gz`;
  }

  public async write(params: {
    provider: string;
    league: string;
    season: number;
    endpoint: string;
    rawData: any;
    customMetadata?: any;
  }): Promise<{ key: string; skipped: boolean; version: number }> {
    
    const { provider, league, season, endpoint, rawData, customMetadata } = params;
    const manifestKey = this.getManifestKey(provider, league, season, endpoint);
    
    // 1. Fetch or create manifest
    let manifest: BronzeManifest = {
      provider,
      league,
      season,
      endpoint,
      versions: []
    };

    if (await this.storage.exists(manifestKey)) {
      const manifestBuffer = await this.storage.download(manifestKey);
      manifest = JSON.parse(manifestBuffer.toString());
    }

    // 2. Calculate incoming checksum
    const rawString = JSON.stringify(rawData);
    const rawBuffer = Buffer.from(rawString);
    const checksum = StorageHelpers.sha256(rawBuffer);

    // 3. Immutability check: if identical checksum exists, skip upload
    const existingVersion = manifest.versions.find(v => v.checksum === checksum);
    if (existingVersion) {
      return {
        key: existingVersion.path,
        skipped: true,
        version: existingVersion.version
      };
    }

    // 4. Determine new version
    const newVersionNumber = manifest.versions.length + 1;
    const rawKey = this.getRawFileKey(provider, league, season, endpoint, newVersionNumber);

    // 5. Upload compressed raw payload
    const metadata: BronzeMetadata = {
      importedAt: new Date().toISOString(),
      provider,
      league,
      season,
      endpoint,
      custom: customMetadata || {}
    };

    await this.storage.upload(rawKey, rawBuffer, {
      contentType: 'application/json',
      compress: 'gzip'
    });

    // 6. Update manifest
    const newVersion: BronzeVersion = {
      version: newVersionNumber,
      checksum,
      path: rawKey,
      timestamp: metadata.importedAt,
      metadata
    };

    manifest.versions.push(newVersion);
    await this.storage.upload(manifestKey, JSON.stringify(manifest, null, 2), {
      contentType: 'application/json'
    });

    return {
      key: rawKey,
      skipped: false,
      version: newVersionNumber
    };
  }
}
