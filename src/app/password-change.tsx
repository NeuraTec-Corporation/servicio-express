'use client';
import { useLocale } from "./locale";
import { useState } from 'react';
export default function PasswordChange({ code }: {
    code: string;
}) { const { t: tr } = useLocale(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); return <main className="login"><section><h1>{tr("Tu cuenta: ")}{code}</h1><p>{tr("Cambia la clave inicial para activar tu acceso personal.")}</p><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (f.get('password') !== f.get('repeat')) {
    setError('Las claves nuevas no coinciden.');
    return;
} setBusy(true); try {
    const r = await fetch('/api/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: f.get('current'), password: f.get('password') }) });
    if (!r.ok)
        throw new Error((await r.json()).error);
    location.reload();
}
catch (e) {
    setError(String(e));
}
finally {
    setBusy(false);
} }}><label>{tr("Clave actual")}<input name="current" type="password" autoComplete="current-password" required/></label><label>{tr("Clave nueva \u00B7 m\u00EDnimo 7 caracteres")}<input name="password" type="password" autoComplete="new-password" minLength={7} maxLength={128} required/></label><label>{tr("Repite la clave nueva")}<input name="repeat" type="password" autoComplete="new-password" minLength={7} required/></label><button className="primary" disabled={busy}>{tr("Cambiar clave y continuar")}</button><p role="alert">{tr(error)}</p></form><button onClick={async () => { await fetch('/api/logout', { method: 'POST' }); location.reload(); }}>{tr("Salir")}</button></section></main>; }
