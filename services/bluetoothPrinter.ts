import { Transaction, CompanyDetails, SalesSession } from '../types';

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private encoder = new TextEncoder();

  // 1. Verbinden met de printer
  async connect(): Promise<boolean> {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await this.device.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service?.getCharacteristics();
      
      // Zoek de juiste schrijf-poort
      this.characteristic = characteristics?.find(c => 
        c.properties.write || c.properties.writeWithoutResponse
      ) || null;
      
      return !!this.characteristic;
    } catch (error) {
      console.error("Bluetooth verbinding mislukt:", error);
      return false;
    }
  }

  isConnected(): boolean {
    return !!this.characteristic && this.device?.gatt?.connected === true;
  }

  // 2. Data verzenden in kleine stukjes (chunks) voor Android stabiliteit
  private async send(data: string) {
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
      // Wacht 15ms zodat de printer de data kan verwerken
      await new Promise(r => setTimeout(r, 15));
    }
  }

  // 3. De hoofdprint functie
  async printReceipt(
    transaction: Transaction | null, 
    company: CompanyDetails, 
    session?: SalesSession | null, 
    allTransactions?: Transaction[]
  ) {
    if (!this.isConnected()) {
      const ok = await this.connect();
      if (!ok) return;
    }

    // Printer Commando's (ESC/POS)
    const ESC = '\u001B';
    const GS = '\u001D';
    const LF = '\n';
    const CENTER = ESC + 'a' + '\u0001';
    const LEFT = ESC + 'a' + '\u0000';
    const BOLD_ON = ESC + 'E' + '\u0001';
    const BOLD_OFF = ESC + 'E' + '\u0000';
    const FONT_LARGE = ESC + '!' + '\u0010'; 
    const FONT_NORMAL = ESC + '!' + '\u0000';

    // Initialiseer printer
    await this.send(ESC + '@'); 

    let p = "";
    
    // --- HEADER (GECENTREERD) ---
    p += CENTER + BOLD_ON + company.name.toUpperCase() + BOLD_OFF + LF;
    p += company.address + LF;
    if (company.address2) p += company.address2 + LF;
    p += "BTW: " + company.vatNumber + LF;
    if (company.sellerName) p += "Verkoper: " + company.sellerName + LF;
    p += "--------------------------------" + LF;

    if (session && allTransactions) {
      // --- MODUS: DAGRAPPORT ---
      p += BOLD_ON + "DAGRAPPORT (Z)" + BOLD_OFF + LF;
      p += LEFT + "Datum: " + new Date(session.startTime).toLocaleDateString('nl-NL') + LF;
      p += "Sessie ID: " + session.id.slice(-6) + LF;
      p += "--------------------------------" + LF;
      
      // Producten optellen
      p += BOLD_ON + "VERKOCHTE PRODUCTEN:" + BOLD_OFF + LF;
      const productSummary: Record<string, number> = {};
      const sessionTx = allTransactions.filter(t => t.sessionId === session.id);
      
      sessionTx.forEach(tx => {
        tx.items.forEach(item => {
          productSummary[item.name] = (productSummary[item.name] || 0) + item.quantity;
        });
      });
      
      Object.entries(productSummary).forEach(([name, qty]) => {
        p += `${qty.toString().padStart(2, '0')} x ${name.slice(0, 25)}` + LF;
      });

      p += "--------------------------------" + LF;
      p += "OMZET TOTAAL:  EUR " + (session.summary?.totalSales || 0).toFixed(2).padStart(8) + LF;
      p += "CONTANT:       EUR " + (session.summary?.cashTotal || 0).toFixed(2).padStart(8) + LF;
      p += "KAART:         EUR " + (session.summary?.cardTotal || 0).toFixed(2).padStart(8) + LF;
      p += "--------------------------------" + LF;
      p += "BTW 21%:       EUR " + (session.summary?.vat21Total || 0).toFixed(2).padStart(8) + LF;
      p += "BTW 0%:        EUR " + (session.summary?.vat0Total || 0).toFixed(2).padStart(8) + LF;

    } else if (transaction) {
      // --- MODUS: KASSABON ---
      p += LEFT + "Datum: " + transaction.dateStr + LF;
      p += "Ticket: " + transaction.id.slice(-8) + LF;
      p += "--------------------------------" + LF;

      transaction.items.forEach(item => {
        // Naam vetgedrukt op eigen regel (voorkomt overlap)
        p += BOLD_ON + item.name.toUpperCase() + BOLD_OFF + LF;
        // Details op de regel eronder: Aantal x Prijs aan de linkerkant, Totaal aan de rechterkant
        const qtyPrice = `  ${item.quantity} x ${item.price.toFixed(2)}`;
        const lineTotal = (item.price * item.quantity).toFixed(2);
        p += qtyPrice.padEnd(22) + lineTotal.padStart(8) + LF;
      });

      p += "--------------------------------" + LF;
      // Groot totaalbedrag
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
    p += LF + CENTER + company.footerMessage + LF;
    p += LF + LF + LF + LF + LF; // Ruimte om af te scheuren
    p += GS + 'V' + '\u0042' + '\u0000'; // Papier snijden

    await this.send(p);
  }
}

export const btPrinterService = new BluetoothPrinterService();
