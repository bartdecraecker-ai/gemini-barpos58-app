
import { CompanyDetails, Product } from "./types";

export const DEFAULT_COMPANY: CompanyDetails = {
  name: "DE GEZELLIGE BAR",
  address: "Grote Markt 1",
  address2: "1000 Brussel",
  vatNumber: "BTW BE0123.456.789",
  website: "www.degezelligebar.be",
  sellerName: "Jan",
  salesmen: ["Jan", "Piet"],
  footerMessage: "Bedankt en tot ziens!",
};

export const AVAILABLE_COLORS = [
  'bg-amber-200', 'bg-red-200', 'bg-purple-200', 'bg-blue-100', 
  'bg-cyan-100', 'bg-stone-200', 'bg-emerald-100', 'bg-orange-200',
  'bg-green-200', 'bg-gray-200', 'bg-yellow-100', 'bg-pink-100'
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Pintje', price: 3.20, vatRate: 21, color: 'bg-amber-200', stock: 100 },
  { id: '2', name: 'Huiswijn', price: 5.50, vatRate: 21, color: 'bg-red-200', stock: 50 },
  { id: '3', name: 'Cocktail', price: 11.00, vatRate: 21, color: 'bg-purple-200', stock: 30 },
  { id: '4', name: 'Frisdrank', price: 3.00, vatRate: 21, color: 'bg-blue-100', stock: 60 },
  { id: '5', name: 'Water', price: 2.80, vatRate: 21, color: 'bg-cyan-100', stock: 60 },
  { id: '6', name: 'Koffie', price: 3.00, vatRate: 21, color: 'bg-stone-200', stock: 100 },
  { id: '7', name: 'Thee', price: 3.00, vatRate: 21, color: 'bg-emerald-100', stock: 100 },
  { id: '8', name: 'Chips', price: 2.50, vatRate: 21, color: 'bg-orange-200', stock: 40 },
  { id: '9', name: 'Cadeaubon', price: 20.00, vatRate: 0, color: 'bg-green-200', stock: 999 },
  { id: '10', name: 'Waarborg', price: 1.00, vatRate: 0, color: 'bg-gray-200', stock: 999 },
];
