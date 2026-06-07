// ============================================================
// DeFi Copilot — Express App Entry Point
// Mounts all route handlers with CORS middleware
// ============================================================

import express from "express";
import cors from "cors";
import serverless from "serverless-http";
import processIntentRouter from "./routes/process-intent";
import rememberRouter from "./routes/remember";
import healthRouter from "./routes/health";

const app = express();

// CORS configuration - allow frontend origin
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Routes ---
app.use("/api/process-intent", processIntentRouter);
app.use("/api/remember", rememberRouter);
app.use("/api/health", healthRouter);

// Local development server
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

// Export for serverless deployment (AWS Lambda)
export const handler = serverless(app);
export default app;
