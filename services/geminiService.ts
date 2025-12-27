import { GoogleGenAI } from "@google/genai";
import { Transaction, DailySummary } from "../types";

export const generateDailyInsight = async (
  transactions: Transaction[],
  summary: DailySummary
): Promise<string> => {
  // Always use process.env.API_KEY directly when initializing.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare a lightweight data summary to send to the model
  const salesData = transactions.map(t => ({
    time: new Date(t.timestamp).toLocaleTimeString('nl-NL'),
    total: t.total,
    items: t.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
    method: t.paymentMethod
  }));

  const prompt = `
    Je bent een assistent van een barmanager. Analyseer de volgende verkoopgegevens voor vandaag.
    
    Samenvatting:
    Totale Omzet: €${summary.totalSales.toFixed(2)}
    Cash: €${summary.cashTotal.toFixed(2)}
    Kaart: €${summary.cardTotal.toFixed(2)}
    Transacties: ${summary.transactionCount}

    Gedetailleerd Logboek (Sample):
    ${JSON.stringify(salesData.slice(0, 50))} 
    
    Geef alsjeblieft:
    1. Een kort sentiment over de prestaties van vandaag.
    2. Identificeer de best verkopende items of categorieën op basis van het logboek.
    3. Eén actiebare tip voor morgen.
    
    Houd het beknopt (maximaal 150 woorden). Formatteer als een vriendelijk tekstbericht in het Nederlands.
  `;

  try {
    // Using gemini-3-flash-preview for text analysis task as per guidelines.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Use .text property to access content directly.
    return response.text || "Geen inzicht gegenereerd.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Kan op dit moment geen inzichten genereren. Controleer je verbinding.";
  }
};