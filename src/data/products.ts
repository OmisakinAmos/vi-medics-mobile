import type { CategoryInfo, Product } from '../types';

/** Mock catalogue used in Phase 1 and as a fallback when Supabase is not configured. */
export const mockProducts: Product[] = [
  { id: 'vm-001', name: 'Digital Blood Pressure Monitor', category: 'Monitoring', description: 'Automatic upper-arm blood pressure monitor with a clear digital display.', price: 45000, stockQuantity: 12, brand: 'Vi-Medics', model: 'VM-BP-001', warranty: '12 months', visual: 'bp' },
  { id: 'vm-002', name: 'Fingertip Pulse Oximeter', category: 'Monitoring', description: 'Compact fingertip pulse oximeter designed for convenient spot checks.', price: 18000, stockQuantity: 24, brand: 'Vi-Medics', model: 'VM-PO-002', warranty: '12 months', visual: 'oximeter' },
  { id: 'vm-003', name: 'Professional Stethoscope', category: 'Diagnostic', description: 'A lightweight acoustic stethoscope for routine clinical examination.', price: 32000, stockQuantity: 3, brand: 'Vi-Medics', model: 'VM-ST-003', warranty: '12 months', visual: 'stethoscope' },
  { id: 'vm-004', name: 'Portable Nebulizer', category: 'Respiratory', description: 'Compact nebulizer designed for convenient respiratory care routines.', price: 55000, stockQuantity: 8, brand: 'Vi-Medics', model: 'VM-NB-004', warranty: '12 months', visual: 'nebulizer' },
  { id: 'vm-005', name: 'Digital Medical Thermometer', category: 'Monitoring', description: 'Fast-reading digital thermometer with an easy-to-read display.', price: 8500, stockQuantity: 31, brand: 'Vi-Medics', model: 'VM-TM-005', warranty: '6 months', visual: 'thermometer' },
  { id: 'vm-006', name: 'Folding Mobility Walker', category: 'Mobility', description: 'Lightweight folding walking aid designed for everyday mobility support.', price: 68000, stockQuantity: 6, brand: 'Vi-Medics', model: 'VM-MW-006', warranty: '12 months', visual: 'walker' },
  { id: 'vm-007', name: 'Manual Wheelchair', category: 'Mobility', description: 'Foldable manual wheelchair with comfortable seating and footrests.', price: 185000, stockQuantity: 4, brand: 'Vi-Medics', model: 'VM-WC-007', warranty: '18 months', visual: 'wheelchair' },
  { id: 'vm-008', name: 'Blood Glucose Meter Kit', category: 'Diagnostic', description: 'Portable blood glucose meter kit for routine blood glucose monitoring.', price: 29500, stockQuantity: 10, brand: 'Vi-Medics', model: 'VM-GM-008', warranty: '12 months', visual: 'glucose' },
];

export const categories: CategoryInfo[] = [
  { name: 'Monitoring', icon: '◉', description: 'Everyday monitoring devices' },
  { name: 'Diagnostic', icon: '⌁', description: 'Clinical examination tools' },
  { name: 'Mobility', icon: '＋', description: 'Mobility support equipment' },
  { name: 'Respiratory', icon: '◌', description: 'Respiratory care equipment' },
];
