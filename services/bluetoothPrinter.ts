import { Transaction, CompanyDetails, SalesSession } from '../types';

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private encoder = new TextEncoder();

  // Controleert of de verbinding met de printer nog actief is
  isConnected(): boolean {
    return !!(this.device?.gatt?.connected && this.characteristic);
  }

  // Maakt verbinding met de printer (Triggert de Chrome popup indien nodig)
  async connect(): Promise<boolean> {
    try {
      if (this.isConnected()) return true;

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await this.device.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service?.getCharacteristics();
      
      this.characteristic = characteristics?.find(c => 
        c.properties.write || c.properties.writeWithoutResponse
      ) || null;
      
      return !!this.characteristic;
    } catch (error) {
      console.error("Bluetooth verbindingsfout:", error);
      return false;
    }
  }

  // Verzendt data in kleine stukjes naar de printer voor stabiliteit op Android
  private async sendRaw(data: string) {
    if (!this.characteristic) return;
    
    const bytes = this.encoder.encode(data);
    const chunkSize = 20;
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 15));
    }
  }

  async printReceipt(
    transaction: Transaction | null, 
    company: CompanyDetails, 
    session?: SalesSession | null, 
    allTransactions: Transaction[] = []
  ) {
    // Probeer te verbinden als dat nog niet zo is
    if (!this.isConnected()) {
      const ok = await this.connect();
      if (!ok) return; 
    }

    const ESC = '\u001B';
    const GS = '\u001D';
    const LF = '\n';
    const CENTER = ESC + 'a' + '\u0001';
    const LEFT = ESC + 'a' + '\u0000';
    const BOLD_ON = ESC + 'E' + '\u0001';
    const BOLD_OFF = ESC + 'E' + '\u0000';
    const FONT_LARGE = ESC + '!' + '\u0010'; 
    const FONT_NORMAL = ESC + '!' + '\u0000';

    await this.sendRaw(ESC + '@'); // Reset printer

    let p = "";
    
    // --- HEADER (GECENTREERD) ---
    p += CENTER + BOLD_ON + company.name.toUpperCase() + BOLD_OFF + LF;
    p += company.address + LF;
    if (company.address2) p += company.address2 + LF;
    p += "BTW: " + company.vatNumber + LF;
    if (company.sellerName) p += "Verkoper: " + company.sellerName + LF;
    p += "--------------------------------" + LF;

    if (session) {
      // --- DAGRAPPORT MODUS ---
      p += BOLD_ON + "DAGRAPPORT (Z)" + BOLD_OFF + LF;
      p += LEFT + "Datum: " + new Date(session.startTime).toLocaleDateString('nl-NL') + LF;
      p += "--------------------------------" + LF;
      
      p += BOLD_ON + "VERKOCHTE PRODUCTEN:" + BOLD_OFF + LF;
      
      // Bereken totalen per product (geforceerd in HOOFDLETTERS)
      const productSummary: Record<string, number> = {};
      const sessionTx = allTransactions.filter(t => t.sessionId === session.id);
      
      sessionTx.forEach(tx => {
        tx.items.forEach(item => {
          const nameUpper = item.name.toUpperCase();
          productSummary[nameUpper] = (productSummary[nameUpper] || 0) + item.quantity;
        });
      });
      
      // Print elke productlijn netjes (bijv: "05 x BIER")
      Object.entries(productSummary).forEach(([name, qty]) => {
        const qtyStr = qty.toString().padStart(2, '0');
        p += `${qtyStr} x ${name.slice(0, 25)}` + LF;
      });

      p += "--------------------------------" + LF;
      p += "OMZET TOTAAL:  EUR " + (session.summary?.totalSales || 0).toFixed(2).padStart(8) + LF;
      p += "CONTANT:       EUR " + (session.summary?.cashTotal || 0).toFixed(2).padStart(8) + LF;
      p += "KAART:         EUR " + (session.summary?.cardTotal || 0).toFixed(2).padStart(8) + LF;
      p += "--------------------------------" + LF;
      p += "BTW 21%:       EUR " + (session.summary?.vat21Total || 0).toFixed(2).padStart(8) + LF;
      p += "BTW 0%:        EUR " + (session.summary?.vat0Total || 0).toFixed(2).padStart(8) + LF;

    } else if (transaction) {
      // --- KASSABON MODUS ---
      p += LEFT + "Datum: " + transaction.dateStr + LF;
      p += "Tijd:  " + new Date(transaction.timestamp).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'}) + LF;
      p += "Ticket: " + transaction.id.slice(-8) + LF;
      p += "--------------------------------" + LF;

      transaction.items.forEach(item => {
        // Productnaam in HOOFDLETTERS op eigen regel
        p += BOLD_ON + item.name.toUpperCase() + BOLD_OFF + LF;
        // Details op regel eronder (geen overlap mogelijk)
        const qtyPrice = `  ${item.quantity} x ${item.price.toFixed(2)}`;
        const lineTotal = (item.price * item.quantity).toFixed(2);
        p += qtyPrice.padEnd(22) + lineTotal.padStart(8) + LF;
      });

      p += "--------------------------------" + LF;
      // Dubbele hoogte voor Totaalbedrag
      p += FONT_LARGE + BOLD_ON + "TOTAAL".padEnd(12) + "EUR " + transaction.total.toFixed(2).padStart(7) + BOLD_OFF + FONT_NORMAL + LF;
      p += LF + "Betaalwijze: " + (transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART') + LF;
      
      // BTW OVERZICHT
      p += LF + BOLD_ON + "BTW OVERZICHT:" + BOLD_OFF + LF;
      if (transaction.vat21 > 0) {
        const net21 = (transaction.total / 1.21).toFixed(2);
        p += `21% over €${net21.padStart(7)} : €${transaction.vat21.toFixed(2)}` + LF;
      }
      if (transaction.vat0 > 0) {
        p += `0%  over €${transaction.vat0.toFixed(2).padStart(7)} : €0.00` + LF;
      }
    }

    // --- FOOTER ---
    p += LF + CENTER + (company.footerMessage || "Bedankt voor uw bezoek!") + LF;
    p += LF + LF + LF + LF + LF; 
    p += GS + 'V' + '\u0042' + '\u0000'; // Cut papier

    await this.sendRaw(p);
  }
}

export const btPrinterService = new BluetoothPrinterService();
