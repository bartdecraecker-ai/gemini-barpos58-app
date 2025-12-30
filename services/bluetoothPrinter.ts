import { Transaction, CompanyDetails, SalesSession } from '../types';

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Zoek naar printers en verbind
  async connect(): Promise<boolean> {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Standaard Bluetooth Print Service
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      const server = await this.device.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service?.getCharacteristics();
      
      // Zoek de 'write' karakteristiek
      this.characteristic = characteristics?.[0] || null;
      
      return !!this.characteristic;
    } catch (error) {
      console.error("Bluetooth connectie fout:", error);
      return false;
    }
  }

  isConnected(): boolean {
    return !!this.characteristic && this.device?.gatt?.connected === true;
  }

  // Helper om tekst om te zetten naar bytes voor de printer
  private encoder = new TextEncoder();
  
  private async printRaw(data: Uint8Array) {
    if (!this.characteristic) return;
    // Printers hebben vaak een limiet op de grootte van pakketten (MTU), we sturen in kleine stukjes
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      await this.characteristic.writeValue(data.slice(i, i + chunkSize));
    }
  }

  // De hoofd-print functie
  async printReceipt(transaction: Transaction | null, company: CompanyDetails, session?: SalesSession | null) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) return alert("Geen printer verbonden!");
    }

    const ESC = '\u001B';
    const GS = '\u001D';
    const LF = '\n';

    let p = "";
    
    // Initialiseer printer
    p += ESC + '@'; 
    // Centreer tekst
    p += ESC + 'a' + '\u0001'; 
    
    // BEDRIJFSNAAM
    p += company.name.toUpperCase() + LF;
    p += ESC + 'a' + '\u0000'; // Links uitlijnen
    p += company.address + LF;
    if (company.address2) p += company.address2 + LF;
    p += "BTW: " + company.vatNumber + LF;
    p += "--------------------------------" + LF;

    if (session) {
      // PRINT DAGRAPPORT
      p += ESC + 'a' + '\u0001';
      p += "DAGRAPPORT (Z)" + LF;
      p += ESC + 'a' + '\u0000';
      p += "Periode: " + new Date(session.startTime).toLocaleDateString() + LF;
      p += "Omzet: EUR " + session.summary?.totalSales.toFixed(2) + LF;
      p += "Contant: EUR " + session.summary?.cashTotal.toFixed(2) + LF;
      p += "Kaart: EUR " + session.summary?.cardTotal.toFixed(2) + LF;
    } else if (transaction) {
      // PRINT KASSABON
      p += "Ticket: " + transaction.id + LF;
      p += "Datum: " + transaction.dateStr + LF;
      p += "--------------------------------" + LF;
      
      transaction.items.forEach(item => {
        p += `${item.quantity}x ${item.name.padEnd(20)}` + LF;
        p += `   at €${item.price.toFixed(2)} -> €${(item.price * item.quantity).toFixed(2)}` + LF;
      });

      p += "--------------------------------" + LF;
      p += "TOTAAL: EUR " + transaction.total.toFixed(2) + LF;
      p += "Betaalmethode: " + (transaction.paymentMethod === 'CASH' ? 'Contant' : 'Kaart') + LF;
    }

    p += LF + company.footerMessage + LF;
    p += LF + LF + LF + LF; // Ruimte voor afscheuren
    p += GS + 'V' + '\u0042' + '\u0000'; // Snij commando (indien ondersteund)

    const bytes = this.encoder.encode(p);
    await this.printRaw(bytes);
  }
}

export const btPrinterService = new BluetoothPrinterService();
