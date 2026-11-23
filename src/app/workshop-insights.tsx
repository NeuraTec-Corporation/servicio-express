'use client';
import { useLocale } from "./locale";
import { useCallback, useEffect, useState } from 'react';
import { api, money } from '@/lib/ui-data';
import { csvCell } from '@/lib/analytics';
import { stageDurations, type WorkEvent } from '@/lib/workshop-operations';
import type { Workflow } from '@/lib/workshop-v2';
import { stages } from '@/lib/workshop';
import { Donut, Ranking } from './management-charts';
type Row = {
    id: string;
    public_code: string;
    created_at: string;
    brand: string;
    model: string;
    technician: string;
    office: string;
    stage: keyof typeof stages;
    schedule?: Workflow['schedule'];
    issues?:Workflow['issues'];requests?:Workflow['requests'];
};
type Payload = {
    orders: Row[];
    parts: {
        order_id: string;
        part: string;
        supplier: string;
        quantity: number;
        state: string;
        unit_cost: number;
        currency: string;
    }[];
    quotes: {
        order_id: string;
        total: number;
        currency: string;
        status: string;
    }[];
    events: (WorkEvent & {
        order_id: string;
    })[];
    asOf: string;
};
export default function WorkshopInsights() {
    const { t: tr } = useLocale();
    const [refreshing,setRefreshing]=useState(false),[notice,setNotice]=useState<{kind:'refresh'|'csv';count:number;at:string}|null>(null);
    const [versionFilter,setVersionFilter]=useState('all');const [partGrouping,setPartGrouping]=useState('family');
    const [data, setData] = useState<Payload | null>(null), [error, setError] = useState('');
    const [filters, setFilters] = useState({ year: '', month: '', brand: '', model: '', technician: '', office: '', part: '', supplier: '', currency: '' });
    const load = useCallback(async () => {
        setRefreshing(true);setNotice(null);try {
            const latest=await api('/api/workshop/insights');setData(latest);setNotice({kind:'refresh',count:latest.orders.length,at:latest.asOf});
            setError('');
        }
        catch (e) {
            setError(String(e));
        }finally{setRefreshing(false)}
    }, []);
    useEffect(() => { void load(); }, [load]);
    const orders = (data?.orders ?? []).filter(o => (versionFilter==='all'||(versionFilter==='v2'?!!o.schedule:!o.schedule))&& (!filters.year || o.created_at.slice(0, 4) === filters.year) && (!filters.month || o.created_at.slice(5, 7) === filters.month) && (['brand', 'model', 'technician', 'office'] as const).every(k => !filters[k] || o[k] === filters[k]) && (!filters.part || data?.parts.some(p => p.order_id === o.id && p.part === filters.part)) && (!filters.supplier || data?.parts.some(p => p.order_id === o.id && p.supplier === filters.supplier)));
    const ids = new Set(orders.map(o => o.id));
    const parts = (data?.parts ?? []).filter(p => ids.has(p.order_id) && p.state === 'consumed' && (!filters.part || p.part === filters.part) && (!filters.supplier || p.supplier === filters.supplier));
    const quotes = (data?.quotes ?? []).filter(q => ids.has(q.order_id) && q.status === 'approved');
    const currencies = [...new Set([...parts, ...quotes].map(p => p.currency))].sort();
    const currency = filters.currency || (currencies.length === 1 ? currencies[0] : '');
    const cost = parts.filter(p => p.currency === currency).reduce((n, p) => n + p.unit_cost * p.quantity, 0), approved = quotes.filter(q => q.currency === currency).reduce((n, q) => n + q.total, 0);
    const group = (rows: {
        label: string;
        value: number;
    }[]) => {
        const m = new Map<string, number>();
        for (const r of rows)
            m.set(r.label, (m.get(r.label) ?? 0) + r.value);
        return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const durations = orders.map(o => ({ order: o, minutes: stageDurations((data?.events ?? []).filter(e => e.order_id === o.id), Date.parse(data?.asOf ?? new Date().toISOString()), o.schedule) }));
    const timedDurations=durations.filter(d=>d.order.schedule);
    const activeMinutes = timedDurations.map(d => Object.entries(d.minutes).filter(([s]) => ['diagnosis','repair','assembly','testing','cleaning'].includes(s)).reduce((n, [, v]) => n + v, 0));
    const measured = activeMinutes.filter(n => n > 0);
    const exportCSV = () => { const rows = [['codigo', 'fecha_recepcion', 'marca', 'modelo', 'tecnico', 'oficina', 'etapa'], ...orders.map(o => [o.public_code, o.created_at, o.brand, o.model, o.technician, o.office, stages[o.stage]])]; const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'taller-ordenes.csv'; a.click();setNotice({kind:'csv',count:orders.length,at:new Date().toISOString()}); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    return <section className="workshop-insights"><div className="workshop-heading"><div><h2>{tr("Inteligencia del taller")}</h2><p>{tr("\u00D3rdenes, piezas consumidas y tiempos registrados. Fecha de filtro: recepci\u00F3n del equipo.")}</p></div><div className="workshop-actions"><button onClick={exportCSV}>{tr("Exportar \u00F3rdenes CSV")}</button><button disabled={refreshing} onClick={() => void load()}>{refreshing?tr('Actualizando…','Refreshing…'):tr("Actualizar estad\u00EDsticas")}</button></div></div>{notice&&<p className="banner success" role="status">{notice.kind==='refresh'?tr('Estadísticas actualizadas: {0} órdenes · {1}','Statistics refreshed: {0} orders · {1}',[notice.count,new Date(notice.at).toLocaleTimeString()]):tr('CSV descargado: {0} órdenes filtradas','CSV downloaded: {0} filtered orders',[notice.count])}</p>}<details className="insights-help"><summary>{tr('¿Qué hacen estos botones y cómo se calculan los tiempos?','What do these buttons do and how is time calculated?')}</summary><p>{tr('Actualizar estadísticas vuelve a consultar órdenes, piezas, presupuestos y eventos guardados. Si nada cambió, los valores serán iguales; la hora confirma la nueva consulta. Exportar CSV descarga las órdenes filtradas para Excel y no modifica datos.','Refresh statistics reloads saved orders, parts, estimates and events. Unchanged records produce the same values; the timestamp confirms the new query. Export CSV downloads filtered orders for Excel without changing data.')}</p><p>{tr('Los tiempos nacen de los botones de cada etapa. V2 suma intervalos activos dentro de la jornada configurada y excluye pausas; no inventa duración a partir del modelo o pieza. Un DEMO ejecutado en segundos puede mostrar 0 minutos.','Times come from recorded stage actions. V2 sums active intervals within the configured shift, excluding pauses; it never invents durations from model or part. A DEMO run in seconds may show 0 minutes.')}</p></details>{error && <p className="error banner" role="alert">{tr(error)}</p>}<div className="workshop-filters"><label>{tr("Versión del flujo","Workflow version")}<select value={versionFilter} onChange={e=>setVersionFilter(e.target.value)}><option value="all">{tr("Todas","All")}</option><option value="v1">V1</option><option value="v2">V2</option></select></label>{Object.entries({ year: 'Año', month: 'Mes', brand: 'Marca', model: 'Modelo', technician: 'Técnico', office: 'Oficina', part: 'Pieza', supplier: 'Proveedor', currency: 'Moneda' }).map(([key, label]) => {
            let options: string[] = [];
            if (key === 'year')
                options = [...new Set(data?.orders.map(o => o.created_at.slice(0, 4)) ?? [])].sort();
            else if (key === 'month')
                options = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
            else if (key === 'currency')
                options = currencies;
            else if (key === 'part' || key === 'supplier')
                options = [...new Set(data?.parts.map(p => p[key]) ?? [])].sort();
            else
                options = [...new Set((data?.orders ?? []).filter(o => key !== 'model' || !filters.brand || o.brand === filters.brand).map(o => o[key as 'brand' | 'model' | 'technician' | 'office']))].sort();
            return <label key={key}>{tr(label)}<select aria-label={tr(label)} value={filters[key as keyof typeof filters]} onChange={e => setFilters(old => ({ ...old, [key]: e.target.value, ...(key === 'brand' ? { model: '' } : {}) }))}><option value="">{tr("Todos")}</option>{options.map(v => <option key={v}>{tr(v)}</option>)}</select></label>;
        })}<button onClick={() => setFilters({ year: '', month: '', brand: '', model: '', technician: '', office: '', part: '', supplier: '', currency: '' })}>{tr("Limpiar filtros")}</button></div>
 <div className="workshop-kpis"><div className="workshop-kpi"><span>{tr("\u00D3rdenes seleccionadas")}</span><strong>{orders.length}</strong></div><div className="workshop-kpi ready"><span>{tr("Equipos entregados")}</span><strong>{orders.filter(o => o.stage === 'delivered').length}</strong></div><div className="workshop-kpi parts"><span>{tr("Costo de piezas consumidas")}</span><strong>{currency ? money(cost, currency) : currencies.length ? tr("Elige moneda") : tr("Sin registros")}</strong></div><div className="workshop-kpi approval"><span>{tr("Presupuestos vigentes aprobados")}</span><strong>{currency ? money(approved, currency) : currencies.length ? tr("Elige moneda") : tr("Sin registros")}</strong></div></div><p className="workshop-footnote">{tr("Presupuestos aprobados no son cobros ni ventas. El costo mostrado corresponde a piezas utilizadas; no incluye mano de obra ni gastos. Promedio de ejecuci\u00F3n registrada: ")}{measured.length ? tr("{0} min ({1} \u00F3rdenes con tiempo registrado)", undefined, [Math.round(measured.reduce((n, v) => n + v, 0) / measured.length), measured.length]) : tr("sin mediciones")}{tr(". Los tiempos incluyen solo intervalos sin pausa registrada; no representan productividad laboral.")}</p>
 <p className="workshop-footnote">{tr("Los tiempos de jornada se calculan solo para V2. V1 conserva su historial anterior sin reinterpretarlo como fichaje.","Shift time is calculated only for V2. V1 keeps its previous history without treating it as time-clock records.")}</p><div className="workshop-charts"><section className="manager-chart"><h2>{tr("Daños reportados · V2")}</h2><Ranking data={group(orders.flatMap(o=>(o.issues??[]).map(i=>({label:i.reported,value:1}))))} format={n=>String(n)}/></section><section className="manager-chart"><h2>{tr("Soluciones confirmadas · V2")}</h2><Ranking data={group(orders.flatMap(o=>(o.issues??[]).filter(i=>i.confirmed).map(i=>({label:i.solution,value:1}))))} format={n=>String(n)}/></section><section className="manager-chart"><h2>{tr("Equipos por modelo")}</h2><Ranking data={group(orders.map(o => ({ label: `${o.brand} ${o.model}`, value: 1 })))} format={n => String(n)}/></section><section className="manager-chart"><h2>{tr("Distribuci\u00F3n por etapa")}</h2><Donut data={group(orders.map(o => ({ label: tr(stages[o.stage]), value: 1 })))} format={n => String(n)}/></section><section className="manager-chart"><h2>{tr("Piezas m\u00E1s utilizadas")}</h2><label>{tr('Agrupar por','Group by')}<select value={partGrouping} onChange={e=>setPartGrouping(e.target.value)}><option value="family">{tr('Tipo de componente','Component type')}</option><option value="exact">{tr('Pieza y modelo exactos','Exact part and model')}</option></select></label><Ranking data={group(parts.map(p => ({ label: partGrouping==='exact'?p.part:tr(/pantalla|screen|oled/i.test(p.part)?'Pantallas':/bater[ií]a|battery/i.test(p.part)?'Baterías':/micr[oó]fono|auricular|audio|speaker/i.test(p.part)?'Audio':/sell|adhes|kit/i.test(p.part)?'Sellos y adhesivos':/carga|usb|conector/i.test(p.part)?'Carga y conectores':p.part), value: p.quantity })))} format={n => `${n} unidades`}/></section><section className="manager-chart"><h2>{tr("Tiempo por etapa")}</h2><Ranking data={group(timedDurations.flatMap(d => Object.entries(d.minutes).map(([s, v]) => ({ label: tr(stages[s as keyof typeof stages] ?? s), value: v }))))} format={n => `${Math.round(n)} min`}/></section></div>
 </section>;
}
