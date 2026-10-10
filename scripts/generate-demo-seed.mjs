// Genera supabase/seed/demo_data.sql: catálogo de prueba + parámetros de demanda.
// Las ventas y el stock se generan dentro de Postgres (generate_series) para no producir un archivo gigante.
// Uso: node scripts/generate-demo-seed.mjs

import { writeFileSync, mkdirSync } from 'node:fs'

// PRNG determinístico para que el catálogo sea siempre el mismo
let seed = 20261010
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const between = (min, max) => min + rand() * (max - min)

const suppliers = [
  ['Cementos del Maipo', 'nacional', 3],
  ['Aceros Andinos', 'nacional', 5],
  ['Maderas del Biobío', 'nacional', 4],
  ['Techumbres Pacífico', 'nacional', 4],
  ['Áridos Río Claro', 'nacional', 3],
  ['Tabiquería Nacional', 'nacional', 4],
  ['Hidrotec Chile', 'nacional', 3],
  ['Pinturas Cordillera', 'nacional', 3],
  ['ElectroSur Distribución', 'nacional', 4],
  ['Aislantes del Sur', 'nacional', 5],
  ['Importadora Asia Pacífico', 'importado', 55],
  ['Global Tools Import', 'importado', 45],
  ['Cerámicas Ibéricas Import', 'importado', 60],
]

