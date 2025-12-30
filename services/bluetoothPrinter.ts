import { Transaction, CompanyDetails, SalesSession } from '../types';

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private encoder = new TextEncoder();

  async connect(): Promise<boolean> {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
      const server = await this.device.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service?.getCharacteristics();
      this.characteristic = characteristics?.find(c => c.properties.write || c.properties.writeWithoutResponse) || null;
      return !!this.characteristic;
    } catch (error) {
      return false;
    }
  }

  isConnected(): boolean {
    return !!this.characteristic && this.device?.gatt?.connected === true;
  }

  private async send(data: string) {
    if (!this.characteristic) return;
    const bytes = this.encoder.encode(data);
    const chunkSize = 20;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      await (this.characteristic.properties.writeWithoutResponse 
        ? this.characteristic.writeValueWithoutResponse(chunk) 
        : this.characteristic.writeValue(chunk));
      await new Promise(r => setTimeout(r, 15));
    }
  }

  async printReceipt(transaction: Transaction | null, company: CompanyDetails, session?: SalesSession | null, allTransactions?: Transaction[]) {
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

    await this.send(ESC + '@'); // Reset

    let p = "";
    
    // --- GECENTREERDE HEADER ---
    p += CENTER + BOLD_ON + company.name.toUpperCase() + BOLD_OFF + LF;
    p += company.address + LF;
    if (company.address2) p += company.address2 + LF;
    if (company.website) p += company.website + LF;
    p += "BTW: " + company.vatNumber + LF;
    p += "Verkoper: " + (company.sellerName || "Algemeen") + LF;
    p += "--------------------------------" + LF;

    if (session && allTransactions) {
      // --- RAPPORT LAYOUT ---
      p += BOLD_ON + "DAGRAPPORT (Z)" + BOLD_OFF + LF;
      p += LEFT + "Datum: " + new Date().toLocaleDateString('nl-NL') + LF;
      p += "Sessie: " + session.id.slice(-6) + LF;
      p += "--------------------------------" + LF;
      
      // PRODUCT SAMENVATTING (AANTALLEN)
      p += BOLD_ON + "VERKOCHTE PRODUCTEN:" + BOLD_OFF + LF;
      const summary: Record<string, number> = {};
      const sessionTx = allTransactions.filter(t => t.sessionId === session.id);
      sessionTx.forEach(tx => {
        tx.items.forEach(item => {
          summary[item.name] = (summary[item.name] || 0) + item.quantity;
        });
      });
      
      Object.entries(summary).forEach(([name, qty]) => {
        p += `${qty.toString().padEnd(4)} x ${name.slice(0, 25)}` + LF;
      });

      p += "--------------------------------" + LF;
      p += "OMZET TOTAAL:  EUR " + (session.summary?.totalSales || 0).toFixed(2) + LF;
      p += "CASH:          EUR " + (session.summary?.cashTotal || 0).toFixed(2) + LF;
      p += "KAART:         EUR " + (session.summary?.cardTotal || 0).toFixed(2) + LF;
      p += "--------------------------------" + LF;
      p += "BTW 21%:       EUR " + (session.summary?.vat21Total || 0).toFixed(2) + LF;
      p += "BTW 0%:        EUR " + (session.summary?.vat0Total || 0).toFixed(2) + LF;

    } else if (transaction) {
      // --- KASSABON LAYOUT ---
      p += LEFT + "Datum: " + transaction.dateStr + " " + new Date(transaction.timestamp).toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'}) + LF;
      p += "Ticket: " + transaction.id.slice(-8) + LF;
      p += "--------------------------------" + LF;

      transaction.items.forEach(item => {
        p += BOLD_ON + item.name.toUpperCase() + BOLD_OFF + LF;
        // Regel eronder voor prijs om overlap te voorkomen
        const priceDetail = `${item.quantity} x ${item.price.toFixed(2)}`;
        const totalLine = (item.price * item.quantity).toFixed(2);
        p += "  " + priceDetail.padEnd(20) + totalLine.padStart(8) + LF;
      });

      p += "--------------------------------" + LF;
      p += BOLD_ON + "TOTAAL".padEnd(20) + "EUR " + transaction.total.toFixed(2).padStart(8) + BOLD_OFF + LF;
      p += "Betaalwijze: " + (transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART') + LF;
      
      // BTW OVERZICHT OP TICKET
      p += LF + "BTW OVERZICHT:" + LF;
      if (transaction.vat21 > 0) {
        p += `21%: Net €${(transaction.total / 1.21).toFixed(2)} BTW €${transaction.vat21.toFixed(2)}` + LF;
      }
      if (transaction.vat0 > 0) {
        p += `0% : Net €${transaction.vat0.toFixed(2)} BTW €0.00` + LF;
      }
    }

    p += LF + CENTER + company.footerMessage + LF;
    p += LF + LF + LF + LF + LF;
    p += GS + 'V' + '\u0042' + '\u0000'; // Cut

    await this.send(p);
  }
}

export const btPrinterService = new BluetoothPrinterService();
