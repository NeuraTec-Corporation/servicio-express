'use client';
import { useLocale } from "../../../locale";
export default function PrintReport() { const { t: tr } = useLocale(); return <button className="workshop-print-button" onClick={() => window.print()}>{tr("Imprimir / guardar PDF")}</button>; }
