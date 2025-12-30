import { Transaction, CompanyDetails, SalesSession } from '../types';

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private encoder = new TextEncoder();

  isConnected(): boolean {
    return !!(this.device?.gatt?.connected && this.characteristic);
  }

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
      this.characteristic = characteristics?.find(c => c.properties.write || c.properties.writeWithoutResponse) || null;
      return !!this.characteristic;
    } catch (error) {
      return false;
    }
  }

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
      await new Promise(r => setTimeout(r, 20));
    }
  }

  async printReceipt(transaction: Transaction | null, company: CompanyDetails, session?: SalesSession | null, allTransactions: Transaction[] = []) {
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

    await this.sendRaw(ESC + '@'); 
    let p = "";
    
    // --- HEADER ---
    p += CENTER + BOLD_ON + company.name.toUpperCase() + BOLD_OFF + LF;
    p += company.address + LF;
    if (company.address2) p += company.address2 + LF;
    p += "BTW: " + company.vatNumber + LF;
    p += "--------------------------------" + LF;

    if (session) {
      // --- DAGRAPPORT ---
      p += BOLD_ON + "DAGRAPPORT (Z)" + BOLD_OFF + LF;
      p += LEFT + "Datum: " + new Date(session.startTime).toLocaleDateString('nl-NL') + LF;
      p += "--------------------------------" + LF;
      
      p += BOLD_ON + "Verkochte producten:" + BOLD_OFF + LF;
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
      p += "Omzet Totaal:  EUR " + (session.summary?.totalSales || 0).toFixed(2).padStart(10) + LF;
      p += "Via Kaart:     EUR " + (session.summary?.cardTotal || 0).toFixed(2).padStart(10) + LF;
      p += "Via Cash:      EUR " + (session.summary?.cashTotal || 0).toFixed(2).padStart(10) + LF;
      p += "--------------------------------" + LF;
      
      // KAS FINANCIEEL
      const begin = session.cashManagement?.openingBalance || 0;
      const eind = session.cashManagement?.closingBalance || 0;
      const verschil = session.cashManagement?.difference || 0;

      p += "Beginsaldo:    EUR " + begin.toFixed(2).padStart(10) + LF;
      p += "Eindsaldo:     EUR " + eind.toFixed(2).padStart(10) + LF;
      p += BOLD_ON + "Verschil:      EUR " + verschil.toFixed(2).padStart(10) + BOLD_OFF + LF;

    } else if (transaction) {
      // --- KASSABON ---
      p += LEFT + "Datum: " + transaction.dateStr + LF;
      p += "Ticket: " + transaction.id.slice(-8) + LF;
      p += "--------------------------------" + LF;

      transaction.items.forEach(item => {
        // Productnaam gewoon (geen CAPS meer)
        p += item.name + LF;
        const qtyPrice = `  ${item.quantity} x ${item.price.toFixed(2)}`;
        const lineTotal = (item.price * item.quantity).toFixed(2);
        p += qtyPrice.padEnd(22) + lineTotal.padStart(8) + LF;
      });

      p += "--------------------------------" + LF;
      p += FONT_LARGE + BOLD_ON + "TOTAAL".padEnd(12) + "EUR " + transaction.total.toFixed(2).padStart(7) + BOLD_OFF + FONT_NORMAL + LF;
      p += LF + "Betaald: " + (transaction.paymentMethod === 'CASH' ? 'Contant' : 'Kaart') + LF;
      
      // BTW OVERZICHT (Onder elkaar tegen overlap)
      p += LF + BOLD_ON + "BTW Overzicht:" + BOLD_OFF + LF;
      if (transaction.vat21 > 0) {
        const net21 = (transaction.total / 1.21);
        p += `Basis 21%: EUR ${net21.toFixed(2).padStart(10)}` + LF;
        p += `Bedrag 21%: EUR ${transaction.vat21.toFixed(2).padStart(10)}` + LF;
      }
      if (transaction.vat0 > 0) {
        p += `Basis 0%:  EUR ${transaction.vat0.toFixed(2).padStart(10)}` + LF;
        p += `Bedrag 0%:  EUR 0.00`.padStart(15) + LF;
      }
    }

    p += LF + CENTER + (company.footerMessage || "Bedankt!") + LF;
    p += LF + LF + LF + LF + LF; 
    p += GS + 'V' + '\u0042' + '\u0000'; 

    await this.sendRaw(p);
  }
}

export const btPrinterService = new BluetoothPrinterService();
