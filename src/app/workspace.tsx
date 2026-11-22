'use client';
import { useLocale } from "./locale";
import { useCallback, useEffect, useState } from 'react';
import { Candidate, emptyTerms, identity, Terms } from '@/lib/domain';
import { api, Offer } from '@/lib/ui-data';
import Catalog from './catalog';
import PasswordChange from './password-change';
import { canManage, type Account } from '@/lib/access';
import AccountsPanel from './accounts-panel';
import BackupStatus from './backup-status';
import WorkshopBoard from './workshop-board';
import Icon from './ui-icon';
import ManagementDashboard from './management-dashboard';
import DataReset from './data-reset';
import RecoveryPanel from './recovery-panel';
import ImportUpload from './import-upload';
import { parseText } from '@/lib/import';
import { applyPricingUpdates } from '@/lib/pricing';
export default function Workspace({ user }: {
    user: Account;
}) {
    const { t: tr } = useLocale();
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [accountsOpen, setAccountsOpen] = useState(false);
    const [backupsOpen, setBackupsOpen] = useState(false);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [view, setView] = useState<'catalog' | 'import' | 'dashboard' | 'workshop'>('catalog');
    const [resetOpen, setResetOpen] = useState(false);
    const [recoveryOpen, setRecoveryOpen] = useState(false);
    const [generation, setGeneration] = useState(0);
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setOffers(await api('/api/offers'));
            setError('');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    return <div className="app-shell"><header className="app-header"><div className="wordmark"><b>{tr("SE")}</b><span>{tr("Servicio Express")}<small>{tr("COMPRAS & COTIZACI\u00D3N")}</small></span></div><nav aria-label={tr("Navegaci\u00F3n principal")}><button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><Icon name="table"/>{tr("Cat\u00E1logo")}</button><button className={view === 'import' ? 'active' : ''} onClick={() => setView('import')}><Icon name="file"/>{tr("Revisar listas")}</button>{canManage(user.role) && <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><Icon name="chart"/>{tr("Dashboard gerencial")}</button>}<button className={view === 'workshop' ? 'active' : ''} onClick={() => setView('workshop')}><Icon name="phone"/>{tr("Taller")}</button></nav><div className="header-actions"><button className="lab-label" title={tr("Cambiar mi clave")} onClick={() => setPasswordOpen(true)}>{user.code}</button>{user.role === 'it' && <button onClick={() => setAccountsOpen(true)}>{tr("Cuentas")}</button>}{canManage(user.role) && <button onClick={() => setBackupsOpen(true)}>{tr("Copia externa")}</button>}{user.role === 'it' && <button onClick={() => setRecoveryOpen(true)}>{tr("Recuperaci\u00F3n")}</button>}{canManage(user.role) && <button className="clear-data-button" onClick={() => setResetOpen(true)}><Icon name="trash"/>{tr("Limpiar datos")}</button>}<button className="primary" onClick={() => setView('import')}><Icon name="upload"/>{tr("Cargar lista")}</button><button className="icon-button" aria-label={tr("Cerrar sesi\u00F3n")} title={tr("Cerrar sesi\u00F3n")} onClick={async () => { await fetch('/api/logout', { method: 'POST' }); location.reload(); }}><Icon name="logout"/></button></div></header>

    {error && <div className="error banner" role="alert">{tr(error)}<button onClick={() => void refresh()}>{tr("Reintentar")}</button></div>}{notice && <div className="banner success" role="status">{tr(notice)}<button className="icon-button" aria-label={tr("Cerrar aviso")} onClick={() => setNotice('')}><Icon name="close"/></button></div>}

    {view === 'workshop' ? <WorkshopBoard key={generation}/> : view === 'dashboard' ? <ManagementDashboard key={generation} onNotice={setNotice}/> : view === 'catalog' ? <Catalog onPoliciesSaved={updates => setOffers(current => applyPricingUpdates(current, updates))} offers={offers} loading={loading} onReload={() => void refresh()} onImport={() => setView('import')} onError={setError} onNotice={setNotice}/> : <main className="import-main"><div className="page-heading"><div><span className="eyebrow">{tr("SERVICIO EXPRESS / IMPORTACI\u00D3N")}</span><h1>{tr("De la lista al cat\u00E1logo.")}</h1><p>{tr("Revisa cada precio antes de publicarlo.")}</p></div><button onClick={() => setView('catalog')}>{tr("Volver al cat\u00E1logo")}</button></div><Importer existing={offers} onPublished={() => { setView('catalog'); setNotice('Precios revisados publicados. Las ofertas anteriores se conservaron en el historial.'); void refresh(); }} onError={setError}/></main>}{passwordOpen && <dialog open className="manager-dialog"><button onClick={() => setPasswordOpen(false)}>{tr("Cerrar perfil")}</button><PasswordChange code={user.code}/></dialog>}{accountsOpen && <AccountsPanel onClose={() => setAccountsOpen(false)}/>} {backupsOpen && <BackupStatus isIT={user.role === 'it'} onClose={() => setBackupsOpen(false)}/>} {recoveryOpen && <RecoveryPanel onClose={() => setRecoveryOpen(false)}/>}{resetOpen && <DataReset onClose={() => setResetOpen(false)} onCleared={() => { setResetOpen(false); setGeneration(v => v + 1); setOffers([]); setView('catalog'); setNotice('Limpieza completada. El acceso y la auditoría se conservaron.'); void refresh(); }}/>}</div>;
}
function Importer({ existing, onPublished, onError }: {
    existing: Offer[];
    onPublished: () => void;
    onError: (s: string) => void;
}) {
    const { t: tr } = useLocale();
    const [source, setSource] = useState<{
        id: string;
        filename: string;
    } | null>(null);
    const [rows, setRows] = useState<Candidate[]>([]);
    const [supplier, setSupplier] = useState('');
    const [busy, setBusy] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [extraction, setExtraction] = useState('');
    const [expanded, setExpanded] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const edit = (i: number, key: keyof Candidate, value: unknown) => setRows(old => old.map((r, n) => n === i ? { ...r, [key]: value, reviewed: key === 'reviewed' ? Boolean(value) : false } : r));
    const term = (i: number, key: keyof Terms, value: unknown) => setRows(old => old.map((r, n) => n === i ? { ...r, terms: { ...r.terms, [key]: value }, reviewed: false } : r));
    const add = () => setRows([...rows, { brand: '', model: '', variant: '', supplier, cost: 0, currency: '', terms: emptyTerms(), reviewed: false }]);
    const duplicates = rows.map(r => identity(r) + '|' + r.supplier.toLowerCase() + '|' + r.currency);
    const valid = rows.length > 0 && rows.every(r => r.reviewed && r.brand.trim() && r.model.trim() && r.supplier.trim() && r.cost > 0 && /^[A-Z]{3}$/.test(r.currency)) && new Set(duplicates).size === duplicates.length;
    return <><div className="steps"><b className={!source ? 'selected' : ''}>{tr("1 Cargar")}</b><span>→</span><b className={source ? 'selected' : ''}>{tr("2 Revisar")}</b><span>→</span><b>{tr("3 Publicar")}</b><span>→</span><b>{tr("4 Buscar")}</b></div>{!source ? <section className="import-panel"><ImportUpload supplier={supplier} setSupplier={setSupplier} onPrepared={j => { setSource({ id: j.id, filename: j.filename }); setRows(j.rows); setExtractedText(j.text || ''); setExtraction(j.extraction || ''); setMessage(''); }}/><aside><span className="eyebrow">{tr("UNA PLANTILLA, TODAS LAS FUENTES")}</span><h2>{tr("Publica solo lo que has verificado.")}</h2><p>{tr("Los datos desconocidos permanecen vac\u00EDos. Cada fila necesita tu revisi\u00F3n antes de llegar al cat\u00E1logo.")}</p><ul><li>{tr("Todos los proveedores se conservan.")}</li><li>{tr("Las listas originales quedan disponibles.")}</li><li>{tr("Cada actualizaci\u00F3n conserva el costo anterior.")}</li></ul><button onClick={async () => {
                const text = 'Apple | iPhone 13 | 128 GB negro libre | 400 | USD\nApple | iPhone 14 | 128 GB azul libre | 480 | USD\nSamsung | Galaxy S24 | 256 GB gris libre | 520 | USD';
                setBusy(true);
                try {
                    const form = new FormData();
                    form.set('supplier', 'Proveedor DEMO ficticio');
                    form.set('text', text);
                    const r = await fetch('/api/import', { method: 'POST', body: form });
                    const j = await r.json();
                    if (!r.ok)
                        throw new Error(j.error);
                    setSupplier('Proveedor DEMO ficticio');
                    setSource({ id: j.id, filename: j.filename });
                    setRows(j.rows);
                }
                catch (e) {
                    onError(String(e));
                }
                finally {
                    setBusy(false);
                }
            }}>{tr("Probar con datos ficticios")}</button></aside></section> : <section className="review"><div className="review-top"><div><b>{source.filename}</b><small>{rows.length}{tr(" candidatos \u00B7 ")}{rows.filter(r => r.reviewed).length}{tr(" revisados")}</small><a href={'/api/source/' + source.id}>{tr("Descargar original")}</a></div><button onClick={() => { setSource(null); setRows([]); setExtractedText(''); setExtraction(''); setMessage(''); }}>{tr("Nueva carga")}</button><button type="button" disabled={!rows.length || busy} onClick={() => { const reviewed = !rows.every(r => r.reviewed); setRows(current => current.map(r => ({ ...r, reviewed }))); }}>{rows.length > 0 && rows.every(r => r.reviewed) ? tr("Deseleccionar todo") : tr("Seleccionar todo")}</button><button onClick={add}>{tr("\uFF0B Agregar fila")}</button></div>{extraction && <p className="banner">{tr(extraction)}{tr(". Revisa cada fila contra el original; ninguna se publica autom\u00E1ticamente.")}</p>}{extractedText && <details className="extracted-text"><summary>{tr("Ver y corregir el texto detectado")}</summary><p>{tr("Si falta un producto, corrige el texto y vuelve a detectar. Esto reemplaza las filas de esta revisi\u00F3n.")}</p><textarea aria-label={tr("Texto detectado del documento")} value={extractedText} onChange={e => setExtractedText(e.target.value)} rows={9} maxLength={100000}/><button onClick={() => {
                    try {
                        const parsed = parseText(extractedText, supplier);
                        if (!parsed.length)
                            throw new Error('No se reconocieron productos con precio. Escribe una línea por producto: marca | modelo | variante | costo | moneda.');
                        setRows(parsed);
                        setMessage('');
                    }
                    catch (e) {
                        setMessage(e instanceof Error ? e.message : String(e));
                    }
                }}>{tr("Volver a detectar productos")}</button></details>}<div className="table-wrap"><table><thead><tr><th>{tr("Marca")}</th><th>{tr("Modelo")}</th><th>{tr("Variante")}</th><th>{tr("Proveedor")}</th><th>{tr("Costo")}</th><th>{tr("Moneda")}</th><th>{tr("Revisada")}</th><th /></tr></thead><tbody>{rows.map((r, i) => { const duplicate = duplicates.indexOf(duplicates[i]) !== i; const previous = existing.find(o => identity(o) === identity(r) && o.supplier.toLowerCase() === r.supplier.toLowerCase() && o.currency === r.currency); return <ReviewRow key={i} row={r} index={i} expanded={expanded === i} toggle={() => setExpanded(expanded === i ? null : i)} warning={duplicate ? tr("Duplicado en lote: corrige o elimina") : previous ? tr("Actualiza oferta: costo previo {0} {1}", undefined, [previous.cost, previous.currency]) : r.warning} edit={edit} term={term} remove={() => setRows(rows.filter((_, n) => n !== i))}/>; })}</tbody></table></div><div className="publish-bar"><span>{valid ? tr("Listo para publicar.") : tr("Completa los campos, resuelve duplicados y marca cada fila como revisada.")}</span><button className="primary" disabled={!valid || busy} onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                    await api('/api/publish', { sourceId: source.id, rows: rows.map(r => ({ ...r, reviewed: true })) });
                    onPublished();
                }
                catch (e) {
                    setMessage(e instanceof Error ? e.message : String(e));
                }
                finally {
                    setBusy(false);
                }
            }}>{busy ? tr("Publicando\u2026") : tr("Publicar precios validados \u2192")}</button></div>{message && <p className="error" role="alert">{tr(message)}</p>}</section>}</>;
}
function ReviewRow({ row: r, index: i, expanded, toggle, warning, edit, term, remove }: {
    row: Candidate;
    index: number;
    expanded: boolean;
    toggle: () => void;
    warning?: string;
    edit: (i: number, key: keyof Candidate, value: unknown) => void;
    term: (i: number, key: keyof Terms, value: unknown) => void;
    remove: () => void;
}) { const { t: tr } = useLocale(); return <><tr>{(['brand', 'model', 'variant', 'supplier'] as const).map(k => <td key={k} data-label={{ brand: "Marca", model: "Modelo", variant: "Variante", supplier: "Proveedor" }[k]}><input aria-label={tr("{0} fila {1}", undefined, [k, i + 1])} value={r[k]} onChange={e => edit(i, k, e.target.value)}/></td>)}<td data-label={tr("Costo")}><input aria-label={tr("Costo fila {0}", undefined, [i + 1])} type="number" min="0.01" step="0.01" value={r.cost || ''} onChange={e => edit(i, 'cost', Number(e.target.value))}/></td><td data-label={tr("Moneda")}><input aria-label={tr("Moneda fila {0}", undefined, [i + 1])} value={r.currency} maxLength={3} placeholder={tr("USD")} onChange={e => edit(i, 'currency', e.target.value.toUpperCase())}/></td><td data-label={tr("Revisada")}><input aria-label={tr("Revisada fila {0}", undefined, [i + 1])} type="checkbox" checked={r.reviewed} onChange={e => edit(i, 'reviewed', e.target.checked)}/></td><td><button onClick={toggle}>{expanded ? tr("Menos") : tr("Condiciones")}</button><button onClick={remove} aria-label={tr("Quitar fila {0}", undefined, [i + 1])}>×</button></td></tr>{warning && <tr><td colSpan={8} className="warning">{tr(warning)}</td></tr>}{expanded && <tr><td colSpan={8}><div className="terms-form"><label>{tr("Disponibilidad")}<select value={r.terms.availability} onChange={e => term(i, 'availability', e.target.value)}><option value="unknown">{tr("Por confirmar")}</option><option value="reported">{tr("Reportada por proveedor")}</option><option value="confirmed">{tr("Confirmada con fecha")}</option><option value="unavailable">{tr("No disponible")}</option></select></label><label>{tr("Fecha de confirmaci\u00F3n")}<input type="datetime-local" value={r.terms.confirmedAt} onChange={e => term(i, 'confirmedAt', e.target.value)}/></label><label>{tr("V\u00E1lida hasta")}<input type="datetime-local" value={r.terms.validUntil} onChange={e => term(i, 'validUntil', e.target.value)}/></label><label>{tr("Modalidad")}<select value={r.terms.method} onChange={e => term(i, 'method', e.target.value)}><option value="unknown">{tr("Sin dato")}</option><option value="delivery">{tr("Delivery")}</option><option value="pickup">{tr("Retiro propio")}</option></select></label><label>{tr("Log\u00EDstica (misma moneda)")}<input type="number" min="0" step="0.01" value={r.terms.logistics ?? ''} onChange={e => term(i, 'logistics', e.target.value === '' ? null : Number(e.target.value))}/></label>{([['delivery', 'Entrega / plazo / fecha'], ['schedule', 'Horario y días hábiles'], ['cutoff', 'Hora límite'], ['warranty', 'Garantía del proveedor'], ['returns', 'Devoluciones'], ['notes', 'Observaciones']] as const).map(([key, label]) => <label key={key}>{tr(label)}<input value={r.terms[key]} onChange={e => term(i, key, e.target.value)}/></label>)}</div></td></tr>}</>; }
