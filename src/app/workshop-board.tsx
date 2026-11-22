'use client';
import { useLocale } from "./locale";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { approvalStates, partsStates, stages, workshopCounts, type PublicOrder, type WorkOrder } from '@/lib/workshop';
import OrderEditor from './workshop-editor';
import WorkshopInventory from './workshop-inventory';
import WorkshopInsights from './workshop-insights';
type BoardOrder = PublicOrder | WorkOrder;
export default function WorkshopBoard({ tv = false }: {
    tv?: boolean;
}) {
    const { t: tr } = useLocale();
    const [orders, setOrders] = useState<BoardOrder[]>([]);
    const [error, setError] = useState('');
    const [asOf, setAsOf] = useState('');
    const [loading, setLoading] = useState(true);
    const [office, setOffice] = useState('');
    const [technician, setTechnician] = useState('');
    const [search, setSearch] = useState('');
    const [showDelivered, setShowDelivered] = useState(false);
    const [editor, setEditor] = useState<WorkOrder | 'new' | null>(null);
    const [notice, setNotice] = useState('');
    const [section, setSection] = useState('orders');
    const [tvPage, setTvPage] = useState(0);
    const root = useRef<HTMLDivElement>(null);
    const fetching = useRef(false);
    const refresh = useCallback(async () => {
        if (fetching.current)
            return;
        fetching.current = true;
        try {
            const r = await fetch(`/api/workshop${tv ? '?view=tv' : ''}`, { cache: 'no-store' });
            if (r.status === 401)
                throw new Error('Sesión vencida. Abre la aplicación e inicia sesión para continuar.');
            const data = await r.json();
            if (!r.ok)
                throw new Error(data.error);
            setOrders(data.orders);
            setAsOf(data.asOf);
            setError('');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo cargar el taller');
        }
        finally {
            setLoading(false);
            fetching.current = false;
        }
    }, [tv]);
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible')
                void refresh();
        }, 30000);
        return () => clearInterval(timer);
    }, [refresh]);
    const offices = useMemo(() => [...new Set(orders.map(o => o.office))].sort(), [orders]);
    const technicians = useMemo(() => [...new Set(orders.filter(o => !office || o.office === office).map(o => o.technician))].sort(), [orders, office]);
    const filtered = orders.filter(o => (showDelivered || o.stage !== 'delivered') && (!office || o.office === office) && (!technician || o.technician === technician) && `${o.public_code} ${o.brand} ${o.model} ${'customer_phone' in o ? o.customer_phone : ''} ${'customer_phone' in o ? o.customer_phone.replace(/[^0-9]/g, '') : ''} ${'customer_name' in o ? o.customer_name : ''} ${'pos_reference' in o ? o.pos_reference : ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const counts = workshopCounts(filtered);
    const tvPages = Math.max(1, Math.ceil(filtered.length / 8));
    useEffect(() => {
        if (!tv || tvPages < 2)
            return;
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible')
                setTvPage(p => (p + 1) % tvPages);
        }, 20000);
        return () => clearInterval(timer);
    }, [tv, tvPages]);
    const shown = tv ? filtered.slice((tvPage % tvPages) * 8, (tvPage % tvPages + 1) * 8) : filtered;
    return <div ref={root} className={`workshop ${tv ? 'workshop-tv' : ''}`}>
    <div className="workshop-heading"><div><span className="eyebrow">{tr("SERVICIO EXPRESS / ")}{tv ? tr("SEGUIMIENTO DE EQUIPOS") : tr("CONTROL DEL TALLER")}</span><h1>{tv ? tr("As\u00ED avanza tu equipo") : tr("Cada equipo, en su etapa.")}</h1><p>{tv ? tr("Consulta el c\u00F3digo de seguimiento de tu orden.") : tr("Diagn\u00F3stico, piezas y ejecuci\u00F3n con b\u00FAsqueda por tel\u00E9fono y nombre del cliente.")}</p></div><div className="workshop-actions">{tv ? <button onClick={() => { void root.current?.requestFullscreen().catch(() => setError('Usa la opción de pantalla completa de tu navegador.')); }}>{tr("Pantalla completa")}</button> : <><a className="workshop-link" href="/taller/tv" target="_blank" rel="noopener noreferrer">{tr("Abrir panel TV \u2197")}</a><button className="primary" onClick={() => setEditor('new')}>{tr("\uFF0B Nueva orden")}</button></>}<button onClick={() => void refresh()} disabled={loading}>{tr("Actualizar")}</button></div></div>
    {!tv && <div className="workshop-tabs" role="group" aria-label={tr("Secciones del taller")}>{[['orders', 'Órdenes de trabajo'], ['inventory', 'Inventario'], ['insights', 'Estadísticas']].map(([id, label]) => <button key={id} type="button" className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{tr(label)}</button>)}</div>}
    {section === 'inventory' && !tv ? <WorkshopInventory /> : section === 'insights' && !tv ? <WorkshopInsights /> : <>
    {error && <div role="alert" className="error banner">{tr(error)} {asOf && 'Los datos visibles corresponden a la última actualización correcta.'}</div>}
    {notice && <p role="status" className="banner success">{tr(notice)}</p>}
    <section aria-label={tr("Resumen del taller")} className="workshop-kpis">{[[counts.active, 'Equipos activos', 'active'], [counts.waitingParts, 'Esperando piezas', 'parts'], [counts.waitingApproval, 'Por autorizar', 'approval'], [counts.ready, 'Listos para entregar', 'ready']].map(([value, label, tone]) => <div key={label} className={`workshop-kpi ${tone}`}><span>{tr(label)}</span><strong>{value}</strong></div>)}</section>
    <div className="workshop-filters"><label>{tr("Oficina")}<select value={office} onChange={e => { setOffice(e.target.value); setTechnician(''); }}><option value="">{tr("Todas las oficinas")}</option>{offices.map(v => <option key={v}>{tr(v)}</option>)}</select></label><label>{tr("T\u00E9cnico")}<select value={technician} onChange={e => setTechnician(e.target.value)}><option value="">{tr("Todos los t\u00E9cnicos")}</option>{technicians.map(v => <option key={v}>{tr(v)}</option>)}</select></label><label className="workshop-search">{tr("Buscar equipo")}<input value={search} onChange={e => setSearch(e.target.value)} placeholder={tv ? tr("C\u00F3digo, marca o modelo") : tr("Tel\u00E9fono, cliente, c\u00F3digo o modelo")}/></label>{!tv && <label className="workshop-delivered"><input type="checkbox" checked={showDelivered} onChange={e => setShowDelivered(e.target.checked)}/>{tr("Ver entregados")}</label>}</div>
    <div className="workshop-updated">{tv && tvPages > 1 && <span>{tr("P\u00E1gina ")}{tvPage % tvPages + 1}{tr(" de ")}{tvPages}{tr(" \u00B7 rotaci\u00F3n autom\u00E1tica cada 20 s")}</span>}<span>{loading ? tr("Cargando \u00F3rdenes\u2026") : tr("{0} equipos en la selecci\u00F3n", undefined, [filtered.length])}</span><span>{asOf ? tr("Actualizado {0} \u00B7 cada 30 s", undefined, [new Date(asOf).toLocaleTimeString('es')]) : tr("Esperando conexi\u00F3n")}</span></div>
    {!loading && !filtered.length ? <section className="workshop-empty"><span aria-hidden="true">▤</span><h2>{orders.length ? tr("No hay equipos con estos filtros") : tr("Tu taller comienza aqu\u00ED")}</h2><p>{tv ? tr("Las \u00F3rdenes activas aparecer\u00E1n cuando el t\u00E9cnico las registre.") : tr("Registra el cliente y su tel\u00E9fono para empezar el seguimiento.")}</p>{!tv && !orders.length && <button className="primary" onClick={() => setEditor('new')}>{tr("Registrar primera orden")}</button>}</section> : <div className="workshop-grid">{shown.map(order => <article key={order.id} className={`workshop-card stage-${order.stage}`}><header><span className="workshop-code">{order.public_code}</span><span className={`workshop-status stage-${order.stage}`}>{tr(stages[order.stage])}</span></header><h2>{order.brand} {order.model}</h2><p className="workshop-assignment">{order.office} · {order.technician}</p><div className="workshop-card-flags"><span className={`workshop-flag parts-${order.parts_state}`}>{tr(partsStates[order.parts_state])}</span>{order.approval_state !== 'pos' && <span className={`workshop-flag approval-${order.approval_state}`}>{tr(approvalStates[order.approval_state])}</span>}</div><div className="workshop-card-bottom"><div><small>{tr("Tiempo restante estimado")}</small><strong>{order.estimated_minutes === null ? tr("Por confirmar") : order.estimated_minutes === 0 ? tr("En revisi\u00F3n final") : tr("{0} min", undefined, [order.estimated_minutes])}</strong></div>{!tv && 'pos_reference' in order && <button onClick={() => setEditor(order)}>{tr("Abrir orden \u2192")}</button>}</div></article>)}</div>}
    <p className="workshop-footnote">{tv ? tr("El tiempo mostrado es una estimaci\u00F3n del t\u00E9cnico y puede cambiar seg\u00FAn pruebas o repuestos.") : tr("Las esperas de piezas y autorizaci\u00F3n pueden coincidir en un mismo equipo. Reserva y confirma el consumo de las piezas desde la ficha de cada orden.")}</p>
    </>}
    {editor && <OrderEditor order={editor === 'new' ? undefined : editor} officeOptions={offices} technicianOptions={technicians} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('Orden guardada. El panel TV se actualizará automáticamente.'); void refresh(); }}/>}
  </div>;
}
