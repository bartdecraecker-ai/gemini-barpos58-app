
import { Transaction, CompanyDetails, SalesSession } from "../types";

// Standard ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const CUT = GS + 'V' + '\x41' + '\x00'; 
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const CENTER = ESC + 'a' + '\x01';
const LEFT = ESC + 'a' + '\x00';
const RIGHT = ESC + 'a' + '\x02';

const OPTIONAL_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common Thermal Printer Service
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
];

const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 50;

export class BluetoothPrinterService {
  private device: any | null = null;
  private characteristic: any | null = null;
  private isBusy = false;

  isSupported(): boolean {
    return !!(navigator && (navigator as any).bluetooth);
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        throw new Error("Web Bluetooth wordt niet ondersteund.");
      }
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: OPTIONAL_SERVICES
      });
      if (!this.device) return false;
      return await this.establishConnection();
    } catch (error: any) {
      this.cleanup();
      if (error.name === 'NotFoundError') return false;
      throw error;
    }
  }

  private async establishConnection(): Promise<boolean> {
    if (!this.device || !this.device.gatt) return false;
    const server = await this.device.gatt.connect();
    const services = await server.getPrimaryServices();
    
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        const found = characteristics.find((c: any) => 
          c.properties.write || c.properties.writeWithoutResponse
        );
        if (found) {
          this.characteristic = found;
          break;
        }
      } catch (e) {}
    }

    if (!this.characteristic) {
      throw new Error("Geen schrijfbaar kanaal gevonden.");
    }

    this.device.addEventListener('gattserverdisconnected', this.onDisconnected);
    return true;
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.isConnected()) return true;
    if (this.device) return await this.establishConnection();
    return false;
  }

  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanup();
  }

  private cleanup() {
    this.device = null;
    this.characteristic = null;
    this.isBusy = false;
  }

  private onDisconnected = () => {
    this.characteristic = null;
  };

  isConnected(): boolean {
    return !!this.device && !!this.device.gatt?.connected && !!this.characteristic;
  }

  getDeviceName(): string {
    return this.device?.name || 'Onbekend Apparaat';
  }

  private async send(data: Uint8Array) {
    if (this.isBusy) throw new Error("Printer is bezig...");
    this.isBusy = true;
    try {
      if (!(await this.ensureConnected())) throw new Error("Niet verbonden.");
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        if (this.characteristic!.properties.writeWithoutResponse) {
          await this.characteristic!.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic!.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }
    } finally {
      this.isBusy = false;
    }
  }

  private textEncoder = new TextEncoder();

  async printReceipt(transaction: Transaction, company: CompanyDetails) {
    const cmds: (string | Uint8Array)[] = [
      INIT, CENTER, BOLD_ON, company.name + '\n', BOLD_OFF,
      company.address + '\n', 
      company.address2 ? company.address2 + '\n' : '',
      `BTW: ${company.vatNumber}\n`,
      company.website ? company.website + '\n' : '',
      '--------------------------------\n', LEFT,
      `${transaction.dateStr} ${new Date(transaction.timestamp).toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit'})}\n`,
      `Ticket #: ${transaction.id}\n`,
      '--------------------------------\n'
    ];

    transaction.items.forEach(item => {
      const priceStr = (item.price * item.quantity).toFixed(2).replace('.', ',');
      const nameStr = `${item.quantity}x ${item.name}`;
      const spaces = Math.max(1, 32 - nameStr.length - priceStr.length);
      cmds.push(`${nameStr}${' '.repeat(spaces)}${priceStr}\n`);
    });

    cmds.push('--------------------------------\n');
    const totalLabel = "TOTAAL:";
    const totalValue = `EUR ${transaction.total.toFixed(2).replace('.', ',')}`;
    const spacesNeeded = Math.max(1, 32 - totalLabel.length - totalValue.length);
    cmds.push(BOLD_ON, `${totalLabel}${' '.repeat(spacesNeeded)}${totalValue}`, BOLD_OFF, '\n');
    cmds.push(`Betaald via: ${transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART'}\n`);
    cmds.push('--------------------------------\n');
    
    if (transaction.vat21 > 0) {
      const basis21 = (transaction.subtotal - transaction.vat0).toFixed(2).replace('.', ',');
      cmds.push(`BTW 21% (basis EUR ${basis21}): ${transaction.vat21.toFixed(2).replace('.', ',')}\n`);
    }

    cmds.push(CENTER, '\n', company.footerMessage, '\n\n\n', CUT);
    await this.send(this.combineCommands(cmds));
  }

  async printSessionReport(session: SalesSession, transactions: Transaction[], company: CompanyDetails) {
    const sortedTx = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const productBreakdown: Record<string, number> = {};
    let totalItems = 0;
    sortedTx.forEach(tx => {
      tx.items.forEach(item => {
        productBreakdown[item.name] = (productBreakdown[item.name] || 0) + item.quantity;
        totalItems += item.quantity;
      });
    });

    const summary = session.summary;
    const firstId = sortedTx.length > 0 ? sortedTx[0].id : (summary?.firstTicketId || 'N/A');
    const lastId = sortedTx.length > 0 ? sortedTx[sortedTx.length - 1].id : (summary?.lastTicketId || 'N/A');

    const cmds: (string | Uint8Array)[] = [
      INIT, CENTER, BOLD_ON, "SESSIE RAPPORT\n", BOLD_OFF,
      company.name + '\n',
      '--------------------------------\n', LEFT,
      `Sessie ID: ${session.id}\n`,
      `Tickets: ${firstId} -> ${lastId}\n`,
      `Start: ${new Date(session.startTime).toLocaleString('nl-NL')}\n`,
      session.endTime ? `Einde: ${new Date(session.endTime).toLocaleString('nl-NL')}\n` : 'Sessie nog actief\n',
      '--------------------------------\n',
      BOLD_ON, "FINANCIEEL:\n", BOLD_OFF,
      `Omzet: ${' '.repeat(Math.max(1, 20 - (session.summary?.totalSales || 0).toFixed(2).length))}EUR ${(session.summary?.totalSales || 0).toFixed(2).replace('.', ',')}\n`,
      `Kaart: ${' '.repeat(Math.max(1, 20 - (session.summary?.cardTotal || 0).toFixed(2).length))}EUR ${(session.summary?.cardTotal || 0).toFixed(2).replace('.', ',')}\n`,
      `Cash:  ${' '.repeat(Math.max(1, 20 - (session.summary?.cashTotal || 0).toFixed(2).length))}EUR ${(session.summary?.cashTotal || 0).toFixed(2).replace('.', ',')}\n`,
      '--------------------------------\n',
      BOLD_ON, "BTW OVERZICHT:\n", BOLD_OFF,
      `BTW 0% Basis:  ${' '.repeat(Math.max(1, 15 - (session.summary?.vat0Total || 0).toFixed(2).length))}EUR ${(session.summary?.vat0Total || 0).toFixed(2).replace('.', ',')}\n`,
      `BTW 21% Basis: ${' '.repeat(Math.max(1, 15 - ((session.summary?.totalSales || 0) - (session.summary?.vat21Total || 0) - (session.summary?.vat0Total || 0)).toFixed(2).length))}EUR ${((session.summary?.totalSales || 0) - (session.summary?.vat21Total || 0) - (session.summary?.vat0Total || 0)).toFixed(2).replace('.', ',')}\n`,
      `BTW 21% Totaal: ${' '.repeat(Math.max(1, 14 - (session.summary?.vat21Total || 0).toFixed(2).length))}EUR ${(session.summary?.vat21Total || 0).toFixed(2).replace('.', ',')}\n`,
      '--------------------------------\n',
      BOLD_ON, "PRODUCT VERKOOP:\n", BOLD_OFF
    ];

    Object.entries(productBreakdown).forEach(([name, qty]) => {
      const qtyStr = `${qty}x`;
      const spaces = Math.max(1, 32 - name.length - qtyStr.length);
      cmds.push(`${name}${' '.repeat(spaces)}${qtyStr}\n`);
    });

    cmds.push('--------------------------------\n');
    cmds.push(`TOTAAL ARTIKELEN:${' '.repeat(Math.max(1, 15 - totalItems.toString().length))}${totalItems}\n`);
    cmds.push('\n', CENTER, "*** EINDE RAPPORT ***\n\n\n", CUT);
    await this.send(this.combineCommands(cmds));
  }

  async testPrint() {
    const cmds = [
      INIT, CENTER, BOLD_ON, "BAR POS TEST\n", BOLD_OFF,
      "Status: Verbonden\n", new Date().toLocaleString('nl-NL') + "\n\n",
      "Ready to serve!\n\n\n", CUT
    ];
    await this.send(this.combineCommands(cmds));
  }

  async openDrawer() {
    const pulse = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    await this.send(pulse);
  }

  private combineCommands(cmds: (string | Uint8Array)[]): Uint8Array {
    const buffers = cmds.map(c => typeof c === 'string' ? this.textEncoder.encode(c) : c);
    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const res = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of buffers) {
      res.set(b, offset);
      offset += b.length;
    }
    return res;
  }
}

export const btPrinterService = new BluetoothPrinterService();
