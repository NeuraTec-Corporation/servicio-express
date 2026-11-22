'use client';
import { useLocale } from "./locale";
import { useRef, useState } from 'react';
import { readDocument, validateFile } from '@/lib/document-reader';
export default function WorkshopIntake({ onText }: {
    onText: (text: string) => void;
}) {
    const { t: tr } = useLocale();
    const [text, setText] = useState(''), [progress, setProgress] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const controller = useRef<AbortController | null>(null);
    async function read(file: File) { setBusy(true); setError(''); const signal = new AbortController(); controller.current = signal; try {
        validateFile(file);
        const result = await readDocument(file, setProgress, signal.signal);
        setText(result.text);
        setProgress('Texto detectado. Revisa y copia los campos correctos antes de guardar.');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    return <details className="workshop-intake"><summary>{tr("Leer foto o PDF de la orden del POS")}</summary><div className="workshop-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && e.dataTransfer.files[0])
        void read(e.dataTransfer.files[0]); }}><label>{tr("Arrastra la orden aqu\u00ED o selecciona un archivo")}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} onChange={e => { if (e.target.files?.[0])
        void read(e.target.files[0]); }}/></label></div>{busy && <button type="button" onClick={() => controller.current?.abort()}>{tr("Cancelar lectura")}</button>}{progress && <p role="status">{tr(progress)}</p>}{error && <p role="alert" className="error">{tr(error)}</p>}{text && <><label>{tr("Texto extra\u00EDdo \u00B7 revisar")}<textarea rows={6} maxLength={100000} value={text} onChange={e => setText(e.target.value)}/></label><button type="button" onClick={() => onText(text.slice(0, 2000))}>{tr("Conservar texto revisado en observaciones")}</button><p className="workshop-footnote">{tr("Completa n\u00FAmero POS, equipo, cliente y falla desde este texto. No se asignan campos por suposici\u00F3n. El archivo original se puede adjuntar despu\u00E9s de guardar la orden.")}</p></>}</details>;
}
