import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { roomTypes, TYPE_PAINT, catItem, type PlanRoom } from './catalog'

export type Screen = 'plan' | 'rooms' | 'order'

export interface SceneItem {
  id: number
  sku: string      // id из CATALOG (= имя 3D-модели)
  x: number        // метры от центра комнаты
  z: number
  ry: number       // поворот, рад
}

export interface RoomScene {
  paint: string
  items: SceneItem[]
}

interface AppState {
  screen: Screen
  rooms: PlanRoom[]
  nextRoomId: number
  planConfirmed: boolean
  roomKey: number | null
  scenes: Record<number, RoomScene>
  nextItemId: number
  paid: Record<string, boolean>

  setScreen: (s: Screen) => void
  setRooms: (rooms: PlanRoom[]) => void
  addRoom: () => void
  updateRoom: (id: number, patch: Partial<PlanRoom>) => void
  removeRoom: (id: number) => void
  clearPlan: () => void
  confirmPlan: () => void
  setRoomKey: (id: number) => void
  addItem: (roomId: number, sku: string, x: number, z: number, ry?: number) => number
  moveItem: (roomId: number, id: number, x: number, z: number) => void
  rotateItem: (roomId: number, id: number, dry: number) => void
  removeItem: (roomId: number, id: number) => void
  setPaint: (roomId: number, paint: string) => void
  pay: (store: string) => void
}

export const useApp = create<AppState>()(persist((set, get) => ({
  screen: 'plan',
  rooms: [],
  nextRoomId: 1,
  planConfirmed: false,
  roomKey: null,
  scenes: {},
  nextItemId: 1,
  paid: {},

  setScreen: s => set({ screen: s }),
  setRooms: rooms => set(st => ({
    rooms,
    nextRoomId: Math.max(0, ...rooms.map(r => r.id)) + 1,
    scenes: {}, planConfirmed: false, roomKey: null, paid: {},
    nextItemId: st.nextItemId,
  })),
  addRoom: () => set(st => ({
    rooms: [...st.rooms, { id: st.nextRoomId, name: 'Комната ' + st.rooms.length, x: 0.5, y: 0.5, w: 4, h: 3 }],
    nextRoomId: st.nextRoomId + 1,
  })),
  updateRoom: (id, patch) => set(st => ({ rooms: st.rooms.map(r => r.id === id ? { ...r, ...patch } : r) })),
  removeRoom: id => set(st => {
    const scenes = { ...st.scenes }; delete scenes[id]
    return { rooms: st.rooms.filter(r => r.id !== id), scenes }
  }),
  clearPlan: () => set({ rooms: [], scenes: {}, planConfirmed: false, roomKey: null, paid: {} }),

  confirmPlan: () => set(st => {
    const scenes = { ...st.scenes }
    for (const r of st.rooms) {
      if (!scenes[r.id]) scenes[r.id] = { paint: TYPE_PAINT[roomTypes(r.name)[0]], items: [] }
    }
    for (const k of Object.keys(scenes)) if (!st.rooms.find(r => String(r.id) === k)) delete scenes[+k]
    return { scenes, planConfirmed: true, roomKey: st.rooms[0]?.id ?? null, screen: 'rooms' }
  }),
  setRoomKey: id => set({ roomKey: id }),

  addItem: (roomId, sku, x, z, ry = 0) => {
    const id = get().nextItemId
    set(st => {
      const sc = st.scenes[roomId]; if (!sc) return st
      return {
        nextItemId: id + 1,
        scenes: { ...st.scenes, [roomId]: { ...sc, items: [...sc.items, { id, sku, x, z, ry: ry + (catItem(sku).rot ?? 0) }] } },
      }
    })
    return id
  },
  moveItem: (roomId, id, x, z) => set(st => {
    const sc = st.scenes[roomId]; if (!sc) return st
    return { scenes: { ...st.scenes, [roomId]: { ...sc, items: sc.items.map(i => i.id === id ? { ...i, x, z } : i) } } }
  }),
  rotateItem: (roomId, id, dry) => set(st => {
    const sc = st.scenes[roomId]; if (!sc) return st
    return { scenes: { ...st.scenes, [roomId]: { ...sc, items: sc.items.map(i => i.id === id ? { ...i, ry: i.ry + dry } : i) } } }
  }),
  removeItem: (roomId, id) => set(st => {
    const sc = st.scenes[roomId]; if (!sc) return st
    return { scenes: { ...st.scenes, [roomId]: { ...sc, items: sc.items.filter(i => i.id !== id) } } }
  }),
  setPaint: (roomId, paint) => set(st => {
    const sc = st.scenes[roomId]; if (!sc) return st
    return { scenes: { ...st.scenes, [roomId]: { ...sc, paint } } }
  }),
  pay: store => set(st => ({ paid: { ...st.paid, [store]: true } })),
}), { name: 'dl-app3' }))

/* ---------- селекторы со сводками ---------- */
export const totalArea = (rooms: PlanRoom[]) => rooms.reduce((s, r) => s + r.w * r.h, 0)

export interface Entry { room: string; roomId: number; item: SceneItem }
export function allEntries(st: Pick<AppState, 'rooms' | 'scenes'>): Entry[] {
  const out: Entry[] = []
  for (const r of st.rooms) {
    const sc = st.scenes[r.id]
    if (sc) for (const item of sc.items) out.push({ room: r.name, roomId: r.id, item })
  }
  return out
}
export const projTotal = (st: Pick<AppState, 'rooms' | 'scenes'>) =>
  allEntries(st).reduce((s, e) => s + catItem(e.item.sku).price, 0)
