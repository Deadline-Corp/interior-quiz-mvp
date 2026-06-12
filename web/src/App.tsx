import { useCallback, useRef, useState } from 'react'
import { useApp, totalArea, allEntries, projTotal } from './store'
import { fmtTHB } from './catalog'
import { PlanScreen } from './screens/PlanScreen'
import { RoomsScreen } from './screens/RoomsScreen'
import { OrderScreen } from './screens/OrderScreen'

const fmtM = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ru-RU')

export default function App() {
  const st = useApp()
  const { screen, setScreen, rooms, planConfirmed } = st
  const [hint, setHint] = useState('')
  const hintT = useRef<number>(0)

  const toast = useCallback((t: string, ms = 2800) => {
    setHint(t)
    clearTimeout(hintT.current)
    hintT.current = window.setTimeout(() => setHint(''), ms)
  }, [])

  const entries = allEntries(st)

  return (
    <div className="app">
      <header>
        <div className="brand"><b>DEADLINE</b><span>конструктор квартиры</span></div>
        <nav className="steps" aria-label="Этапы">
          <button className="step-btn" aria-current={screen === 'plan' ? 'step' : undefined}
            onClick={() => setScreen('plan')}><span className="n">1</span>Планировка</button>
          <button className="step-btn" aria-current={screen === 'rooms' ? 'step' : undefined}
            disabled={!planConfirmed}
            onClick={() => planConfirmed && setScreen('rooms')}><span className="n">2</span>Помещения 3D</button>
          <button className="step-btn" aria-current={screen === 'order' ? 'step' : undefined}
            disabled={!entries.length}
            onClick={() => entries.length && setScreen('order')}><span className="n">3</span>Заказ</button>
        </nav>
        <div className="hdr-right">
          <div className="hdr-stat"><small>Площадь</small><span className="num">{fmtM(totalArea(rooms))} м²</span></div>
          <div className="hdr-stat"><small>Проект</small><span className="num">{fmtTHB(projTotal(st))}</span></div>
        </div>
      </header>
      <main>
        {screen === 'plan' && <PlanScreen />}
        {screen === 'rooms' && (planConfirmed ? <RoomsScreen toast={toast} /> : null)}
        {screen === 'order' && <OrderScreen toast={toast} />}
        <div className={'hint' + (hint ? ' show' : '')}>{hint}</div>
      </main>
    </div>
  )
}
