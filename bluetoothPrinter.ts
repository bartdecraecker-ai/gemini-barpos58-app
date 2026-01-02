
import { Transaction, CompanyDetails, SalesSession } from "../types.ts";

export class BluetoothPrinterService {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;

  private readonly encoder = new TextEncoder();
  private readonly COMMANDS = {
    RESET: new Uint8Array([0x1b, 0x40]),
    ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
    ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
    ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),
    BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
    BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
    FEED_CUT: new Uint8Array([0x1d, 0x56, 0x00]),
    DRAWER_KICK: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  };

  isSupported(): boolean {
    return !!(navigator as any).bluetooth;
  }

  isConnected(): boolean {
    return !!this.characteristic;
  }

  getDeviceName(): string {
    return this.device?.name || "Geen printer";
  }

  async connect(): Promise<boolean> {
    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'InnerPrinter' },
          { namePrefix: 'MTP' },
          { namePrefix: 'RPP' },
          { namePrefix: 'BlueP' },
          { namePrefix: 'Thermal' }
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service.getCharacteristics();
      
      this.characteristic = characteristics.find((c: any) => 
        c.properties.write || c.properties.writeWithoutResponse
      );
      
      if (!this.characteristic) throw new Error("No write characteristic found");
      return true;
    } catch (error) {
      console.error("BT connection error:", error);
      return false;
    }
  }

  async disconnect() {
    if (this.server) await this.server.disconnect();
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }

  private async write(data: Uint8Array) {
    if (!this.characteristic) return;
    await this.characteristic.writeValue(data);
  }

  private prepareText(text: string): string {
    return text.replace(/€/g, "EUR");
  }

  private async printLine(text: string = "", align: "LEFT" | "CENTER" | "RIGHT" = "LEFT", bold: boolean = false) {
    const safeText = this.prepareText(text);
    await this.write(this.COMMANDS.RESET);
    if (align === "CENTER") await this.write(this.COMMANDS.ALIGN_CENTER);
    if (align === "RIGHT") await this.write(this.COMMANDS.ALIGN_RIGHT);
    if (bold) await this.write(this.COMMANDS.BOLD_ON);
    await this.write(this.encoder.encode(safeText + "\n"));
    if (bold) await this.write(this.COMMANDS.BOLD_OFF);
  }

  async testPrint() {
    await this.printLine("PRINTER TEST", "CENTER", true);
    await this.printLine("BarPOS System OK", "CENTER");
    await this.write(new Uint8Array([0x0a, 0x0a, 0x0a])); 
  }

  async printReceipt(t: Transaction, c: CompanyDetails) {
    await this.printLine(c.name, "CENTER", true);
    if (c.address) await this.printLine(c.address, "CENTER");
    if (c.website) await this.printLine(c.website, "CENTER");
    await this.printLine(new Date(t.timestamp).toLocaleString('nl-NL'), "CENTER");
    await this.printLine("--------------------------------", "CENTER");
    
    for (const item of t.items) {
      const line = `${item.quantity}x ${item.name.substring(0, 16)}`.padEnd(20) + (item.price * item.quantity).toFixed(2).padStart(12);
      await this.printLine(line);
    }
    
    await this.printLine("--------------------------------", "CENTER");
    await this.printLine(`TOTAAL: EUR ${t.total.toFixed(2)}`, "RIGHT", true);
    await this.printLine(`BETAALWIJZE: ${t.paymentMethod}`, "LEFT");
    await this.printLine("--------------------------------", "CENTER");
    await this.printLine(c.footerMessage || "Bedankt!", "CENTER");
    await this.write(new Uint8Array([0x0a, 0x0a, 0x0a]));
  }

  async printSessionReport(s: SalesSession, txs: Transaction[], c: CompanyDetails) {
    await this.printLine("SHIFT RAPPORT", "CENTER", true);
    await this.printLine(c.name, "CENTER");
    await this.printLine("--------------------------------", "CENTER");
    await this.printLine(`Shift ID: ${s.id.slice(-8)}`);
    await this.printLine(`Datum: ${new Date(s.startTime).toLocaleDateString('nl-NL')}`);
    await this.printLine("--------------------------------", "CENTER");
    
    if (s.summary) {
      if (s.summary.productSales) {
        await this.printLine("PRODUCTEN:", "LEFT", true);
        for (const [name, qty] of Object.entries(s.summary.productSales)) {
          const pLine = `${name.substring(0, 22)}`.padEnd(25) + `x${qty}`.padStart(7);
          await this.printLine(pLine);
        }
        await this.printLine("--------------------------------", "CENTER");
      }

      await this.printLine(`Tickets:   ${s.summary.transactionCount}`);
      await this.printLine(`OMZET:     EUR ${s.summary.totalSales.toFixed(2)}`, "LEFT", true);
      await this.printLine(`CONTANT:   EUR ${s.summary.cashTotal.toFixed(2)}`);
      await this.printLine(`KAART:     EUR ${s.summary.cardTotal.toFixed(2)}`);
      await this.printLine("--------------------------------", "CENTER");
      await this.printLine(`Begin Kas: EUR ${s.startCash.toFixed(2)}`);
      if (s.endCash !== undefined) {
        await this.printLine(`Geteld:    EUR ${s.endCash.toFixed(2)}`);
        const diff = s.endCash - (s.expectedCash || 0);
        await this.printLine(`Verschil:  EUR ${diff.toFixed(2)}`, "LEFT", true);
      }
    }
    await this.write(new Uint8Array([0x0a, 0x0a, 0x0a]));
  }
}

export const btPrinterService = new BluetoothPrinterService();
