// ============================================================
// Marina Copilot — Express App Entry Point
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

// JSON body parser with size limit to prevent large payload attacks
app.use(express.json({ limit: "100kb" }));

// Handle malformed JSON parse errors gracefully
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
    return res.status(400).json({
      type: "error",
      error: {
        message: "Invalid request format. Please check your input and try again.",
        suggestion: "Ensure your request contains valid JSON.",
      },
    });
  }
  if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.too.large") {
    return res.status(413).json({
      type: "error",
      error: {
        message: "Request too large. Please reduce the size of your message.",
        suggestion: "Try sending a shorter message.",
      },
    });
  }
  next(err);
});

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
