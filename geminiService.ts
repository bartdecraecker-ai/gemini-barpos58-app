
import { GoogleGenAI } from "@google/genai";
import { Transaction, DailySummary } from "../types";

export const generateDailyInsight = async (
  transactions: Transaction[],
  summary: DailySummary,
  mode: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const salesData = transactions.slice(0, 30).map(t => ({
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

    LAATSTE TRANSACTIES:
    ${JSON.stringify(salesData)}

    GEEF JE ANALYSE IN HET NEDERLANDS:
    1. **Prestatie Score**: (Geef een cijfer op 10 en korte motivatie).
    2. **Trends**: Welke tijdstippen waren het drukst en welke producten vlogen de deur uit?
    3. **Strategisch Advies**: Geef één concrete tip om de omzet of efficiëntie voor de volgende shift te verhogen.

    Houd het professioneel, actiegericht en beknopt. Gebruik Markdown formatting.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "Geen analyse beschikbaar.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "De AI consultant is momenteel niet bereikbaar. Controleer je API sleutel of internetverbinding.";
  }
};