// [categoría, prefijo SKU, nombre base, variantes, unidad, costo base, paso de costo por variante,
//  proveedor, zona, resiste intemperie, m² por unidad, venta diaria base, % empresas, amplitud estacional, mes peak]
const items = [
  ['Cemento y morteros', 'CEM', 'Cemento especial', ['saco 25 kg'], 'saco', 4300, 1, 'Cementos del Maipo', 'bodega', false, 0.02, 70, 0.45, 0.25, 1],
  ['Cemento y morteros', 'CEM', 'Cemento alta resistencia', ['saco 25 kg'], 'saco', 5200, 1, 'Cementos del Maipo', 'bodega', false, 0.02, 14, 0.6, 0.25, 1],
  ['Cemento y morteros', 'CEM', 'Mortero de pega', ['saco 25 kg', 'saco 40 kg'], 'saco', 3100, 1.4, 'Cementos del Maipo', 'bodega', false, 0.02, 22, 0.4, 0.25, 1],
  ['Cemento y morteros', 'CEM', 'Mortero estuco', ['saco 25 kg', 'saco 40 kg'], 'saco', 3300, 1.4, 'Cementos del Maipo', 'bodega', false, 0.02, 15, 0.4, 0.25, 1],
  ['Cemento y morteros', 'CEM', 'Hormigón predosificado', ['saco 25 kg', 'saco 45 kg'], 'saco', 3600, 1.6, 'Cementos del Maipo', 'bodega', false, 0.022, 18, 0.35, 0.25, 1],
  ['Cemento y morteros', 'CEM', 'Adhesivo cerámico', ['interior 25 kg', 'exterior 25 kg', 'porcelanato 25 kg'], 'saco', 4200, 1.25, 'Cementos del Maipo', 'bodega', false, 0.02, 10, 0.2, 0.2, 12],
  ['Cemento y morteros', 'CEM', 'Yeso', ['saco 20 kg', 'saco 25 kg'], 'saco', 3200, 1.15, 'Cementos del Maipo', 'bodega', false, 0.02, 8, 0.25, 0.15, 12],
  ['Cemento y morteros', 'CEM', 'Cal hidratada', ['saco 25 kg'], 'saco', 3900, 1, 'Cementos del Maipo', 'bodega', false, 0.02, 4, 0.2, 0.2, 1],
  ['Cemento y morteros', 'CEM', 'Fragüe', ['blanco 1 kg', 'gris 1 kg', 'beige 1 kg', 'negro 1 kg'], 'bolsa', 1300, 1, 'Cementos del Maipo', 'bodega', false, 0.001, 9, 0.05, 0.2, 12],

  ['Fierro y acero', 'ACE', 'Fierro estriado A630-420H 12 m', ['6 mm', '8 mm', '10 mm', '12 mm', '16 mm', '18 mm', '22 mm'], 'barra', 3900, 1.45, 'Aceros Andinos', 'patio', true, 0.025, 30, 0.6, 0.2, 1],
  ['Fierro y acero', 'ACE', 'Malla electrosoldada ACMA', ['C-92 2,6x5 m', 'C-139 2,6x5 m', 'C-188 2,6x5 m', 'C-257 2,6x5 m'], 'unidad', 24000, 1.35, 'Aceros Andinos', 'patio', true, 0.15, 4, 0.65, 0.2, 1],
  ['Fierro y acero', 'ACE', 'Perfil metalcon montante', ['60x38x0,85 mm 3 m', '90x38x0,85 mm 3 m', '60x38x0,85 mm 6 m', '90x38x0,85 mm 6 m'], 'unidad', 3800, 1.3, 'Aceros Andinos', 'patio', true, 0.02, 16, 0.5, 0.15, 1],
  ['Fierro y acero', 'ACE', 'Perfil metalcon canal', ['61x20x0,5 mm 3 m', '92x30x0,85 mm 3 m', '92x30x0,85 mm 6 m'], 'unidad', 3000, 1.35, 'Aceros Andinos', 'patio', true, 0.02, 10, 0.5, 0.15, 1],
  ['Fierro y acero', 'ACE', 'Perfil tubular cuadrado 6 m', ['20x20x2 mm', '30x30x2 mm', '40x40x2 mm', '50x50x3 mm'], 'unidad', 9800, 1.45, 'Aceros Andinos', 'patio', true, 0.03, 5, 0.4, 0.15, 1],
  ['Fierro y acero', 'ACE', 'Perfil ángulo 6 m', ['20x20x2 mm', '30x30x3 mm', '40x40x3 mm', '50x50x4 mm'], 'unidad', 7200, 1.4, 'Aceros Andinos', 'patio', true, 0.03, 4, 0.4, 0.15, 1],
  ['Fierro y acero', 'ACE', 'Alambre negro recocido', ['rollo 1 kg', 'rollo 25 kg'], 'rollo', 2100, 18, 'Aceros Andinos', 'bodega', false, 0.003, 12, 0.45, 0.2, 1],

  ['Maderas y tableros', 'MAD', 'Pino dimensionado bruto 3,2 m', ['1x4"', '2x2"', '2x3"', '2x4"', '2x6"', '2x8"'], 'unidad', 1500, 1.35, 'Maderas del Biobío', 'bodega', false, 0.012, 35, 0.4, 0.2, 1],
  ['Maderas y tableros', 'MAD', 'Pino cepillado seco 3,2 m', ['1x2"', '1x4"', '2x2"', '2x3"', '2x4"'], 'unidad', 1900, 1.35, 'Maderas del Biobío', 'bodega', false, 0.01, 14, 0.3, 0.2, 1],
  ['Maderas y tableros', 'MAD', 'Pino impregnado 3,2 m', ['2x2"', '2x3"', '2x4"', '3x3" polín', '4x4"'], 'unidad', 2400, 1.35, 'Maderas del Biobío', 'patio', true, 0.012, 12, 0.35, 0.3, 12],
  ['Maderas y tableros', 'MAD', 'Terciado estructural 1,22x2,44 m', ['9 mm', '12 mm', '15 mm', '18 mm'], 'plancha', 14500, 1.25, 'Maderas del Biobío', 'bodega', false, 0.05, 8, 0.45, 0.15, 1],
  ['Maderas y tableros', 'MAD', 'OSB 1,22x2,44 m', ['9,5 mm', '11,1 mm', '15,1 mm'], 'plancha', 10500, 1.25, 'Maderas del Biobío', 'bodega', false, 0.05, 12, 0.45, 0.15, 1],
  ['Maderas y tableros', 'MAD', 'MDF crudo 1,52x2,44 m', ['3 mm', '9 mm', '15 mm', '18 mm'], 'plancha', 7800, 1.45, 'Maderas del Biobío', 'bodega', false, 0.06, 4, 0.15, 0.1, 12],

  ['Techumbre', 'TEC', 'Plancha zinc acanalada 0,35 mm', ['2,0 m', '2,5 m', '3,0 m', '3,66 m'], 'plancha', 8600, 1.2, 'Techumbres Pacífico', 'patio', true, 0.015, 14, 0.35, 0.35, 4],
  ['Techumbre', 'TEC', 'Plancha zinc 5V 0,35 mm', ['2,0 m', '2,5 m', '3,0 m', '3,66 m'], 'plancha', 9200, 1.2, 'Techumbres Pacífico', 'patio', true, 0.015, 8, 0.35, 0.35, 4],
  ['Techumbre', 'TEC', 'Cumbrera zinc 2 m', ['lisa', 'acanalada'], 'unidad', 4300, 1.1, 'Techumbres Pacífico', 'patio', true, 0.006, 5, 0.3, 0.35, 4],
  ['Techumbre', 'TEC', 'Fieltro asfáltico 15 lb', ['rollo 40 m²'], 'rollo', 15500, 1, 'Techumbres Pacífico', 'bodega', false, 0.03, 4, 0.35, 0.45, 4],
  ['Techumbre', 'TEC', 'Teja asfáltica', ['roja caja 3 m²', 'negra caja 3 m²', 'café caja 3 m²'], 'caja', 21000, 1, 'Techumbres Pacífico', 'bodega', false, 0.04, 2, 0.25, 0.35, 3],
  ['Techumbre', 'TEC', 'Policarbonato alveolar 2,1x5,8 m', ['6 mm', '8 mm', '10 mm'], 'plancha', 38000, 1.3, 'Importadora Asia Pacífico', 'bodega', false, 0.12, 1.2, 0.15, 0.3, 11],
  ['Techumbre', 'TEC', 'Canaleta PVC 3 m', ['blanca', 'gris'], 'unidad', 5400, 1, 'Hidrotec Chile', 'bodega', false, 0.01, 5, 0.2, 0.5, 5],

  ['Tabiquería', 'TAB', 'Plancha yeso-cartón ST 1,2x2,4 m', ['8 mm', '10 mm', '12,5 mm', '15 mm'], 'plancha', 5200, 1.2, 'Tabiquería Nacional', 'bodega', false, 0.05, 20, 0.5, 0.15, 1],
  ['Tabiquería', 'TAB', 'Plancha yeso-cartón RH 1,2x2,4 m', ['12,5 mm', '15 mm'], 'plancha', 8600, 1.15, 'Tabiquería Nacional', 'bodega', false, 0.05, 7, 0.5, 0.15, 1],
  ['Tabiquería', 'TAB', 'Plancha yeso-cartón RF 1,2x2,4 m', ['12,5 mm', '15 mm'], 'plancha', 9100, 1.15, 'Tabiquería Nacional', 'bodega', false, 0.05, 4, 0.6, 0.15, 1],
  ['Tabiquería', 'TAB', 'Plancha fibrocemento 1,2x2,4 m', ['4 mm', '6 mm', '8 mm', '10 mm'], 'plancha', 7400, 1.3, 'Tabiquería Nacional', 'bodega', false, 0.05, 10, 0.45, 0.2, 1],
  ['Tabiquería', 'TAB', 'Pasta muro', ['galón', 'tineta 25 kg'], 'unidad', 7200, 3.4, 'Tabiquería Nacional', 'bodega', false, 0.01, 6, 0.3, 0.15, 12],
  ['Tabiquería', 'TAB', 'Huincha juntura', ['papel 75 m', 'malla 90 m'], 'rollo', 2300, 1.3, 'Tabiquería Nacional', 'bodega', false, 0.001, 6, 0.3, 0.15, 12],

  ['Áridos y albañilería', 'ARI', 'Arena gruesa', ['saco 25 kg', 'm³ a granel'], 'unidad', 1500, 14, 'Áridos Río Claro', 'patio', true, 0.02, 30, 0.4, 0.25, 1],
  ['Áridos y albañilería', 'ARI', 'Arena fina', ['saco 25 kg', 'm³ a granel'], 'unidad', 1600, 14, 'Áridos Río Claro', 'patio', true, 0.02, 12, 0.3, 0.25, 1],
  ['Áridos y albañilería', 'ARI', 'Ripio', ['saco 25 kg', 'm³ a granel'], 'unidad', 1500, 14, 'Áridos Río Claro', 'patio', true, 0.02, 20, 0.45, 0.25, 1],
  ['Áridos y albañilería', 'ARI', 'Gravilla', ['saco 25 kg', 'm³ a granel'], 'unidad', 1700, 14, 'Áridos Río Claro', 'patio', true, 0.02, 9, 0.35, 0.25, 1],
  ['Áridos y albañilería', 'ARI', 'Ladrillo', ['fiscal', 'princesa', 'titán reforzado'], 'unidad', 260, 1.8, 'Áridos Río Claro', 'patio', true, 0.0015, 300, 0.55, 0.2, 1],
  ['Áridos y albañilería', 'ARI', 'Bloque de hormigón', ['14x19x39 cm', '19x19x39 cm'], 'unidad', 690, 1.3, 'Áridos Río Claro', 'patio', true, 0.004, 90, 0.55, 0.2, 1],
  ['Áridos y albañilería', 'ARI', 'Adoquín', ['gris 20x10 cm', 'rojo 20x10 cm'], 'unidad', 350, 1.1, 'Áridos Río Claro', 'patio', true, 0.002, 70, 0.35, 0.35, 12],

  ['Gasfitería', 'GAS', 'Tubo PVC sanitario 6 m', ['40 mm', '50 mm', '75 mm', '110 mm'], 'tubo', 3600, 1.5, 'Hidrotec Chile', 'bodega', false, 0.03, 7, 0.4, 0.1, 1],
  ['Gasfitería', 'GAS', 'Tubo PVC presión 6 m', ['20 mm', '25 mm', '32 mm', '40 mm'], 'tubo', 2600, 1.35, 'Hidrotec Chile', 'bodega', false, 0.025, 6, 0.35, 0.1, 1],
  ['Gasfitería', 'GAS', 'Codo PVC sanitario 90°', ['40 mm', '50 mm', '75 mm', '110 mm'], 'unidad', 420, 1.6, 'Hidrotec Chile', 'bodega', false, 0.0005, 18, 0.3, 0.1, 1],
  ['Gasfitería', 'GAS', 'Tee PVC sanitaria', ['40 mm', '50 mm', '110 mm'], 'unidad', 650, 1.7, 'Hidrotec Chile', 'bodega', false, 0.0005, 9, 0.3, 0.1, 1],
  ['Gasfitería', 'GAS', 'Tubo cobre tipo L 6 m', ['1/2"', '3/4"'], 'tubo', 26000, 1.6, 'Hidrotec Chile', 'bodega', false, 0.02, 2, 0.45, 0.1, 1],
  ['Gasfitería', 'GAS', 'Llave de paso bronce', ['1/2"', '3/4"'], 'unidad', 5200, 1.4, 'Hidrotec Chile', 'bodega', false, 0.0005, 4, 0.2, 0.1, 1],
  ['Gasfitería', 'GAS', 'Adhesivo PVC', ['240 cc', '500 cc'], 'tarro', 3300, 1.7, 'Hidrotec Chile', 'bodega', false, 0.0005, 6, 0.25, 0.1, 1],
  ['Gasfitería', 'GAS', 'Cinta teflón', ['12 mm x 10 m', '19 mm x 15 m'], 'rollo', 290, 1.8, 'Importadora Asia Pacífico', 'bodega', false, 0.0001, 15, 0.1, 0.1, 1],

  ['Pinturas', 'PIN', 'Látex interior', ['blanco galón', 'blanco tineta', 'marfil galón', 'gris perla galón'], 'unidad', 8900, 1.25, 'Pinturas Cordillera', 'bodega', false, 0.01, 10, 0.2, 0.4, 12],
  ['Pinturas', 'PIN', 'Látex exterior', ['blanco galón', 'blanco tineta', 'gris galón'], 'unidad', 11500, 1.4, 'Pinturas Cordillera', 'bodega', false, 0.01, 6, 0.2, 0.45, 12],
  ['Pinturas', 'PIN', 'Esmalte al agua', ['blanco galón', 'negro galón', 'gris galón', 'verde galón'], 'galón', 13800, 1, 'Pinturas Cordillera', 'bodega', false, 0.01, 4, 0.15, 0.4, 12],
  ['Pinturas', 'PIN', 'Anticorrosivo', ['rojo galón', 'gris galón', 'negro galón'], 'galón', 12900, 1, 'Pinturas Cordillera', 'bodega', false, 0.01, 3, 0.3, 0.3, 12],
  ['Pinturas', 'PIN', 'Impermeabilizante techos', ['galón', 'tineta'], 'unidad', 14500, 3.6, 'Pinturas Cordillera', 'bodega', false, 0.01, 4, 0.2, 0.65, 5],
  ['Pinturas', 'PIN', 'Diluyente sintético', ['1 litro', 'galón'], 'unidad', 2300, 2.8, 'Pinturas Cordillera', 'bodega', false, 0.003, 6, 0.15, 0.35, 12],
  ['Pinturas', 'PIN', 'Brocha', ['1"', '2"', '3"', '4"'], 'unidad', 750, 1.4, 'Importadora Asia Pacífico', 'bodega', false, 0.0003, 8, 0.1, 0.35, 12],
  ['Pinturas', 'PIN', 'Rodillo antigota', ['18 cm', '23 cm'], 'unidad', 2100, 1.3, 'Importadora Asia Pacífico', 'bodega', false, 0.001, 6, 0.1, 0.35, 12],

  ['Eléctrico', 'ELE', 'Cable THHN rollo 100 m', ['1,5 mm²', '2,5 mm²', '4 mm²', '6 mm²'], 'rollo', 26000, 1.55, 'ElectroSur Distribución', 'bodega', false, 0.01, 1.5, 0.4, 0.1, 1],
  ['Eléctrico', 'ELE', 'Tubo conduit PVC 3 m', ['16 mm', '20 mm', '25 mm'], 'tubo', 650, 1.35, 'ElectroSur Distribución', 'bodega', false, 0.006, 14, 0.45, 0.1, 1],
  ['Eléctrico', 'ELE', 'Enchufe doble 10 A', ['blanco', 'marfil'], 'unidad', 1900, 1, 'ElectroSur Distribución', 'bodega', false, 0.0003, 8, 0.3, 0.1, 1],
  ['Eléctrico', 'ELE', 'Interruptor 9/12', ['simple', 'doble', 'triple'], 'unidad', 1700, 1.3, 'ElectroSur Distribución', 'bodega', false, 0.0003, 7, 0.3, 0.1, 1],
  ['Eléctrico', 'ELE', 'Disyuntor termomagnético', ['10 A', '16 A', '20 A', '25 A'], 'unidad', 3600, 1.1, 'ElectroSur Distribución', 'bodega', false, 0.0003, 4, 0.35, 0.1, 1],
  ['Eléctrico', 'ELE', 'Ampolleta LED E27', ['9 W', '12 W', '15 W'], 'unidad', 950, 1.3, 'Importadora Asia Pacífico', 'bodega', false, 0.0003, 16, 0.1, 0.3, 6],
  ['Eléctrico', 'ELE', 'Foco proyector LED', ['20 W', '50 W', '100 W'], 'unidad', 4800, 1.8, 'Importadora Asia Pacífico', 'bodega', false, 0.002, 3, 0.15, 0.3, 6],

  ['Herramientas', 'HER', 'Carretilla', ['90 L rueda neumática', '100 L reforzada'], 'unidad', 29000, 1.3, 'Global Tools Import', 'bodega', false, 0.25, 1, 0.2, 0.2, 1],
  ['Herramientas', 'HER', 'Pala', ['punta mango madera', 'cuadrada mango madera', 'punta mango fibra'], 'unidad', 7200, 1.15, 'Global Tools Import', 'bodega', false, 0.01, 2.5, 0.2, 0.2, 1],
  ['Herramientas', 'HER', 'Picota', ['2,5 kg', '3,5 kg'], 'unidad', 9800, 1.2, 'Global Tools Import', 'bodega', false, 0.01, 1, 0.2, 0.2, 1],
  ['Herramientas', 'HER', 'Martillo carpintero', ['16 oz', '20 oz'], 'unidad', 4900, 1.25, 'Global Tools Import', 'bodega', false, 0.0008, 2, 0.1, 0.2, 12],
  ['Herramientas', 'HER', 'Huincha de medir', ['3 m', '5 m', '8 m'], 'unidad', 1900, 1.4, 'Global Tools Import', 'bodega', false, 0.0003, 4, 0.1, 0.2, 12],
  ['Herramientas', 'HER', 'Nivel de aluminio', ['40 cm', '60 cm', '100 cm'], 'unidad', 4300, 1.4, 'Global Tools Import', 'bodega', false, 0.002, 1.5, 0.15, 0.2, 1],
  ['Herramientas', 'HER', 'Llana', ['lisa 28 cm', 'dentada 28 cm'], 'unidad', 3100, 1.1, 'Global Tools Import', 'bodega', false, 0.0008, 2, 0.15, 0.2, 1],
  ['Herramientas', 'HER', 'Balde albañil 12 L', ['negro'], 'unidad', 1500, 1, 'Global Tools Import', 'bodega', false, 0.004, 4, 0.2, 0.2, 1],
  ['Herramientas', 'HER', 'Disco de corte metal', ['4 1/2"', '7"', '9"'], 'unidad', 690, 1.6, 'Global Tools Import', 'bodega', false, 0.0002, 14, 0.35, 0.1, 1],
  ['Herramientas', 'HER', 'Broca concreto', ['6 mm', '8 mm', '10 mm', '12 mm'], 'unidad', 1100, 1.25, 'Global Tools Import', 'bodega', false, 0.0001, 6, 0.2, 0.1, 1],

  ['Fijaciones', 'FIJ', 'Tornillo yeso-cartón punta fina', ['6x1" caja 100', '6x1 1/4" caja 100', '6x1 5/8" caja 100'], 'caja', 1600, 1.15, 'Global Tools Import', 'bodega', false, 0.0004, 16, 0.4, 0.1, 1],
  ['Fijaciones', 'FIJ', 'Tornillo autoperforante techo', ['12x1 1/2" caja 100', '12x2" caja 100'], 'caja', 5900, 1.15, 'Global Tools Import', 'bodega', false, 0.0005, 6, 0.4, 0.3, 4],
  ['Fijaciones', 'FIJ', 'Tarugo plástico', ['6 mm bolsa 100', '8 mm bolsa 100', '10 mm bolsa 100'], 'bolsa', 1100, 1.3, 'Global Tools Import', 'bodega', false, 0.0003, 9, 0.2, 0.1, 1],
  ['Fijaciones', 'FIJ', 'Clavo corriente', ['1 1/2" kg', '2" kg', '2 1/2" kg', '3" kg', '4" kg', '5" kg'], 'kg', 1600, 1.03, 'Aceros Andinos', 'bodega', false, 0.0006, 9, 0.45, 0.2, 1],
  ['Fijaciones', 'FIJ', 'Clavo techo con golilla', ['2 1/2" kg'], 'kg', 2900, 1, 'Aceros Andinos', 'bodega', false, 0.0006, 4, 0.35, 0.35, 4],

  ['Pisos y revestimientos', 'PIS', 'Cerámica piso', ['33x33 cm gris', '45x45 cm beige', '45x45 cm madera', '60x60 cm gris'], 'm²', 5200, 1.2, 'Cerámicas Ibéricas Import', 'bodega', false, 0.006, 22, 0.35, 0.2, 12],
  ['Pisos y revestimientos', 'PIS', 'Cerámica muro', ['25x40 cm blanca', '30x60 cm blanca', '30x60 cm mármol'], 'm²', 5900, 1.2, 'Cerámicas Ibéricas Import', 'bodega', false, 0.006, 12, 0.3, 0.2, 12],
  ['Pisos y revestimientos', 'PIS', 'Porcelanato', ['60x60 cm gris pulido', '60x120 cm madera'], 'm²', 11500, 1.35, 'Cerámicas Ibéricas Import', 'bodega', false, 0.006, 5, 0.3, 0.2, 12],
  ['Pisos y revestimientos', 'PIS', 'Piso flotante', ['7 mm roble', '8 mm nogal', '12 mm roble claro'], 'm²', 6900, 1.25, 'Importadora Asia Pacífico', 'bodega', false, 0.006, 8, 0.2, 0.2, 12],

  ['Aislación', 'AIS', 'Lana de vidrio rollo', ['50 mm', '80 mm', '100 mm'], 'rollo', 15800, 1.35, 'Aislantes del Sur', 'bodega', false, 0.1, 4, 0.45, 0.45, 5],
  ['Aislación', 'AIS', 'Poliestireno expandido 1x0,5 m', ['10 mm', '20 mm', '50 mm', '100 mm'], 'plancha', 520, 1.8, 'Aislantes del Sur', 'bodega', false, 0.01, 18, 0.45, 0.4, 5],
  ['Aislación', 'AIS', 'Membrana hidrófuga rollo', ['1,5x50 m'], 'rollo', 33000, 1, 'Aislantes del Sur', 'bodega', false, 0.04, 2, 0.45, 0.35, 5],
]

