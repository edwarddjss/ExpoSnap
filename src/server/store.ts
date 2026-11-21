import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeviceInfo, LogEntry, LogLevel } from '../shared/protocol.js';

export interface Screenshot {
  id: string;
  timestamp: number;
  filename: string;
  mimeType: 'image/png' | 'image/jpeg';
  description?: string;
  width?: number;
  height?: number;
  /** Who asked for it: the agent through take_screenshot, or a person tapping the button. */
  trigger: 'agent' | 'manual';
}

const IMAGE_TYPES: Record<string, Screenshot['mimeType']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export const mimeTypeFor = (filename: string) =>
  IMAGE_TYPES[path.extname(filename).toLowerCase()] ?? 'image/png';

export const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
};

interface StoreEvents {
  screenshot: [Screenshot];
  log: [LogEntry];
}

/**
 * Screenshots on disk (newest first, capped) and the app's recent console
 * output in memory. Each image keeps a JSON sidecar so its description and
 * trigger survive a server restart.
 */
export class Store extends EventEmitter<StoreEvents> {
  private screenshots: Screenshot[] = [];
  private logs: LogEntry[] = [];

  constructor(
    readonly dir: string,
    private readonly maxScreenshots: number,
    private readonly maxLogs: number
  ) {
    super();
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const files = await fs.readdir(this.dir);
    const loaded = await Promise.all(
      files
        .filter(file => path.extname(file).toLowerCase() in IMAGE_TYPES)
        .map(async file => this.readExisting(file))
    );
    this.screenshots = loaded
      .filter((shot): shot is Screenshot => shot !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
    await this.prune();
  }

  private async readExisting(filename: string): Promise<Screenshot | null> {
    const id = filename.replace(/\.[^.]+$/, '');
    try {
      const meta = JSON.parse(
        await fs.readFile(path.join(this.dir, `${id}.json`), 'utf8')
      ) as Screenshot;
      return { ...meta, id, filename };
    } catch {
      try {
        const stats = await fs.stat(path.join(this.dir, filename));
        return {
          id,
          filename,
          timestamp: stats.mtimeMs,
          mimeType: mimeTypeFor(filename),
          trigger: 'manual',
        };
      } catch {
        return null;
      }
    }
  }

  async addScreenshot(
    data: Buffer,
    meta: Omit<Screenshot, 'id' | 'filename' | 'timestamp'>
  ): Promise<Screenshot> {
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
    const filename = `${id}${meta.mimeType === 'image/jpeg' ? '.jpg' : '.png'}`;
    const shot: Screenshot = { ...meta, id, filename, timestamp: Date.now() };
    await fs.writeFile(path.join(this.dir, filename), data);
    await fs.writeFile(path.join(this.dir, `${id}.json`), JSON.stringify(shot));
    this.screenshots.unshift(shot);
    await this.prune();
    this.emit('screenshot', shot);
    return shot;
  }

  private async prune(): Promise<void> {
    const removed = this.screenshots.splice(this.maxScreenshots);
    await Promise.all(
      removed.flatMap(shot => [
        fs.rm(path.join(this.dir, shot.filename), { force: true }),
        fs.rm(path.join(this.dir, `${shot.id}.json`), { force: true }),
      ])
    );
  }

  listScreenshots(limit = this.maxScreenshots): Screenshot[] {
    return this.screenshots.slice(0, limit);
  }

  latestScreenshot(): Screenshot | undefined {
    return this.screenshots[0];
  }

  findScreenshot(id: string): Screenshot | undefined {
    return this.screenshots.find(shot => shot.id === id);
  }

  async readImage(shot: Screenshot): Promise<string> {
    return (await fs.readFile(path.join(this.dir, shot.filename))).toString(
      'base64'
    );
  }

  pathOf(shot: Screenshot): string {
    return path.join(this.dir, shot.filename);
  }

  addLogs(entries: LogEntry[]): void {
    for (const entry of entries) {
      this.logs.push(entry);
      this.emit('log', entry);
    }
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
  }

  queryLogs(filter: {
    minLevel?: LogLevel;
    since?: number;
    search?: string;
    limit?: number;
  }): LogEntry[] {
    const min = LEVEL_RANK[filter.minLevel ?? 'debug'];
    const needle = filter.search?.toLowerCase();
    const matched = this.logs.filter(
      entry =>
        LEVEL_RANK[entry.level] >= min &&
        (filter.since === undefined || entry.timestamp >= filter.since) &&
        (!needle || entry.message.toLowerCase().includes(needle))
    );
    return matched.slice(-(filter.limit ?? 100));
  }

  clearLogs(): number {
    const count = this.logs.length;
    this.logs = [];
    return count;
  }

  get logCount(): number {
    return this.logs.length;
  }
}

export type { DeviceInfo };
