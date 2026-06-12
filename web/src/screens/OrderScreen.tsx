import { STORES, catItem, fmtTHB } from '../catalog'
import { useApp, allEntries, projTotal } from '../store'

export function OrderScreen({ toast }: { toast: (t: string) => void }) {
  const st = useApp()
  const { paid, pay, setScreen } = st
  const entries = allEntries(st)
  const groups = new Map<string, typeof entries>()
  for (const e of entries) {
    const key = catItem(e.item.sku).store
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  const orders = [...groups.entries()]
  const roomsUsed = [...new Set(entries.map(e => e.room))]

  return (
    <div className="order-wrap">
      <div className="order-h">
        <h1>Заказ · {entries.length} поз. · {roomsUsed.length} {roomsUsed.length === 1 ? 'помещение' : 'помещения(й)'}</h1>
        <p>{roomsUsed.join(' · ') || '—'}. Каждый магазин — отдельный чек и доставка; единый платёж со сплитом (Xendit) — после MVP.</p>
      </div>
      <div className="order-grid">
        <div className="order-col">
          {orders.map(([storeKey, arr], i) => {
            const store = STORES[storeKey as keyof typeof STORES]
            return (
              <div key={storeKey} className="ocard">
                <header><i className="store-dot" style={{ background: store.color }} /><b>{store.name}</b>
                  <span className="badge-n">чек {i + 1} из {orders.length}</span></header>
                <div className="body">
                  {arr.map((e, j) => (
                    <div key={j} className="est-line" style={{ border: 'none', padding: '6px 16px' }}>
                      <span>{catItem(e.item.sku).name} · {e.room}</span>
                      <span className="num">{fmtTHB(catItem(e.item.sku).price)}</span>
                    </div>
                  ))}
                </div>
                <div className="pay-row">
                  <span className="num">{fmtTHB(arr.reduce((s, e) => s + catItem(e.item.sku).price, 0))}</span>
                  {paid[storeKey]
                    ? <span className="paid">Оплачено · передан магазину</span>
                    : <button className="btn btn-primary" onClick={() => pay(storeKey)}>Оплатить (PromptPay QR)</button>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="order-col">
          <div className="ocard">
            <header><b>Доставка</b></header>
            <div className="body" style={{ padding: '14px 0 4px' }}>
              <div className="field"><label>Имя</label><input placeholder="Как к вам обращаться" /></div>
              <div className="field"><label>Телефон / WhatsApp</label><input type="tel" placeholder="+66 ..." /></div>
              <div className="field"><label>ЖК / адрес и номер юнита</label><input placeholder="Например: Laguna Skypark, юнит A-204" /></div>
              <div className="field"><label>Желаемая дата доставки</label><input type="date" /></div>
            </div>
            <div className="pay-row">
              <span className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>Итого: <b>{fmtTHB(projTotal(st))}</b></span>
              <button className="btn btn-ghost" onClick={() => toast('Данные доставки отправлены (демо). В MVP — уведомление магазинам')}>Отправить данные</button>
            </div>
          </div>
          <div className="note"><b>Дальше:</b> магазины собирают свои части заказа, статусы всех доставок — в одном кабинете. Демо: оплата и передача — заглушки.</div>
          <button className="btn btn-ghost" onClick={() => setScreen('rooms')}>← Вернуться к помещениям</button>
        </div>
      </div>
    </div>
  )
}
