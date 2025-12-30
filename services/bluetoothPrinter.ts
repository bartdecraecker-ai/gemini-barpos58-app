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
      
      // Zoek de karakteristiek die schrijven toestaat
      this.characteristic = characteristics?.find(c => 
        c.properties.write || c.properties.writeWithoutResponse
      ) || null;
      
      return !!this.characteristic;
    } catch (error) {
      console.error("BT Connect Error:", error);
      return false;
    }
  }

  isConnected(): boolean {
    return !!this.characteristic && this.device?.gatt?.connected === true;
  }

  private async send(data: string | Uint8Array) {
    if (!this.characteristic) return;
    
    const bytes = typeof data === 'string' ? this.encoder.encode(data) : data;
    const chunkSize = 20;
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      // Gebruik de meest betrouwbare schrijf-methode
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Cruciaal: kleine pauze voor de printer hardware
      await new Promise(r => setTimeout(r, 15));
    }
  }

  async printReceipt(transaction: Transaction | null, company: CompanyDetails, session?: SalesSession | null) {
    if (!this.isConnected()) {
      const ok = await this.connect();
      if (!ok) return;
    }

    const ESC = '\u001B';
    const GS = '\u001D';
    const LF = '\n';

    // 1. Initialiseer & Clear buffer
    await this.send(ESC + '@'); 
    
    let p = "";
    // Centreer Header
    p += ESC + 'a' + '\u0001'; 
    p += company.name.toUpperCase() + LF;
    
    // Adres & Info
    p += ESC + 'a' + '\u0000'; // Links
    p += company.address + LF;
    if (company.address2) p += company.address2 + LF;
    p += "BTW: " + company.vatNumber + LF;
    p += "--------------------------------" + LF;

    if (session) {
      // RAPPORT PRINT
      p += ESC + 'a' + '\u0001';
      p += "DAGRAPPORT (Z)" + LF + LF;
      p += ESC + 'a' + '\u0000';
      p += "Start: " + new Date(session.startTime).toLocaleString('nl-NL') + LF;
      if (session.endTime) p += "Eind : " + new Date(session.endTime).toLocaleString('nl-NL') + LF;
      p += "--------------------------------" + LF;
      p += "OMZET TOTAAL:  EUR " + (session.summary?.totalSales || 0).toFixed(2) + LF;
      p += "CASH:          EUR " + (session.summary?.cashTotal || 0).toFixed(2) + LF;
      p += "KAART:         EUR " + (session.summary?.cardTotal || 0).toFixed(2) + LF;
      p += "--------------------------------" + LF;
      p += "BTW 21%:       EUR " + (session.summary?.vat21Total || 0).toFixed(2) + LF;
      p += "BTW 0%:        EUR " + (session.summary?.vat0Total || 0).toFixed(2) + LF;
    } else if (transaction) {
      // TICKET PRINT
      p += "Ticket: " + transaction.id + LF;
      p += "Datum:  " + transaction.dateStr + LF;
      p += "Verkoper: " + company.sellerName + LF;
      p += "--------------------------------" + LF;
      
      transaction.items.forEach(item => {
        p += `${item.quantity}x ${item.name}` + LF;
        p += `      €${item.price.toFixed(2)} p/s -> €${(item.price * item.quantity).toFixed(2)}` + LF;
      });

      p += "--------------------------------" + LF;
      p += ESC + '!' + '\u0010'; // Dubbele hoogte voor totaal
      p += "TOTAAL: EUR " + transaction.total.toFixed(2) + LF;
      p += ESC + '!' + '\u0000'; // Normaal
      p += "Betaald via: " + (transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART') + LF;
    }

    p += LF + company.footerMessage + LF;
    p += LF + LF + LF + LF; // Extra witruimte voor scheuren
    
    // Papier snijden (indien ondersteund)
    p += GS + 'V' + '\u0042' + '\u0000';

    await this.send(p);
  }
}

export const btPrinterService = new BluetoothPrinterService();
