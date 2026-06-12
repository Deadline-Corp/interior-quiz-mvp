// Каталог: CC0 3D-модель (Poly Haven) ↔ реальный SKU тайского ритейлера.
// В проде каждая позиция получает собственную модель (image-to-3D / от ритейлера).

export type Kind = 'seat' | 'table' | 'storage' | 'bed'

export interface CatItem {
  id: string          // id модели = папка в assets/3d/
  name: string
  store: keyof typeof STORES
  price: number
  old?: number
  kind: Kind
  rooms: RoomType[]
  rot?: number        // поправка ориентации модели (перед = -Z)
  thumb?: string      // packshot из assets/products/
}

export const STORES = {
  homepro:  { name: 'HomePro',           color: '#1d4ed8' },
  index:    { name: 'Index Living Mall', color: '#b45309' },
  ikea:     { name: 'IKEA Thailand',     color: '#0f766e' },
  powerbuy: { name: 'Power Buy',         color: '#7c2d12' },
} as const

export type RoomType = 'kitchen' | 'living' | 'bedroom' | 'bath' | 'balcony'

export const CATALOG: CatItem[] = [
  { id: 'sofa_03',                 name: 'Диван 3-местный Lamona',  store: 'index',   price: 9990,  kind: 'seat',    rooms: ['living'],                       thumb: 'sofa-lamona.png' },
  { id: 'mid_century_lounge_chair',name: 'Кресло mid-century',      store: 'index',   price: 4990,  kind: 'seat',    rooms: ['living', 'bedroom', 'balcony'] },
  { id: 'modern_arm_chair_01',     name: 'Кресло Pillry',           store: 'index',   price: 1990,  kind: 'seat',    rooms: ['living', 'bedroom'],            thumb: 'armchair-index.png' },
  { id: 'Ottoman_01',              name: 'Пуф Ottoman',             store: 'index',   price: 2490,  kind: 'seat',    rooms: ['living', 'bedroom'] },
  { id: 'modern_coffee_table_01',  name: 'Журнальный стол Maribo',  store: 'index',   price: 2190,  kind: 'table',   rooms: ['living'],                       thumb: 'coffee-table-index.png' },
  { id: 'modern_coffee_table_02',  name: 'Журнальный стол Loft',    store: 'index',   price: 3290,  kind: 'table',   rooms: ['living'] },
  { id: 'round_wooden_table_01',   name: 'Обеденный стол Serrano',  store: 'index',   price: 8990,  kind: 'table',   rooms: ['living', 'kitchen'],            thumb: 'dining-table-index.png' },
  { id: 'dining_chair_02',         name: 'Стул обеденный Pranee',   store: 'homepro', price: 1290,  kind: 'seat',    rooms: ['living', 'kitchen'], rot: Math.PI },
  { id: 'modern_wooden_cabinet',   name: 'Комод Molly',             store: 'index',   price: 4590,  kind: 'storage', rooms: ['bedroom', 'living'],            thumb: 'dresser-index.png' },
  { id: 'ClassicNightstand_01',    name: 'Тумба прикроватная Valux',store: 'index',   price: 1290,  kind: 'storage', rooms: ['bedroom'],                      thumb: 'nightstand-index.png' },
  { id: 'side_table_tall_01',      name: 'Тумба Curvy',             store: 'index',   price: 1490,  kind: 'table',   rooms: ['living', 'bedroom'] },
  { id: 'Shelf_01',                name: 'Стеллаж открытый',        store: 'ikea',    price: 3990,  kind: 'storage', rooms: ['living', 'bedroom', 'kitchen'] },
  { id: 'GothicBed_01',            name: 'Кровать классик 6 фт',    store: 'index',   price: 18990, old: 21990, kind: 'bed', rooms: ['bedroom'],              thumb: 'bed-rotterdam.png' },
]

export const catItem = (id: string): CatItem => CATALOG.find(c => c.id === id)!

export const fmtTHB = (n: number) => '฿ ' + n.toLocaleString('th-TH')

/* ---------- помещения ---------- */
export const TYPE_PAINT: Record<RoomType, string> = {
  kitchen: '#ece6d9', living: '#e7e1d4', bedroom: '#e4dcd2', bath: '#dde4e2', balcony: '#e9e6dc',
}

export function roomTypes(name: string): RoomType[] {
  const n = String(name).toLowerCase()
  const t = new Set<RoomType>()
  if (/кух/.test(n)) t.add('kitchen')
  if (/гостин|зал|комнат/.test(n)) t.add('living')
  if (/студ/.test(n)) { t.add('living'); t.add('kitchen'); t.add('bedroom') }
  if (/спал/.test(n)) t.add('bedroom')
  if (/с\/у|сан|ванн|туал/.test(n)) t.add('bath')
  if (/балк|лодж/.test(n)) t.add('balcony')
  if (!t.size) t.add('living')
  return [...t]
}

/* ---------- шаблоны планировок Пхукета ---------- */
export interface PlanRoom { id: number; name: string; x: number; y: number; w: number; h: number }

export const TEMPLATES = [
  { id: 'studio', name: 'Студия 32 м²', desc: 'Типовая студия кондо — Rawai, Naiharn', area: 32,
    rooms: [{ name: 'Студия', x: 0, y: 0, w: 6.4, h: 4.2 }, { name: 'С/у', x: 6.4, y: 0, w: 1.8, h: 2.2 }, { name: 'Балкон', x: 6.4, y: 2.2, w: 1.8, h: 2.0 }] },
  { id: '1br', name: '1BR кондо 47 м²', desc: 'Тип Laguna / Bang Tao', area: 47,
    rooms: [{ name: 'Гостиная-кухня', x: 0, y: 0, w: 5.6, h: 4.4 }, { name: 'Спальня', x: 5.6, y: 0, w: 3.6, h: 3.4 }, { name: 'С/у', x: 5.6, y: 3.4, w: 2.2, h: 1.9 }, { name: 'Балкон', x: 0, y: 4.4, w: 3.4, h: 1.4 }] },
  { id: '2br', name: '2BR кондо 68 м²', desc: 'Семейный юнит — Cherngtalay, Kata', area: 68,
    rooms: [{ name: 'Гостиная-кухня', x: 0, y: 0, w: 6.2, h: 4.6 }, { name: 'Спальня 1', x: 6.2, y: 0, w: 3.8, h: 3.6 }, { name: 'Спальня 2', x: 6.2, y: 3.6, w: 3.8, h: 3.0 }, { name: 'С/у', x: 0, y: 4.6, w: 2.2, h: 2.0 }, { name: 'Балкон', x: 2.2, y: 4.6, w: 3.0, h: 1.5 }] },
  { id: 'villa', name: 'Вилла 3BR 140 м²', desc: 'Одноэтажная вилла — Rawai, Layan', area: 140,
    rooms: [{ name: 'Гостиная', x: 0, y: 0, w: 7.5, h: 5.5 }, { name: 'Кухня', x: 7.5, y: 0, w: 4.0, h: 3.4 }, { name: 'Спальня 1', x: 0, y: 5.5, w: 4.4, h: 4.0 }, { name: 'Спальня 2', x: 4.4, y: 5.5, w: 4.0, h: 4.0 }, { name: 'Спальня 3', x: 8.4, y: 5.5, w: 3.6, h: 4.0 }, { name: 'С/у', x: 7.5, y: 3.4, w: 2.0, h: 2.1 }] },
]
