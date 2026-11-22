'use client';
import { useLocale } from "./locale";
import { useState } from 'react';
export default function Login() { const { t: tr } = useLocale(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); return <main className="login"><div className="wordmark"><b>{tr("SE")}</b>{tr(" SERVICIO EXPRESS")}</div><section><span className="eyebrow">{tr("ESPACIO PRIVADO")}</span><h1>{tr("El precio correcto.")}<br />{tr("En segundos.")}</h1><p>{tr("Ofertas, proveedores y cotizaciones en un solo lugar.")}</p><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    const r = await fetch('/api/login', { method: 'POST', body: new FormData(e.currentTarget) });
    if (r.ok)
        location.reload();
    else
        setError((await r.json()).error);
}
catch {
    setError('No se pudo conectar. Inténtalo nuevamente.');
}
finally {
    setBusy(false);
} }}><label htmlFor="code">{tr("Cuenta de usuario")}</label><input id="code" name="code" autoComplete="username" placeholder={tr("SEIT001")} required maxLength={20}/><label htmlFor="password">{tr("Clave de acceso")}</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={7}/><button className="primary" disabled={busy}>{busy ? tr("Verificando\u2026") : tr("Entrar al cat\u00E1logo \u2192")}</button><p role="alert" className="error">{tr(error)}</p></form></section><small>{tr("Acceso autorizado \u00B7 Servicio Express")}</small></main>; }
