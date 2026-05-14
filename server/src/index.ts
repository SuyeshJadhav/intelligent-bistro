import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import chatRouter from "./routes/chat";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", chatRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "intelligent-bistro-api" });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Bistro API running on port ${port} (0.0.0.0)`);
});