const q = (v) => `'${String(v).replace(/'/g, "''")}'`
const round = (v, d = 0) => (d >= 0 ? Number(v.toFixed(d)) : Math.round(v / 10 ** -d) * 10 ** -d)
const pick = (weights) => {
  const r = rand()
  let acc = 0
  for (const [value, w] of weights) {
    acc += w
    if (r < acc) return value
  }
  return weights[weights.length - 1][0]
}

const productRows = []
const paramRows = []
const skuCounter = {}

for (const [category, prefix, base, variants, unit, cost0, step, supplier, zone, weather, m2, rate0, empShare, amp, peak] of items) {
  variants.forEach((variant, i) => {
    skuCounter[prefix] = (skuCounter[prefix] || 0) + 1
    const sku = `${prefix}-${String(skuCounter[prefix]).padStart(4, '0')}`
    const cost = round(cost0 * Math.pow(step, i) * between(0.95, 1.05), -1)
    const price = round(cost * between(1.28, 1.45), -1)
    const lot = cost < 2000 ? 50 : cost < 10000 ? 10 : 1
    // la primera variante suele ser la más vendida; el resto decae con ruido
    const rate = rate0 * Math.pow(0.7, i) * Math.exp(between(-2.6, 1.1))
    const volatility = rate >= 8 ? pick([['X', 0.55], ['Y', 0.35], ['Z', 0.1]]) : pick([['X', 0.2], ['Y', 0.4], ['Z', 0.4]])
    const deadDaysAgo = rand() < 0.07 ? Math.floor(between(100, 330)) : null
    const launchDaysAgo = !deadDaysAgo && rand() < 0.04 ? Math.floor(between(60, 200)) : null
    productRows.push(
      `(${q(sku)}, ${q(`${base} ${variant}`)}, ${q(category)}, ${q(unit)}, (select id from public.suppliers where name = ${q(supplier)}), ${q(zone)}, ${weather}, ${round(m2 * between(0.85, 1.15), 5)}, ${cost}, ${price}, ${lot}, ${lot})`,
    )
    paramRows.push(
      `(${q(sku)}, ${round(rate, 3)}, ${q(volatility)}, ${round(empShare * between(0.6, 1.3), 3)}, ${round(amp * between(0.7, 1.3), 3)}, ${peak}, ${deadDaysAgo ?? 'null'}, ${launchDaysAgo ?? 'null'})`,
    )
  })
}

