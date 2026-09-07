import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getEmailQueue } from "@hostpanel/jobs";

/** Queue-monitoring UI (section 3: "Bull Board or equivalent queue monitoring"). */
export function createBullBoardServer(): express.Express {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/");

  createBullBoard({
    queues: [new BullMQAdapter(getEmailQueue())],
    serverAdapter,
  });

  const app = express();
  app.use("/", serverAdapter.getRouter());
  return app;
}
