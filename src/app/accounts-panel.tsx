'use client';
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from 'react';
import { roleLabels, type Account, type Role } from '@/lib/access';
import { api } from '@/lib/ui-data';
export default function AccountsPanel({ onClose }: {
    onClose: () => void;
}) {
    const { t: tr } = useLocale();
    const ref = useRef<HTMLDialogElement>(null), [users, setUsers] = useState<Account[]>([]), [error, setError] = useState(''), [credential, setCredential] = useState<{
        code: string;
        password: string;
    } | null>(null), [busy, setBusy] = useState(false);
    const load = () => api('/api/accounts').then(j => setUsers(j.users));
    useEffect(() => { ref.current?.showModal(); void load().catch(e => setError(String(e))); }, []);
    async function action(input: unknown) {
        setBusy(true);
        setError('');
        try {
            const j = await api('/api/accounts', input);
            setCredential(j.password ? j : null);
            await load();
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setBusy(false);
        }
    }
    return <dialog ref={ref} className="manager-dialog" onCancel={onClose}><div className="dialog-header"><h2>{tr("Cuentas \u00B7 IT NeuraTec")}</h2><button onClick={onClose}>{tr("Cerrar")}</button></div><p>{tr("El c\u00F3digo y cargo son permanentes. Al cambiar oficina, desactivar o restablecer la clave se revocan las sesiones.")}</p>{credential && <div className="banner success"><b>{credential.code}</b><p>{tr("Clave temporal (se muestra una sola vez): ")}<code>{credential.password}</code></p><p>{tr("Entr\u00E9gala de forma privada. El usuario deber\u00E1 cambiarla al ingresar.")}</p><button onClick={() => setCredential(null)}>{tr("Ya la guard\u00E9")}</button></div>}<form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action({ action: 'create', name: f.get('name'), role: f.get('role'), office: f.get('office') }); }}><label>{tr("Nombre")}<input name="name" required maxLength={160}/></label><label>{tr("Cargo")}<select name="role">{Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}</select></label><label>{tr("Oficina")}<input name="office" required defaultValue="Principal" maxLength={160}/></label><button disabled={busy}>{tr("Crear cuenta")}</button></form>{users.map(u => <form key={u.id} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action({ action: 'update', id: u.id, name: f.get('name'), office: f.get('office'), active: f.get('active') === 'on' }); }}><hr /><b>{u.code} · {tr(roleLabels[u.role as Role])}</b><label>{tr("Nombre")}<input name="name" defaultValue={u.display_name} required maxLength={160}/></label><label>{tr("Oficina")}<input name="office" defaultValue={u.office} required maxLength={160}/></label><label><input type="checkbox" name="active" defaultChecked={u.active}/>{tr(" Activa")}</label><button disabled={busy}>{tr("Guardar cuenta")}</button><button type="button" disabled={busy} onClick={() => {
                if (confirm(`¿Restablecer la clave de ${u.code}? Se cerrarán sus sesiones.`))
                    void action({ action: 'reset', id: u.id });
            }}>{tr("Restablecer clave")}</button></form>)}<p role="alert" className="error">{tr(error)}</p></dialog>;
}
