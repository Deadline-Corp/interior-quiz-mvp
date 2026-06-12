import { useRef, useState } from 'react'
import { TEMPLATES, type PlanRoom } from '../catalog'
import { useApp, totalArea } from '../store'

const SCALE = 56
const fmtM = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ru-RU')
const snap = (v: number) => Math.round(v / 0.1) * 0.1

function TplPreview({ rooms }: { rooms: Omit<PlanRoom, 'id'>[] }) {
  const maxX = Math.max(...rooms.map(r => r.x + r.w)), maxY = Math.max(...rooms.map(r => r.y + r.h))
  const k = Math.min(64 / maxX, 48 / maxY)
  return (
    <svg width="68" height="52" viewBox="0 0 68 52" aria-hidden="true">
      {rooms.map((r, i) => (
        <rect key={i} x={r.x * k + 2} y={r.y * k + 2} width={r.w * k} height={r.h * k} fill="#fdfcfa" stroke="#1c1917" strokeWidth="1" />
      ))}
    </svg>
  )
}

export function PlanScreen() {
  const { rooms, setRooms, addRoom, updateRoom, removeRoom, clearPlan, confirmPlan } = useApp()
  const [sel, setSel] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null)

  const vb = (() => {
    const maxX = Math.max(8, ...rooms.map(r => r.x + r.w)) + 1
    const maxY = Math.max(6, ...rooms.map(r => r.y + r.h)) + 1
    return { x: -0.5, y: -0.5, w: maxX + 1, h: maxY + 1 }
  })()

  const pt = (ev: React.PointerEvent) => {
    const svg = svgRef.current!
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: p.x / SCALE, y: p.y / SCALE }
  }

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find(t => t.id === id)!
    if (rooms.length && !confirm(`Заменить текущий план шаблоном «${t.name}»?`)) return
    setRooms(t.rooms.map((r, i) => ({ id: i + 1, ...r })))
    setSel(null)
  }

  const sr = sel != null ? rooms.find(r => r.id === sel) : null

  return (
    <div className="three-cols" style={{ gridTemplateColumns: '330px 1fr' }}>
      <aside className="panel panel-l">
        <h2>Шаблоны планировок</h2>
        {TEMPLATES.map(t => (
          <button key={t.id} className="tpl" onClick={() => applyTemplate(t.id)}>
            <TplPreview rooms={t.rooms} />
            <span>
              <b>{t.name}</b><small>{t.desc}</small>
              <span className="meta">{t.rooms.length} помещений · ~{t.area} м²</span>
            </span>
          </button>
        ))}
        <h2>Свой план</h2>
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={addRoom}>+ Комната</button>
          <button className="btn btn-danger" disabled={!rooms.length}
            onClick={() => { if (confirm('Удалить весь план?')) { clearPlan(); setSel(null) } }}>Очистить</button>
        </div>
        {sr ? (
          <div className="inspector">
            <h2>Комната: {sr.name}</h2>
            <div className="field"><label>Название</label>
              <input value={sr.name} onChange={e => updateRoom(sr.id, { name: e.target.value || 'Комната' })} /></div>
            <div className="row2">
              <div className="field"><label>Ширина, м</label>
                <input type="number" step={0.1} min={1} max={30} value={sr.w}
                  onChange={e => updateRoom(sr.id, { w: Math.max(1, Math.min(30, +e.target.value || 1)) })} /></div>
              <div className="field"><label>Глубина, м</label>
                <input type="number" step={0.1} min={1} max={30} value={sr.h}
                  onChange={e => updateRoom(sr.id, { h: Math.max(1, Math.min(30, +e.target.value || 1)) })} /></div>
            </div>
            <div className="actions">
              <button className="btn btn-danger" onClick={() => { removeRoom(sr.id); setSel(null) }}>Удалить комнату</button>
            </div>
          </div>
        ) : (
          <p className="muted-note">Выбери шаблон под свой юнит или собери план сам. Клик по комнате откроет её размеры; комнаты тащатся мышью.</p>
        )}
        <div className="sticky-cta">
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={!rooms.length}
            onClick={confirmPlan}>Подтвердить планировку →</button>
          <p>Дальше — каждое помещение в реальном 3D: расстановка, цвета, смета</p>
        </div>
      </aside>

      <section className="canvas-wrap">
        <svg ref={svgRef} className="plan-svg"
          viewBox={`${vb.x * SCALE} ${vb.y * SCALE} ${vb.w * SCALE} ${vb.h * SCALE}`}
          onPointerDown={ev => {
            const el = (ev.target as Element).closest('[data-room]')
            if (el) {
              const id = +el.getAttribute('data-room')!
              const r = rooms.find(r => r.id === id)!
              const p = pt(ev)
              setSel(id); drag.current = { id, dx: p.x - r.x, dy: p.y - r.y }
              ;(ev.currentTarget as SVGSVGElement).setPointerCapture?.(ev.pointerId)
            } else setSel(null)
          }}
          onPointerMove={ev => {
            if (!drag.current) return
            const p = pt(ev)
            updateRoom(drag.current.id, { x: Math.max(-0.5, snap(p.x - drag.current.dx)), y: Math.max(-0.5, snap(p.y - drag.current.dy)) })
          }}
          onPointerUp={() => { drag.current = null }}
        >
          <g stroke="#e7e3da" strokeWidth="1">
            {Array.from({ length: Math.ceil(vb.w) + 1 }, (_, x) => (
              <line key={'x' + x} x1={x * SCALE} y1={vb.y * SCALE} x2={x * SCALE} y2={(vb.y + vb.h) * SCALE} />))}
            {Array.from({ length: Math.ceil(vb.h) + 1 }, (_, y) => (
              <line key={'y' + y} x1={vb.x * SCALE} y1={y * SCALE} x2={(vb.x + vb.w) * SCALE} y2={y * SCALE} />))}
          </g>
          {rooms.map(r => (
            <g key={r.id} data-room={r.id} style={{ cursor: 'grab' }}>
              <rect className={'room' + (sel === r.id ? ' sel' : '')} x={r.x * SCALE} y={r.y * SCALE} width={r.w * SCALE} height={r.h * SCALE} />
              <text className="room-label" x={(r.x + 0.15) * SCALE} y={(r.y + 0.38) * SCALE}>{r.name}</text>
              <text className="room-dim" x={(r.x + 0.15) * SCALE} y={(r.y + 0.66) * SCALE}>
                {fmtM(r.w)}×{fmtM(r.h)} м · {fmtM(r.w * r.h)} м²</text>
            </g>
          ))}
          {!rooms.length && (
            <text x={vb.w / 2 * SCALE} y={vb.h / 2 * SCALE} textAnchor="middle" fill="#a8a29e" fontSize="14">
              План пуст — выбери шаблон слева или добавь комнату</text>
          )}
        </svg>
        <div className="canvas-foot">
          <span>Сетка 1 м · комнаты тащатся мышью</span>
          <span style={{ marginLeft: 'auto' }}>Площадь: {fmtM(totalArea(rooms))} м²</span>
        </div>
      </section>
    </div>
  )
}
