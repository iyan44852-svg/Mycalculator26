import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route for Natural Language Calculation
  app.post("/api/calculate-natural", async (req, res) => {
    try {
      const { prompt, customButtons } = req.body;

      // Define a schema for the extraction
      // We want to extract the mathematical expression or the final result.
      // If it matches a custom button, we should use that logic.
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `User request: "${prompt}"
        Current custom buttons: ${JSON.stringify(customButtons)}
        
        Translate the user's natural language request into a mathematical expression.
        If the user is asking to use a specific custom button (by name), use the formula of that button replacing the placeholder.
        Return the expression and a brief explanation in Indonesian.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              expression: { type: Type.STRING, description: "The mathematical expression to evaluate (e.g. '5 * 2000 + 5000')" },
              explanation: { type: Type.STRING, description: "Brief explanation in Indonesian" }
            },
            required: ["expression", "explanation"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Gagal memproses bahasa alami." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
