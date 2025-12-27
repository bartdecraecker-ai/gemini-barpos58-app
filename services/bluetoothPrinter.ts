
import { Transaction, CompanyDetails } from "../types";

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

const MAX_RETRIES = 3;
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 50;

export class BluetoothPrinterService {
  private device: any | null = null;
  private characteristic: any | null = null;
  private isBusy = false;

  isSupported(): boolean {
    const supported = !!(navigator && (navigator as any).bluetooth);
    console.log('Bluetooth: Support check:', supported);
    return supported;
  }

  async connect(): Promise<boolean> {
    try {
      console.log('Bluetooth: Starting connection process...');
      
      if (!this.isSupported()) {
        throw new Error("Web Bluetooth wordt niet ondersteund door deze browser. Gebruik Chrome, Edge of Opera op een ondersteund apparaat.");
      }

      console.log('Bluetooth: Requesting device...');
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: OPTIONAL_SERVICES
      });

      if (!this.device) {
        console.log('Bluetooth: No device selected by user.');
        return false;
      }

      console.log('Bluetooth: Device selected:', this.device.name);
      return await this.establishConnection();
    } catch (error: any) {
      console.error('Bluetooth Connect Error:', error);
      this.cleanup();
      
      if (error.name === 'SecurityError') {
        throw new Error("Toegang tot Bluetooth is geblokkeerd door de browserinstellingen of dit venster heeft geen toestemming.");
      } else if (error.name === 'NotFoundError') {
        return false;
      }
      
      throw error;
    }
  }

  private async establishConnection(): Promise<boolean> {
    if (!this.device || !this.device.gatt) return false;

    console.log(`Bluetooth: Connecting to GATT server on ${this.device.name}...`);
    const server = await this.device.gatt.connect();
    console.log('Bluetooth: GATT server connected.');

    console.log('Bluetooth: Discovering primary services...');
    const services = await server.getPrimaryServices();
    console.log(`Bluetooth: Found ${services.length} services.`);
    
    for (const service of services) {
      console.log(`Bluetooth: Inspecting service: ${service.uuid}`);
      try {
        const characteristics = await service.getCharacteristics();
        const found = characteristics.find((c: any) => 
          c.properties.write || c.properties.writeWithoutResponse
        );
        if (found) {
          console.log(`Bluetooth: Found writable characteristic: ${found.uuid} in service ${service.uuid}`);
          this.characteristic = found;
          break;
        }
      } catch (e) {
        console.warn(`Bluetooth: Could not access characteristics for service ${service.uuid}`, e);
      }
    }

    if (!this.characteristic) {
      throw new Error("Geen schrijfbaar kanaal gevonden op deze printer. Zorg dat de printer ESC/POS ondersteunt via Bluetooth.");
    }

    this.device.addEventListener('gattserverdisconnected', this.onDisconnected);
    console.log('Bluetooth: Connection fully established.');
    return true;
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.isConnected()) return true;
    if (this.device) {
      console.log('Bluetooth: Attempting auto-reconnect...');
      return await this.establishConnection();
    }
    return false;
  }

  disconnect() {
    console.log('Bluetooth: Manually disconnecting...');
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
    console.log('Bluetooth: Device disconnected.');
    this.characteristic = null;
  };

  isConnected(): boolean {
    return !!this.device && !!this.device.gatt?.connected && !!this.characteristic;
  }

  getDeviceName(): string {
    return this.device?.name || 'Onbekend Apparaat';
  }

  private async send(data: Uint8Array) {
    if (this.isBusy) throw new Error("Printer is bezig met een andere taak...");
    this.isBusy = true;

    try {
      if (!(await this.ensureConnected())) {
        throw new Error("Niet verbonden met de printer.");
      }

      console.log(`Bluetooth: Sending ${data.length} bytes in chunks of ${CHUNK_SIZE}...`);
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        let success = false;
        let attempts = 0;

        while (!success && attempts < MAX_RETRIES) {
          try {
            if (this.characteristic!.properties.writeWithoutResponse) {
              await this.characteristic!.writeValueWithoutResponse(chunk);
            } else {
              await this.characteristic!.writeValue(chunk);
            }
            success = true;
          } catch (e) {
            attempts++;
            console.warn(`Bluetooth: Chunk write failed (attempt ${attempts}/${MAX_RETRIES})`, e);
            if (attempts >= MAX_RETRIES) throw e;
            await new Promise(r => setTimeout(r, 100));
            await this.ensureConnected();
          }
        }
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }
      console.log('Bluetooth: Print data sent successfully.');
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
      company.sellerName ? `Verkoper: ${company.sellerName}\n` : '',
      '--------------------------------\n'
    ];

    transaction.items.forEach(item => {
      const priceStr = (item.price * item.quantity).toFixed(2).replace('.', ',');
      const nameStr = `${item.quantity}x ${item.name}`;
      const spaces = Math.max(1, 32 - nameStr.length - priceStr.length);
      cmds.push(`${nameStr}${' '.repeat(spaces)}${priceStr}\n`);
    });

    cmds.push('--------------------------------\n');
    
    // Total line formatting: TOTAAL: EUR 122,70
    const totalLabel = "TOTAAL:";
    const totalValue = `EUR ${transaction.total.toFixed(2).replace('.', ',')}`;
    const spacesNeeded = Math.max(1, 32 - totalLabel.length - totalValue.length);
    cmds.push(BOLD_ON, `${totalLabel}${' '.repeat(spacesNeeded)}${totalValue}`, BOLD_OFF, '\n');
    
    cmds.push(`Betaald via: ${transaction.paymentMethod === 'CASH' ? 'CONTANT' : 'KAART'}\n`);
    cmds.push('--------------------------------\n');
    
    if (transaction.vat21 > 0) {
      const basis21 = (transaction.subtotal - transaction.vat0).toFixed(2).replace('.', ',');
      cmds.push(`BTW 21% (basis ${basis21}): ${transaction.vat21.toFixed(2).replace('.', ',')}\n`);
    }

    cmds.push(CENTER, '\n', company.footerMessage, '\n\n\n', CUT);
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
