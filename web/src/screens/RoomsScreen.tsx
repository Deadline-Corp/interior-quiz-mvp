import { useMemo, useState, useEffect, useCallback } from 'react'
import { CATALOG, STORES, catItem, fmtTHB, roomTypes } from '../catalog'
import { useApp, allEntries, projTotal } from '../store'
import { RoomCanvas, itemProblems, preloadModels } from '../three/Scene'

const WALL_PAINTS = ['#ece6d9', '#e7e1d4', '#e4dcd2', '#dde4e2', '#d9cfc0', '#cdd6cf', '#c7d2d8', '#b9aa9a', '#8e9a94', '#6f7d88']

export function RoomsScreen({ toast }: { toast: (t: string) => void }) {
  const st = useApp()
  const { rooms, scenes, roomKey, setRoomKey, addItem, rotateItem, removeItem, setPaint, setScreen } = st
  const [mode, setMode] = useState<'orbit' | 'top'>('orbit')
  const [selId, setSelId] = useState<number | null>(null)

  const room = rooms.find(r => r.id === roomKey) ?? rooms[0]
  const scene = room ? scenes[room.id] : undefined
  const types = useMemo(() => room ? roomTypes(room.name) : [], [room])
  const list = useMemo(() => CATALOG.filter(c => c.rooms.some(t => types.includes(t))), [types])

  useEffect(() => { preloadModels(list.map(l => l.id)) }, [list])

  const problems = scene && room ? itemProblems(scene.items, room.w, room.h) : []
  const entries = allEntries(st)
  const roomsUsed = new Set(entries.map(e => e.roomId)).size
  const selItem = scene?.items.find(i => i.id === selId)

  const allProbs = useMemo(() => {
    const out: string[] = []
    for (const r of rooms) {
      const sc = scenes[r.id]
      if (sc?.items.length) for (const p of itemProblems(sc.items, r.w, r.h)) out.push(`${r.name}: ${p}`)
    }
    return out
  }, [rooms, scenes, st])

  const place = useCallback((sku: string) => {
    if (!room) return
    // в ряд: справа от существующих, иначе в центр со сдвигом
    const items = scenes[room.id]?.items ?? []
    let x = -room.w / 2 + 0.6 + Math.random() * 0.4, z = 0
    if (items.length) {
      x = Math.min(room.w / 2 - 0.6, Math.max(...items.map(i => i.x)) + 1.1)
      z = (Math.random() - 0.5) * Math.min(2, room.h * 0.4)
    }
    const id = addItem(room.id, sku, +x.toFixed(2), +z.toFixed(2))
    setSelId(id)
    toast(`${catItem(sku).name} — тащи мышью, R — поворот`)
  }, [room, scenes, addItem, toast])

  const exampleSet = useCallback(() => {
    if (!room) return
    const W = room.w, D = room.h
    addItem(room.id, 'sofa_03', -W * 0.22, -D * 0.33)
    addItem(room.id, 'modern_coffee_table_01', -W * 0.22, -D * 0.01)
    addItem(room.id, 'modern_arm_chair_01', -W * 0.37, D * 0.12, Math.PI / 2.4)
    const tx = W * 0.26, tz = D * 0.20
    addItem(room.id, 'round_wooden_table_01', tx, tz)
    addItem(room.id, 'dining_chair_02', tx - 0.72, tz, -Math.PI / 2)
    addItem(room.id, 'dining_chair_02', tx + 0.72, tz, Math.PI / 2)
    addItem(room.id, 'dining_chair_02', tx, tz - 0.72, Math.PI)
    addItem(room.id, 'dining_chair_02', tx, tz + 0.72, 0)
    toast('Пример расстановки готов — двигай и меняй под себя')
  }, [room, addItem, toast])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return
      if (!room || selId == null) { if (ev.key === 'Escape') setSelId(null); return }
      if (ev.key === 'r' || ev.key === 'R' || ev.key === 'к' || ev.key === 'К') rotateItem(room.id, selId, Math.PI / 12)
      if (ev.key === 'Delete' || ev.key === 'Backspace') { removeItem(room.id, selId); setSelId(null) }
      if (ev.key === 'Escape') setSelId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, selId, rotateItem, removeItem])

  if (!room || !scene) return null

  return (
    <div className="rooms-wrap">
      <div className="roombar" role="tablist">
        {rooms.map(r => {
          const cnt = scenes[r.id]?.items.length ?? 0
          return (
            <button key={r.id} role="tab" className={'room-tab' + (r.id === room.id ? ' on' : '')}
              onClick={() => { setRoomKey(r.id); setSelId(null) }}>
              {r.name}{cnt ? <span className="cnt num">{cnt}</span> : null}
            </button>
          )
        })}
        <div className="seg" style={{ marginLeft: 'auto' }}>
          <button className={mode === 'orbit' ? 'on' : ''} onClick={() => setMode('orbit')}>Обход 3D</button>
          <button className={mode === 'top' ? 'on' : ''} onClick={() => setMode('top')}>План сверху</button>
        </div>
      </div>

      <div className="stage">
        <RoomCanvas roomW={room.w} roomD={room.h} mode={mode} selId={selId} setSelId={setSelId} />

        <aside className="panel float-l">
          <h2>Каталог · {room.name}</h2>
          {types.includes('living') && !scene.items.length && (
            <div style={{ padding: '0 12px 8px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={exampleSet}>✦ Пример расстановки</button>
            </div>
          )}
          {list.length ? list.map(c => (
            <button key={c.id} className="prod" onClick={() => place(c.id)}>
              {c.thumb
                ? <span className="mini"><img src={`${import.meta.env.BASE_URL}assets/products/${c.thumb}`} alt="" loading="lazy" /></span>
                : <span className="mini mini-3d">3D</span>}
              <span style={{ minWidth: 0 }}>
                <b>{c.name}</b>
                <span className="meta"><i className="store-dot" style={{ background: STORES[c.store].color }} />{STORES[c.store].name}</span>
                <span className="price-row"><span className="price num">{fmtTHB(c.price)}</span>
                  {c.old ? <span className="old num">{fmtTHB(c.old)}</span> : null}</span>
              </span>
            </button>
          )) : (
            <p className="muted-note">Для этого типа помещения 3D-модели появятся на этапе image-to-3D (техника, сантехника). Пока обставь жилые комнаты.</p>
          )}
          <p className="muted-note" style={{ fontSize: 11 }}>Модели CC0 сопоставлены реальным SKU. В проде каждый товар получает собственную 3D-модель.</p>
        </aside>

        <aside className="panel float-r">
          <h2>Стена и смета · {room.name}</h2>
          <div className="sw-name">Цвет стен</div>
          <div className="swatches">
            {WALL_PAINTS.map(c => (
              <button key={c} className={'sw' + (scene.paint === c ? ' on' : '')} style={{ background: c }}
                aria-label="Цвет стены" onClick={() => setPaint(room.id, c)} />
            ))}
          </div>
          {selItem && (
            <div className="sel-card">
              <div className="head"><b>{catItem(selItem.sku).name}</b>
                <div className="dims num">{fmtTHB(catItem(selItem.sku).price)} · {STORES[catItem(selItem.sku).store].name}</div></div>
              <div className="sel-actions">
                <button className="btn btn-ghost" onClick={() => rotateItem(room.id, selItem.id, Math.PI / 12)}>Повернуть</button>
                <button className="btn btn-danger" onClick={() => { removeItem(room.id, selItem.id); setSelId(null) }}>Убрать</button>
              </div>
            </div>
          )}
          {problems.length > 0 && <div className="warns">{problems.slice(0, 3).map((p, i) => <div key={i} className="warn-chip">{p}</div>)}</div>}
          {scene.items.length
            ? scene.items.map(i => (
              <div key={i.id} className="est-line">
                <span>{catItem(i.sku).name}</span>
                <span className="num">{fmtTHB(catItem(i.sku).price)}</span>
              </div>))
            : <div className="empty">Комната пустая — добавь мебель слева</div>}
          <h2>Итог по проекту</h2>
          {entries.length
            ? <div className="total-card"><small>{entries.length} поз. · {roomsUsed} помещ.</small><span className="num">{fmtTHB(projTotal(st))}</span></div>
            : <div className="empty">Добавь товары хотя бы в одно помещение</div>}
          <div className="actions-stack">
            <button className="btn btn-ghost" onClick={() => toast('AI-фотореализм подключается вместе с бэкендом — фаза 1.5')}>✨ Фотореализм (скоро)</button>
            <button className="btn btn-ghost" onClick={() => toast('Проект сохранён локально. С аккаунтом — на любом устройстве')}>Сохранить проект</button>
            <button className="btn btn-primary" disabled={!entries.length || allProbs.length > 0}
              title={allProbs[0] ?? ''} onClick={() => setScreen('order')}>Оплатить заказ →</button>
          </div>
        </aside>

        <div className="foot-bar">
          <span>ЛКМ — выбрать и тащить</span><span>ПКМ — вращать сцену</span><span>колесо — зум</span>
          <span><kbd>R</kbd> поворот</span><span><kbd>Del</kbd> убрать</span>
        </div>
      </div>
    </div>
  )
}
