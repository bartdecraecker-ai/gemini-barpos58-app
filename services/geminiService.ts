
import { GoogleGenAI } from "@google/genai";
import { Transaction, DailySummary } from "../types";

export const generateDailyInsight = async (
  transactions: Transaction[],
  summary: DailySummary,
  mode: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key niet geconfigureerd in de omgeving.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Filter transactions for the relevant session if possible, otherwise use last 20
  const salesData = transactions.slice(0, 20).map(t => ({
    time: new Date(t.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
    total: t.total,
    items: t.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
    method: t.paymentMethod
  }));

  const prompt = `
    Je bent een senior business consultant voor een bar genaamd "DE GEZELLIGE BAR". 
    Analyseer de prestaties van de huidige sessie (${mode} modus).

    DATA SAMENVATTING:
    - Totale Omzet: €${summary.totalSales.toFixed(2)}
    - Transacties: ${summary.transactionCount}
    - Verhouding Cash/Kaart: €${summary.cashTotal.toFixed(2)} / €${summary.cardTotal.toFixed(2)}
    - BTW Hoog (21%): €${summary.vatHighTotal.toFixed(2)}

    LAATSTE TRANSACTIES:
    ${JSON.stringify(salesData)}

    GEEF JE ANALYSE IN HET NEDERLANDS (Markdown):
    1. **Prestatie Score**: (Cijfer op 10 + motivatie).
    2. **Trends**: Drukste momenten en populaire producten.
    3. **Strategisch Advies**: Eén concrete tip voor de volgende shift.

    Houd het kort en krachtig.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Geen analyse beschikbaar.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('401')) return "Fout: Ongeldige of verlopen API sleutel.";
    if (error.message?.includes('429')) return "Fout: Te veel aanvragen. Probeer het later opnieuw.";
    return "De AI consultant is momenteel niet bereikbaar.";
  }
};