const sql = `-- Datos de prueba de Dimasa (generado por scripts/generate-demo-seed.mjs, no editar a mano).
-- ${productRows.length} productos, ventas diarias desde 2024-10-01 hasta 2026-10-09 y foto de stock al 2026-10-09.
-- Correr DESPUÉS de 0001_inventory_base.sql, en el SQL Editor de Supabase. Es re-ejecutable: borra los datos de prueba anteriores.

begin;

delete from public.inventory_snapshots;
delete from public.sales;
delete from public.products;
delete from public.suppliers;

insert into public.suppliers (name, origin, lead_time_days) values
${suppliers.map(([n, o, l]) => `  (${q(n)}, ${q(o)}, ${l})`).join(',\n')};

insert into public.products (sku, name, category, unit, supplier_id, storage_zone, weather_resistant, m2_per_unit, unit_cost, unit_price, min_order_qty, lot_size) values
${productRows.map((r) => `  ${r}`).join(',\n')};

-- Parámetros ocultos de demanda (solo para generar datos; no quedan en la base)
create temp table demo_params (
  sku text, rate numeric, volatility text, emp_share numeric, season_amp numeric, peak_month int,
  dead_days_ago int, launch_days_ago int
) on commit drop;

insert into demo_params values
${paramRows.map((r) => `  ${r}`).join(',\n')};

select setseed(0.1010);

-- Ventas minoristas (boletas): demanda diaria con estacionalidad, día de semana, tendencia y ruido según volatilidad
insert into public.sales (sale_date, product_id, channel, quantity, net_amount, cost_amount)
select g.d, p.id, 'minorista', g.qty, g.qty * p.unit_price, g.qty * p.unit_cost
from demo_params dp
join public.products p on p.sku = dp.sku
cross join lateral (
  select d::date as d,
    dp.rate
      * (1 + dp.season_amp * cos(2 * pi() * (extract(month from d) - dp.peak_month) / 12))
      * case extract(dow from d) when 6 then 0.7 when 1 then 1.15 else 1 end
      * (1 + 0.06 * (d::date - date '2024-10-01') / 365.0) as mean
  from generate_series(date '2024-10-01', date '2026-10-09', interval '1 day') d
  where extract(dow from d) <> 0
    and to_char(d, 'MM-DD') not in ('01-01', '05-01', '09-18', '09-19', '12-25')
    and (dp.dead_days_ago is null or d < date '2026-10-09' - dp.dead_days_ago)
    and (dp.launch_days_ago is null or d >= date '2026-10-09' - dp.launch_days_ago)
) m
cross join lateral (
  select m.d, case dp.volatility
    when 'X' then floor(m.mean * (0.75 + 0.5 * random()) + random())
    when 'Y' then floor(m.mean * (0.25 + 1.5 * random()) + random())
    else case when random() < 0.15 then floor(m.mean / 0.15 * -ln(1 - random()) + random()) else 0 end
  end as qty
) g
where g.qty > 0;

-- Ventas a empresas (facturas): pedidos esporádicos y más grandes, solo días hábiles
insert into public.sales (sale_date, product_id, channel, quantity, net_amount, cost_amount)
select g.d, p.id, 'empresas', g.qty, g.qty * p.unit_price * 0.95, g.qty * p.unit_cost
from demo_params dp
join public.products p on p.sku = dp.sku
cross join lateral (
  select d::date as d,
    dp.rate * dp.emp_share / (1 - dp.emp_share)
      * (1 + dp.season_amp * cos(2 * pi() * (extract(month from d) - dp.peak_month) / 12)) as mean
  from generate_series(date '2024-10-01', date '2026-10-09', interval '1 day') d
  where extract(dow from d) between 1 and 5
    and to_char(d, 'MM-DD') not in ('01-01', '05-01', '09-18', '09-19', '12-25')
    and (dp.dead_days_ago is null or d < date '2026-10-09' - dp.dead_days_ago)
    and (dp.launch_days_ago is null or d >= date '2026-10-09' - dp.launch_days_ago)
) m
cross join lateral (
  select m.d, case when random() < 0.3 then floor(m.mean / 0.3 * -ln(1 - random()) + random()) else 0 end as qty
) g
where dp.emp_share > 0.05 and g.qty > 0;

-- Foto de stock: sobrestock frecuente (como describe Matías), algunos quiebres y stock muerto
insert into public.inventory_snapshots (snapshot_date, product_id, quantity)
select date '2026-10-09', p.id,
  case
    when dp.dead_days_ago is not null then ceil(greatest(dp.rate, 0.5) * (40 + 120 * random()))
    when p.u < 0.03 then 0
    when p.u < 0.10 then ceil(d90.avg_daily * (1 + 3 * random()))
    when p.u < 0.62 then ceil(d90.avg_daily * case when p.origin = 'importado' then 40 + 70 * random() else 15 + 40 * random() end)
    else ceil(d90.avg_daily * case when p.origin = 'importado' then 135 + 140 * random() else 70 + 120 * random() end)
  end
from demo_params dp
join (
  select pr.id, pr.sku, s.origin, random() as u
  from public.products pr
  join public.suppliers s on s.id = pr.supplier_id
) p on p.sku = dp.sku
cross join lateral (
  select coalesce(sum(sa.quantity), 0) / 90.0 as avg_daily
  from public.sales sa
  where sa.product_id = p.id and sa.sale_date > date '2026-10-09' - 90
) d90;

-- Calibra la superficie por unidad para que la ocupación sea realista (bodega ~88%, patio ~74%)
update public.products p
set m2_per_unit = round(p.m2_per_unit * k.factor, 6)
from (
  select pr.storage_zone,
    (case pr.storage_zone when 'bodega' then 0.88 else 0.74 end) * z.capacity_m2
      / nullif(sum(i.quantity * pr.m2_per_unit), 0) as factor
  from public.products pr
  join public.inventory_snapshots i on i.product_id = pr.id
  join public.storage_zones z on z.code = pr.storage_zone
  group by pr.storage_zone, z.capacity_m2
) k
where p.storage_zone = k.storage_zone;

commit;
`

mkdirSync(new URL('../supabase/seed/', import.meta.url), { recursive: true })
writeFileSync(new URL('../supabase/seed/demo_data.sql', import.meta.url), sql)
console.log(`OK: ${productRows.length} productos → supabase/seed/demo_data.sql`)
