'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/ui-data';
type Status = {
    eligible: string | null;
    jobs: {
        id: string;
        status: string;
        created_at: string;
    }[];
    settings?: {
        folder_id: string;
        desktop_path: string;
    };
    files?: {
        id: string;
        filename: string;
        sha256: string;
        bytes: string;
    }[];
    agents?: {
        id: string;
        active: boolean;
        last_seen: string | null;
    }[];
};
export default function BackupStatus({ onClose, isIT = false }: {
    onClose: () => void;
    isIT?: boolean;
}) { const { t: tr } = useLocale(); const ref = useRef<HTMLDialogElement>(null), [data, setData] = useState<Status | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [token, setToken] = useState(''); const refresh = () => api('/api/backups').then(setData); useEffect(() => { ref.current?.showModal(); void refresh().catch(e => setError(String(e))); const timer = setInterval(() => void refresh().catch(() => { }), 15000); return () => clearInterval(timer); }, []); async function run(input: unknown) { setBusy(true); setError(''); try {
    const r = await api('/api/backups', input);
    if (r.token)
        setToken(r.token);
    await refresh();
}
catch (e) {
    setError(String(e));
}
finally {
    setBusy(false);
} } return <dialog ref={ref} className="manager-dialog" onCancel={onClose}><div className="dialog-header"><h2>{tr("Copia externa protegida")}</h2><button onClick={onClose}>{tr("Cerrar")}</button></div><p>{tr("El borrado exige una copia completa y confirmada, de los datos actuales y de los \u00FAltimos 15 minutos. Si cambia alg\u00FAn dato, se necesita una nueva copia.")}</p><p role="status">{data?.eligible ? tr("\u2713 Respaldo confirmado: borrado disponible al confirmar tu clave.") : tr("\uD83D\uDD12 Borrado bloqueado hasta confirmar la copia externa.")}</p><button className="primary" disabled={busy} onClick={() => void run({ action: 'request' })}>{tr("Crear respaldo antes de borrar")}</button><p>{tr("El agente de respaldo recoge la solicitud cuando est\u00E1 activo. Una copia local pendiente de sincronizaci\u00F3n todav\u00EDa no habilita el borrado.")}</p>{data?.jobs.map(j => <p key={j.id}>{new Date(j.created_at).toLocaleString()} · {{ pending: 'Pendiente del agente', capturing: 'Creando archivo cifrado', copied: 'Copiado · pendiente de confirmación en la nube', verified: 'Confirmado por IT', failed: 'Falló · solicitar nuevamente' }[j.status] ?? j.status}</p>)}{isIT && data?.settings && <section><h3>{tr("Custodia \u00B7 solo IT")}</h3><p>{tr("Destino fijo: ")}<code>{data.settings.desktop_path}</code></p><a href={'https://drive.google.com/drive/folders/' + data.settings.folder_id} target="_blank" rel="noreferrer">{tr("Abrir carpeta corporativa")}</a><p>{tr("Confirma que el archivo termin\u00F3 de subir y descarga la copia desde Drive para comparar SHA-256 con el valor indicado. La confirmaci\u00F3n es manual por IT; no se presenta como verificaci\u00F3n autom\u00E1tica de Google.")}</p>{data.jobs.filter(j => j.status === 'copied').map(j => { const f = data.files?.find(f => f.id === j.id); return <form key={j.id} onSubmit={e => { e.preventDefault(); const v = new FormData(e.currentTarget); void run({ action: 'attest', id: j.id, drive_file_id: v.get('file'), password: v.get('password'), confirmed: v.get('confirmed') === 'on' }); }}><p>{f?.filename} · {f?.bytes}{tr(" bytes")}</p><code style={{ overflowWrap: 'anywhere' }}>{f?.sha256}</code><label>{tr("ID del archivo confirmado en Drive")}<input name="file" required pattern="[A-Za-z0-9_-]{10,160}"/></label><label>{tr("Tu clave IT")}<input name="password" type="password" autoComplete="current-password" required/></label><label><input type="checkbox" name="confirmed" required/>{tr(" Descargu\u00E9 el archivo desde la carpeta corporativa y confirm\u00E9 su SHA-256.")}</label><button disabled={busy}>{tr("Confirmar copia externa")}</button></form>; })}<h3>{tr("Agente de Windows")}</h3><p>{tr("Instala el script entregado por NeuraTec. El token permite \u00FAnicamente generar y copiar respaldos cifrados; cust\u00F3dialo como una clave.")}</p><form onSubmit={e => { e.preventDefault(); void run({ action: 'agent', password: new FormData(e.currentTarget).get('password') }); }}><label>{tr("Tu clave IT")}<input name="password" type="password" required autoComplete="current-password"/></label><button disabled={busy}>{tr("Emitir token del agente")}</button></form>{token && <p>{tr("Token de una sola visualizaci\u00F3n: ")}<code style={{ overflowWrap: 'anywhere' }}>{token}</code></p>}{data.agents?.map(a => <p key={a.id}>{tr("Agente ")}{a.id.slice(0, 8)} · {a.active ? tr("Activo") : tr("Revocado")}{tr(" \u00B7 \u00DAltimo contacto: ")}{a.last_seen ?? tr("nunca")} {a.active && <button disabled={busy} onClick={() => { const password = prompt('Tu clave IT para revocar el agente'); if (password)
    void run({ action: 'revoke', id: a.id, password }); }}>{tr("Revocar")}</button>}</p>)}</section>}<p className="error" role="alert">{tr(error)}</p></dialog>; }
