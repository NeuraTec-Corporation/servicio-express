'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {approvalStates,partsStates,stages,workshopCounts,type PublicOrder,type WorkOrder} from '@/lib/workshop';
import OrderEditor from './workshop-editor';
import WorkshopInventory from './workshop-inventory';
import WorkshopInsights from './workshop-insights';

type BoardOrder=PublicOrder|WorkOrder;
export default function WorkshopBoard({tv=false}:{tv?:boolean}){
  const [orders,setOrders]=useState<BoardOrder[]>([]);
  const [error,setError]=useState('');
  const [asOf,setAsOf]=useState('');
  const [loading,setLoading]=useState(true);
  const [office,setOffice]=useState('');
  const [technician,setTechnician]=useState('');
  const [search,setSearch]=useState('');
  const [showDelivered,setShowDelivered]=useState(false);
  const [editor,setEditor]=useState<WorkOrder|'new'|null>(null);
  const [notice,setNotice]=useState('');
  const [section,setSection]=useState('orders');
  const [tvPage,setTvPage]=useState(0);
  const root=useRef<HTMLDivElement>(null);
  const fetching=useRef(false);
  const refresh=useCallback(async()=>{
    if(fetching.current)return;
    fetching.current=true;
    try{
      const r=await fetch(`/api/workshop${tv?'?view=tv':''}`,{cache:'no-store'});
      if(r.status===401)throw new Error('Sesión vencida. Abre la aplicación e inicia sesión para continuar.');
      const data=await r.json();
      if(!r.ok)throw new Error(data.error);
      setOrders(data.orders);setAsOf(data.asOf);setError('');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo cargar el taller')}
    finally{setLoading(false);fetching.current=false}
  },[tv]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},30000);return()=>clearInterval(timer)},[refresh]);
  const offices=useMemo(()=>[...new Set(orders.map(o=>o.office))].sort(),[orders]);
  const technicians=useMemo(()=>[...new Set(orders.filter(o=>!office||o.office===office).map(o=>o.technician))].sort(),[orders,office]);
  const filtered=orders.filter(o=>(showDelivered||o.stage!=='delivered')&&(!office||o.office===office)&&(!technician||o.technician===technician)&&`${o.public_code} ${o.brand} ${o.model} ${'pos_reference'in o?o.pos_reference:''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const counts=workshopCounts(filtered);
  const tvPages=Math.max(1,Math.ceil(filtered.length/8));
  useEffect(()=>{if(!tv||tvPages<2)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')setTvPage(p=>(p+1)%tvPages)},20000);return()=>clearInterval(timer)},[tv,tvPages]);
  const shown=tv?filtered.slice((tvPage%tvPages)*8,(tvPage%tvPages+1)*8):filtered;
  return <div ref={root} className={`workshop ${tv?'workshop-tv':''}`}>
    <div className="workshop-heading"><div><span className="eyebrow">SERVICIO EXPRESS / {tv?'SEGUIMIENTO DE EQUIPOS':'CONTROL DEL TALLER'}</span><h1>{tv?'Así avanza tu equipo':'Cada equipo, en su etapa.'}</h1><p>{tv?'Consulta el código de seguimiento de tu orden.':'Diagnóstico, piezas y ejecución conectados con tu orden del POS.'}</p></div><div className="workshop-actions">{tv?<button onClick={()=>{void root.current?.requestFullscreen().catch(()=>setError('Usa la opción de pantalla completa de tu navegador.'))}}>Pantalla completa</button>:<><a className="workshop-link" href="/taller/tv" target="_blank" rel="noopener noreferrer">Abrir panel TV ↗</a><button className="primary" onClick={()=>setEditor('new')}>＋ Nueva orden</button></>}<button onClick={()=>void refresh()} disabled={loading}>Actualizar</button></div></div>
    {!tv&&<div className="workshop-tabs" role="group" aria-label="Secciones del taller">{[['orders','Órdenes de trabajo'],['inventory','Inventario'],['insights','Estadísticas']].map(([id,label])=><button key={id} type="button" className={section===id?'active':''} onClick={()=>setSection(id)}>{label}</button>)}</div>}
    {section==='inventory'&&!tv?<WorkshopInventory/>:section==='insights'&&!tv?<WorkshopInsights/>:<>
    {error&&<div role="alert" className="error banner">{error} {asOf&&'Los datos visibles corresponden a la última actualización correcta.'}</div>}
    {notice&&<p role="status" className="banner success">{notice}</p>}
    <section aria-label="Resumen del taller" className="workshop-kpis">{[[counts.active,'Equipos activos','active'],[counts.waitingParts,'Esperando piezas','parts'],[counts.waitingApproval,'Por autorizar','approval'],[counts.ready,'Listos para entregar','ready']].map(([value,label,tone])=><div key={label} className={`workshop-kpi ${tone}`}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <div className="workshop-filters"><label>Oficina<select value={office} onChange={e=>{setOffice(e.target.value);setTechnician('')}}><option value="">Todas las oficinas</option>{offices.map(v=><option key={v}>{v}</option>)}</select></label><label>Técnico<select value={technician} onChange={e=>setTechnician(e.target.value)}><option value="">Todos los técnicos</option>{technicians.map(v=><option key={v}>{v}</option>)}</select></label><label className="workshop-search">Buscar equipo<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tv?'Código, marca o modelo':'Código, número POS, marca o modelo'}/></label>{!tv&&<label className="workshop-delivered"><input type="checkbox" checked={showDelivered} onChange={e=>setShowDelivered(e.target.checked)}/>Ver entregados</label>}</div>
    <div className="workshop-updated">{tv&&tvPages>1&&<span>Página {tvPage%tvPages+1} de {tvPages} · rotación automática cada 20 s</span>}<span>{loading?'Cargando órdenes…':`${filtered.length} equipos en la selección`}</span><span>{asOf?`Actualizado ${new Date(asOf).toLocaleTimeString('es')} · cada 30 s`:'Esperando conexión'}</span></div>
    {!loading&&!filtered.length?<section className="workshop-empty"><span aria-hidden="true">▤</span><h2>{orders.length?'No hay equipos con estos filtros':'Tu taller comienza aquí'}</h2><p>{tv?'Las órdenes activas aparecerán cuando el técnico las registre.':'Registra la primera orden con el número del POS para empezar el seguimiento.'}</p>{!tv&&!orders.length&&<button className="primary" onClick={()=>setEditor('new')}>Registrar primera orden</button>}</section>:<div className="workshop-grid">{shown.map(order=><article key={order.id} className={`workshop-card stage-${order.stage}`}><header><span className="workshop-code">{order.public_code}</span><span className={`workshop-status stage-${order.stage}`}>{stages[order.stage]}</span></header><h2>{order.brand} {order.model}</h2><p className="workshop-assignment">{order.office} · {order.technician}</p><div className="workshop-card-flags"><span className={`workshop-flag parts-${order.parts_state}`}>{partsStates[order.parts_state]}</span>{order.approval_state!=='pos'&&<span className={`workshop-flag approval-${order.approval_state}`}>{approvalStates[order.approval_state]}</span>}</div><div className="workshop-card-bottom"><div><small>Tiempo restante estimado</small><strong>{order.estimated_minutes===null?'Por confirmar':order.estimated_minutes===0?'En revisión final':`${order.estimated_minutes} min`}</strong></div>{!tv&&'pos_reference'in order&&<button onClick={()=>setEditor(order)}>Abrir orden →</button>}</div></article>)}</div>}
    <p className="workshop-footnote">{tv?'El tiempo mostrado es una estimación del técnico y puede cambiar según pruebas o repuestos.':'Las esperas de piezas y autorización pueden coincidir en un mismo equipo. Reserva y confirma el consumo de las piezas desde la ficha de cada orden.'}</p>
    </>}
    {editor&&<OrderEditor order={editor==='new'?undefined:editor} officeOptions={offices} technicianOptions={technicians} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setNotice('Orden guardada. El panel TV se actualizará automáticamente.');void refresh()}}/>}
  </div>;
}

