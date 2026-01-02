
import { GoogleGenAI } from "@google/genai";
import { Transaction, DailySummary } from "../types.ts";

export const generateDailyInsight = async (
  transactions: Transaction[],
  summary: DailySummary,
  mode: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key niet geconfigureerd.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Analyseer deze verkoopdata voor een bar: ${summary.totalSales} euro omzet over ${summary.transactionCount} tickets.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Geen analyse beschikbaar.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI Consultant tijdelijk niet beschikbaar.";
  }
};
