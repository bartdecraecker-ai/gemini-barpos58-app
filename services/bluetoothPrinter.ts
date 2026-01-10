import { Transaction, CompanyDetails, SalesSession } from "../types.ts";

/**
 * Bluetooth ESC/POS printing via Web Bluetooth.
 * Tuned for reliability on Android + low-cost 58mm BLE printers (e.g., NETUM NT-1809DD):
 * - Build one buffer per job (receipt / session report)
 * - Send in small chunks with delay (throttling)
 * - RESET only once per job (not per line)
 */
export class BluetoothPrinterService {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;

  private readonly encoder = new TextEncoder();

  // ESC/POS commands
  private readonly COMMANDS = {
    RESET: new Uint8Array([0x1b, 0x40]), // ESC @
    ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]), // ESC a 1
    ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0
    ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]), // ESC a 2
    BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]), // ESC E 1
    BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]), // ESC E 0
    FEED_CUT: new Uint8Array([0x1d, 0x56, 0x00]), // GS V 0 (some printers ignore if no cutter)
    // Some drawers use ESC p m t1 t2
    DRAWER_KICK: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  };

  // Reliability tuning for Android BLE printers
  private readonly CHUNK_SIZE = 80; // smaller = more reliable
  private readonly CHUNK_DELAY_MS = 70; // larger = more reliable

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
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
          { namePrefix: "InnerPrinter" },
          { namePrefix: "MTP" },
          { namePrefix: "RPP" },
          { namePrefix: "BlueP" },
          { namePrefix: "Thermal" },
          { namePrefix: "NETUM" },
        ],
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
      const characteristics = await service.getCharacteristics();

      // Prefer characteristics that support writeWithoutResponse (often better for printers),
      // but accept write as fallback.
      this.characteristic =
        characteristics.find((c: any) => c.properties.writeWithoutResponse) ||
        characteristics.find((c: any) => c.properties.write);

      if (!this.characteristic) throw new Error("No write characteristic found");
      return true;
    } catch (error) {
      console.error("BT connection error:", error);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.server) await this.server.disconnect();
    } catch {
      // ignore
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }

  /** Replace characters that some printers can't render well */
  private prepareText(text: string): string {
    // Most cheap ESC/POS printers don't render € reliably; keep it ASCII.
    return text.replace(/€/g, "EUR");
  }

  private enc(text: string): Uint8Array {
    return this.encoder.encode(this.prepareText(text));
  }

  private concat(parts: Uint8Array[]): Uint8Array {
    const len = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }

  private lineBytes(text = "", align: "LEFT" | "CENTER" | "RIGHT" = "LEFT", bold = false): Uint8Array {
    const parts: Uint8Array[] = [];

    if (align === "CENTER") parts.push(this.COMMANDS.ALIGN_CENTER);
    else if (align === "RIGHT") parts.push(this.COMMANDS.ALIGN_RIGHT);
    else parts.push(this.COMMANDS.ALIGN_LEFT);

    if (bold) parts.push(this.COMMANDS.BOLD_ON);
    parts.push(this.enc(text + "\n"));
    if (bold) parts.push(this.COMMANDS.BOLD_OFF);

    return this.concat(parts);
  }

  /**
   * Chunked writing is critical for reliability on Android BLE stacks & low-cost printers.
   * We throttle writes to avoid dropped packets.
   */
  private async writeChunked(data: Uint8Array, chunkSize = this.CHUNK_SIZE, delayMs = this.CHUNK_DELAY_MS) {
    if (!this.characteristic) return;

    const anyChar = this.characteristic as any;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      // Prefer without response if supported (common for printers), else normal write.
      if (anyChar.writeValueWithoutResponse) {
        await anyChar.writeValueWithoutResponse(chunk);
      } else {
        await anyChar.writeValue(chunk);
      }

      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  /** Builds a full print job buffer (with reset + trailing feed/cut) and sends it reliably */
  private async printJob(lines: Uint8Array[], options?: { cut?: boolean; extraFeedLines?: number }) {
    const cut = options?.cut ?? false;
    const extraFeedLines = options?.extraFeedLines ?? 4;

    const bytes: Uint8Array[] = [];
    bytes.push(this.COMMANDS.RESET); // 1x per job
    bytes.push(...lines);

    // Extra feed helps some printers flush buffered data
    bytes.push(new Uint8Array(Array(extraFeedLines).fill(0x0a)));

    // Optional cut (ignored if printer has no cutter)
    if (cut) bytes.push(this.COMMANDS.FEED_CUT);

    await this.writeChunked(this.concat(bytes));
  }

  async testPrint() {
    const lines: Uint8Array[] = [];
    lines.push(this.lineBytes("PRINTER TEST", "CENTER", true));
    lines.push(this.lineBytes("BarPOS System OK", "CENTER"));
    lines.push(this.lineBytes("--------------------------------", "CENTER"));
    for (let i = 1; i <= 20; i++) {
      lines.push(this.lineBytes(`LINE ${String(i).padStart(2, "0")} - Lorem ipsum dolor sit amet`, "LEFT"));
    }
    await this.printJob(lines, { cut: false, extraFeedLines: 4 });
  }

  async printReceipt(t: Transaction, c: CompanyDetails) {
    const lines: Uint8Array[] = [];

    lines.push(this.lineBytes(c.name || "Bedrijf", "CENTER", true));
    if (c.address) lines.push(this.lineBytes(c.address, "CENTER"));
    if (c.website) lines.push(this.lineBytes(c.website, "CENTER"));
    lines.push(this.lineBytes(new Date(t.timestamp).toLocaleString("nl-NL"), "CENTER"));
    lines.push(this.lineBytes("--------------------------------", "CENTER"));

    // 58mm printers: keep width conservative
    // Left column ~20 chars, right column ~10 chars.
    for (const item of t.items) {
      const left = `${item.quantity}x ${String(item.name || "").substring(0, 16)}`.padEnd(20);
      const right = (item.price * item.quantity).toFixed(2).padStart(10);
      lines.push(this.lineBytes(left + right, "LEFT"));
    }

    lines.push(this.lineBytes("--------------------------------", "CENTER"));
    lines.push(this.lineBytes(`TOTAAL: EUR ${t.total.toFixed(2)}`, "RIGHT", true));
    lines.push(this.lineBytes(`BETAALWIJZE: ${t.paymentMethod}`, "LEFT"));
    lines.push(this.lineBytes("--------------------------------", "CENTER"));
    lines.push(this.lineBytes(c.footerMessage || "Bedankt!", "CENTER"));

    await this.printJob(lines, { cut: false, extraFeedLines: 5 });
  }

  async printSessionReport(s: SalesSession, txs: Transaction[], c: CompanyDetails) {
    const lines: Uint8Array[] = [];

    lines.push(this.lineBytes("SHIFT RAPPORT", "CENTER", true));
    lines.push(this.lineBytes(c.name || "Bedrijf", "CENTER"));
    lines.push(this.lineBytes("--------------------------------", "CENTER"));

    lines.push(this.lineBytes(`Shift ID: ${s.id?.slice(-8) || "-"}`, "LEFT"));
    lines.push(this.lineBytes(`Datum: ${new Date(s.startTime).toLocaleDateString("nl-NL")}`, "LEFT"));
    lines.push(this.lineBytes("--------------------------------", "CENTER"));

    if (s.summary?.productSales) {
      lines.push(this.lineBytes("PRODUCTEN:", "LEFT", true));
      for (const [name, qty] of Object.entries(s.summary.productSales)) {
        const left = String(name).substring(0, 22).padEnd(25);
        const right = (`x${qty}`).padStart(7);
        lines.push(this.lineBytes(left + right, "LEFT"));
      }
      lines.push(this.lineBytes("--------------------------------", "CENTER"));
    }

    if (s.summary) {
      lines.push(this.lineBytes(`Tickets:   ${s.summary.transactionCount}`, "LEFT"));
      lines.push(this.lineBytes(`OMZET:     EUR ${s.summary.totalSales.toFixed(2)}`, "LEFT", true));
      lines.push(this.lineBytes(`CONTANT:   EUR ${s.summary.cashTotal.toFixed(2)}`, "LEFT"));
      lines.push(this.lineBytes(`KAART:     EUR ${s.summary.cardTotal.toFixed(2)}`, "LEFT"));
      lines.push(this.lineBytes("--------------------------------", "CENTER"));
      lines.push(this.lineBytes(`Begin Kas: EUR ${s.startCash.toFixed(2)}`, "LEFT"));

      if (s.endCash !== undefined) {
        lines.push(this.lineBytes(`Geteld:    EUR ${s.endCash.toFixed(2)}`, "LEFT"));
        const diff = s.endCash - (s.expectedCash || 0);
        lines.push(this.lineBytes(`Verschil:  EUR ${diff.toFixed(2)}`, "LEFT", true));
      }
    } else {
      lines.push(this.lineBytes("Geen summary data.", "LEFT"));
    }

    // If you do have a cutter, set cut:true. If not, it will be ignored by most printers.
    await this.printJob(lines, { cut: false, extraFeedLines: 6 });
  }

  /** Optional: cash drawer kick (only if supported/connected via printer) */
  async openDrawer() {
    await this.writeChunked(this.concat([this.COMMANDS.RESET, this.COMMANDS.DRAWER_KICK, new Uint8Array([0x0a, 0x0a])]));
  }
}

export const btPrinterService = new BluetoothPrinterService();
