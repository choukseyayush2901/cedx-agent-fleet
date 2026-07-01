import { readFile } from "node:fs/promises";
import { join } from "node:path";

export class TranscriptService {
  constructor(private readonly rootDir = "transcripts") {}

  async readByHash(hash: string): Promise<unknown> {
    const stem = hash.split(":").at(-1);
    if (!stem) {
      throw new Error(`Invalid transcript hash: ${hash}`);
    }

    return JSON.parse(await readFile(join(this.rootDir, `${stem}.json`), "utf8"));
  }
}
