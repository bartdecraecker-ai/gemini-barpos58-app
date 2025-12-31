
import { CompanyDetails, Product } from "./types";

export const DEFAULT_COMPANY: CompanyDetails = {
  name: "De Gezellige Bar",
  address: "Grote Markt 1",
  address2: "1000 Brussel",
  vatNumber: "BTW BE0123.456.789",
  website: "www.degezelligebar.be",
  sellerName: "Bart",
  salesmen: ["Bart", "Tina"],
  footerMessage: "Bedankt en tot ziens!",
  masterPassword: "1984", // Default PIN
  updatedAt: Date.now(),
};

export const AVAILABLE_COLORS = [
  'bg-amber-100',  // Geel
  'bg-red-100',    // Rood
  'bg-purple-100', // Paars
  'bg-blue-100',   // Blauw
  'bg-emerald-100',// Groen
  'bg-stone-200'   // Grijs/Beige
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Pintje', price: 3.20, vatRate: 21, color: 'bg-amber-100', stock: 100, updatedAt: Date.now() },
  { id: '2', name: 'Huiswijn', price: 5.50, vatRate: 21, color: 'bg-red-100', stock: 50, updatedAt: Date.now() },
  { id: '4', name: 'Frisdrank', price: 3.00, vatRate: 21, color: 'bg-blue-100', stock: 60, updatedAt: Date.now() },
];
