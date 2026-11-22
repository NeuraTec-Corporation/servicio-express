'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
type Result = {
    mode: string;
    created_at: string;
    counts: Record<string, number>;
    originalDataUntouched: boolean;
};
export default function RecoveryPanel({ onClose }: {
    onClose: () => void;
}) {
    const { t: tr } = useLocale();
    const dialog = useRef<HTMLDialogElement>(null);
    const [password, setPassword] = useState(''), [passphrase, setPassphrase] = useState(''), [confirmation, setConfirmation] = useState(''), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [result, setResult] = useState<Result | null>(null);
    useEffect(() => { const prior = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => prior?.focus(); }, []);
    const request = async (body: unknown) => { const r = await fetch('/api/admin/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error || 'No se pudo completar la operación.');
    } return r; };
    async function run(action: 'export' | 'validate' | 'restore') {
        if (busy)
            return;
        setBusy(true);
        setError('');
        setResult(null);
        try {
            if (action === 'export') {
                setMessage('Preparando respaldo cifrado…');
                const r = await request({ action, password, passphrase });
                const url = URL.createObjectURL(await r.blob());
                const a = document.createElement('a');
                a.href = url;
                a.download = `servicio-express-${new Date().toISOString().slice(0, 10)}.sebackup`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage('Respaldo descargado. Guárdalo fuera de esta aplicación junto con su clave en un lugar separado.');
            }
            else {
                if (!file)
                    throw new Error('Selecciona el archivo .sebackup.');
                if (file.size > 128 * 1024 * 1024)
                    throw new Error('El archivo supera el recuperador de 128 MB del piloto.');
                const id = crypto.randomUUID(), chunks = Math.ceil(file.size / 2097152);
                for (let chunk = 0; chunk < chunks; chunk++) {
                    setMessage(`Cargando respaldo: ${chunk + 1} de ${chunks}…`);
                    const form = new FormData();
                    form.set('id', id);
                    form.set('chunk', String(chunk));
                    form.set('password', password);
                    form.set('file', file.slice(chunk * 2097152, (chunk + 1) * 2097152));
                    const r = await fetch('/api/admin/recovery', { method: 'POST', body: form });
                    if (!r.ok) {
                        const j = await r.json();
                        throw new Error(j.error);
                    }
                }
                setMessage(action === 'restore' ? 'Recuperando en la instancia vacía…' : 'Comprobando recuperación en tablas temporales aisladas…');
                const r = await request({ action, id, chunks, password, passphrase, confirmation });
                const data = await r.json();
                setResult(data);
                setMessage(action === 'restore' ? 'Recuperación completada. Recarga la aplicación.' : 'Respaldo compatible: sus datos se insertaron y comprobaron en tablas temporales; la información actual se conservó.');
            }
        }
        catch (e) {
            setMessage('');
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    }
    const ready = !!password && passphrase.length >= 12;
    return <dialog ref={dialog} className="workshop-dialog" aria-label={tr("Respaldo y recuperaci\u00F3n")} onCancel={e => { if (busy)
        e.preventDefault();
    else
        onClose(); }}><div className="recovery-body"><header><div><span className="eyebrow">{tr("CONTINUIDAD DE TU INFORMACI\u00D3N")}</span><h2>{tr("Respaldo y recuperaci\u00F3n")}</h2></div><button aria-label={tr("Cerrar respaldo")} disabled={busy} onClick={onClose}>✕</button></header><div className="workshop-editor-body"><p>{tr("Descarga tus datos, originales, evidencias e historial en un archivo cifrado. No incluye claves del sistema. No requiere contratar almacenamiento.")}</p><div className="workshop-form-grid"><label>{tr("Clave de acceso actual")}<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label><label>{tr("Clave del respaldo \u00B7 m\u00EDnimo 12 caracteres")}<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={passphrase} onChange={e => setPassphrase(e.target.value)} disabled={busy}/></label></div><p className="workshop-footnote">{tr("La clave de respaldo no se guarda. Para recuperar un archivo debes usar la misma clave con la que lo descargaste.")}</p><button className="primary" disabled={!ready || busy} onClick={() => void run('export')}>{tr("Descargar respaldo cifrado")}</button><hr /><h3>{tr("Comprobar un respaldo")}</h3><p>{tr("Esta opci\u00F3n reconstruye los datos en un \u00E1rea temporal y verifica sus relaciones, sin reemplazar la informaci\u00F3n actual.")}</p><label>{tr("Archivo de respaldo")}<input type="file" accept=".sebackup" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }}/></label><button disabled={!ready || !file || busy} onClick={() => void run('validate')}>{tr("Comprobar recuperaci\u00F3n sin modificar datos")}</button><details><summary>{tr("Recuperar en una instancia vac\u00EDa")}</summary><p>{tr("La recuperaci\u00F3n completa se rechaza si ya existen datos de negocio. Esta pantalla no borra informaci\u00F3n. Debe estar instalada la misma versi\u00F3n del esquema que contiene el archivo.")}</p><label>{tr("Escribe RESTAURAR")}<input value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy}/></label><button disabled={!ready || !file || busy || confirmation !== 'RESTAURAR'} onClick={() => void run('restore')}>{tr("Recuperar respaldo")}</button></details>{message && <p className="banner success" role="status">{tr(message)}</p>}{error && <p className="banner error" role="alert">{tr(error)}</p>}{result && <div className="recovery-counts"><strong>{Object.values(result.counts).reduce((n, v) => n + v, 0)}{tr(" registros de negocio \u00B7 respaldo ")}{new Date(result.created_at).toLocaleString('es')}</strong><details><summary>{tr("Detalle de registros")}</summary>{Object.entries(result.counts).map(([table, count]) => <p key={table}>{table}: {count}</p>)}</details></div>}<p className="workshop-footnote">{tr("La descarga es manual: conserva una copia externa despu\u00E9s de cambios importantes. No se afirma que exista un respaldo externo programado; su destino y activaci\u00F3n siguen pendientes.")}</p></div></div></dialog>;
}
