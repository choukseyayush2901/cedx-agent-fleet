import express from "express";
import type { Express } from "express";
import { env } from "./config/env.js";
import { ReplayEngine, deriveAmendment } from "./llm/ReplayEngine.js";

export class App {
  create(): Express {
    const app = express();
    app.use(express.json());

    app.get("/health", (_request, response) => {
      response.json({
        ok: true,
        service: "cedx-agent-fleet",
        amendment: deriveAmendment(env.CASE_ID),
      });
    });

    app.post("/demo", async (_request, response, next) => {
      try {
        response.json(await new ReplayEngine().demo(env.SEED_DIR));
      } catch (error) {
        next(error);
      }
    });

    return app;
  }

  start(): void {
    this.create().listen(env.PORT, () => {
      console.log(`CEDX agent fleet listening on ${env.PORT}`);
    });
  }
}

export function createApp(): Express {
  return new App().create();
}

export async function startApp(): Promise<void> {
  new App().start();
}
