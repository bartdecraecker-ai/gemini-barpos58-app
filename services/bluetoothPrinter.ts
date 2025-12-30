import { Transaction, CompanyDetails, SalesSession } from '../types';

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private ESC = '\x1B';
  private GS = '\x1D';
  private CENTER = '\x1Ba\x01';
  private LEFT = '\x1Ba\x00';
  private BOLD_ON = '\x1BE\x01';
  private BOLD_OFF = '\x1BE\x00';
  private DOUBLE_SIZE = '\x1D!\x11';
  private RESET_SIZE = '\x1D!\x00';
  private LINE_FEED = '\n';

  async connect() {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['e7e11000-410a-4122-8611-37d11f845d44']
      });
      this.server = await this.device.gatt!.connect();
      const service = await this.server.getPrimaryService('e7e11000-410a-4122-8611-37d11f845d44');
      this.characteristic = await service.getCharacteristic('e7e11001-410a-4122-8611-37d11f845d44');
      return true;
    } catch (error) {
      console.error("Bluetooth connectie fout:", error);
      return false;
    }
  }

  isConnected() {
    return !!this.characteristic;
  }

  private async write(text: string) {
    if (!this.characteristic) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.characteristic.writeValue(data);
  }

  async printReceipt(tx: Transaction | null, company: CompanyDetails, session: SalesSession | null, allTransactions: Transaction[]) {
    if (!this.characteristic) return;

    await this.write(this.CENTER);
    await this.write(this.BOLD_ON + this.DOUBLE_SIZE + company.name + this.RESET_SIZE + this.BOLD_OFF + this.LINE_FEED);
    await this.write(company.address + this.LINE_FEED);
    if (company.address2) await this.write(company.address2 + this.LINE_FEED);
    await this.write("BTW: " + company.vatNumber + this.LINE_FEED);
    if (company.website) await this.write(company.website + this.LINE_FEED);
    await this.write("-".repeat(32) + this.LINE_FEED);

    if (tx) {
      // --- KASSABON ---
      await this.write(this.BOLD_ON + "TICKET: " + tx.id.slice(-8) + this.BOLD_OFF + this.LINE_FEED);
      await this.write(tx.dateStr + this.LINE_FEED + this.LINE_FEED);
      await this.write(this.LEFT);

      for (const item of tx.items) {
        const line = `${item.quantity}x ${item.name.padEnd(18)} €${(item.price * item.quantity).toFixed(2).padStart(7)}`;
        await this.write(line + this.LINE_FEED);
      }

      await this.write("-".repeat(32) + this.LINE_FEED);
      await this.write(this.BOLD_ON + this.DOUBLE_SIZE + "TOTAAL: €" + tx.total.toFixed(2) + this.RESET_SIZE + this.BOLD_OFF + this.LINE_FEED);
      await this.write(this.CENTER + this.LINE_FEED + company.footerMessage + this.LINE_FEED);
    } else if (session) {
      // --- Z-RAPPORT (Dagafsluiting) ---
      await this.write(this.BOLD_ON + "Z-RAPPORT (AFSLUITING)" + this.BOLD_OFF + this.LINE_FEED);
      await this.write("Sessie ID: " + session.id.slice(-6) + this.LINE_FEED);
      await this.write("Datum: " + new Date().toLocaleString() + this.LINE_FEED + this.LINE_FEED);
      await this.write(this.LEFT);

      await this.write("OMZET DETAILS:" + this.LINE_FEED);
      await this.write(`Totaal:         €${session.summary.totalSales.toFixed(2).padStart(10)}` + this.LINE_FEED);
      await this.write(`Kaart:          €${session.summary.cardTotal.toFixed(2).padStart(10)}` + this.LINE_FEED);
      await this.write(`Cash (verwacht):€${session.summary.cashTotal.toFixed(2).padStart(10)}` + this.LINE_FEED);
      await this.write(`Cash (geteld):  €${(session.cashManagement.closingBalance || 0).toFixed(2).padStart(10)}` + this.LINE_FEED);
      await this.write(`Verschil:       €${(session.cashManagement.difference || 0).toFixed(2).padStart(10)}` + this.LINE_FEED);
      
      await this.write(this.LINE_FEED + "VERKOCHTE ARTIKELEN:" + this.LINE_FEED);
      // Bereken totalen per product voor deze sessie
      const sessionTxs = allTransactions.filter(t => t.sessionId === session.id);
      const productTotals: { [key: string]: { qty: number, total: number } } = {};
      
      sessionTxs.forEach(t => {
        t.items.forEach(i => {
          if (!productTotals[i.name]) productTotals[i.name] = { qty: 0, total: 0 };
          productTotals[i.name].qty += i.quantity;
          productTotals[i.name].total += (i.price * i.quantity);
        });
      });

      for (const name in productTotals) {
        const pLine = `${productTotals[name].qty.toString().padStart(3)}x ${name.padEnd(15)} €${productTotals[name].total.toFixed(2).padStart(8)}`;
        await this.write(pLine + this.LINE_FEED);
      }
    }

    await this.write(this.LINE_FEED + this.LINE_FEED + this.LINE_FEED + this.LINE_FEED); // Snijruimte
  }
}

export const btPrinterService = new BluetoothPrinterService();
