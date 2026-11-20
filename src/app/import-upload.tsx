'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Candidate} from '@/lib/domain';
import {validateFile} from '@/lib/document-reader';

export type PreparedImport={id:string;filename:string;rows:Candidate[];text?:string;extraction?:string};
export default function ImportUpload({supplier,setSupplier,onPrepared}:{supplier:string;setSupplier:(value:string)=>void;onPrepared:(result:PreparedImport)=>void}){
 const [file,setFile]=useState<File|null>(null),[text,setText]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[dragging,setDragging]=useState(false),[preview,setPreview]=useState('');
 const controller=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null),active=useRef(false);
 useEffect(()=>()=>{controller.current?.abort();},[]);
 useEffect(()=>{if(!file?.type.startsWith('image/')){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const selectFile=useCallback((files:File[])=>{if(busy)return;setError('');if(files.length!==1){setError('Carga un archivo por vez para mantener cada lista vinculada a su proveedor.');return;}try{validateFile(files[0]);setFile(files[0]);}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el archivo.');}},[busy]);
 useEffect(()=>{const paste=(e:ClipboardEvent)=>{const images=Array.from(e.clipboardData?.items??[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter((f):f is File=>!!f);if(images.length){e.preventDefault();selectFile(images);}};document.addEventListener('paste',paste);return()=>document.removeEventListener('paste',paste);},[selectFile]);
 async function prepare(){
  if(active.current)return;active.current=true;setBusy(true);setError('');setProgress('Preparando lista…');const aborter=new AbortController();controller.current=aborter;
  const timeout=setTimeout(()=>aborter.abort(),180000);
  try{
   const form=new FormData();form.set('supplier',supplier.trim());let extracted='',extraction='';
   if(file){form.set('file',file);if(/\.(pdf|png|jpe?g|webp)$/i.test(file.name)){
    const {readDocument}=await import('@/lib/document-reader');const read=await readDocument(file,setProgress,aborter.signal);extracted=read.text;
    extraction=read.method==='pdf-text'?`Texto de PDF · ${read.pages} página(s)`:`Lectura OCR · ${read.pages} página(s)${read.confidence===null?'':` · confianza estimada ${Math.round(read.confidence)} %`}`;
    setText(extracted);form.set('extractedText',extracted);form.set('extractionMethod',read.method);
   }}else form.set('text',text);
   setProgress('Preparando productos para revisión…');
   const response=await fetch('/api/import',{method:'POST',body:form,signal:aborter.signal});
   if(response.status===413)throw new Error('El archivo excede el límite de carga del servidor. Reduce su tamaño y vuelve a intentarlo.');
   if(response.status===401)throw new Error('La sesión venció. Vuelve a ingresar antes de cargar la lista.');
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('No se recibió respuesta válida del servidor. Conservamos la selección; vuelve a intentarlo.');
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo preparar la lista.');
   onPrepared({...result,text:extracted||text,extraction});
  }catch(e){setError(aborter.signal.aborted?'Lectura cancelada o tiempo agotado. Puedes reintentar con un archivo más pequeño.':e instanceof Error?e.message:'No se pudo leer el documento.');}
  finally{clearTimeout(timeout);active.current=false;setBusy(false);controller.current=null;setProgress('');}
 }
 return <form className="import-upload" onSubmit={e=>{e.preventDefault();void prepare();}}>
  <label>Proveedor<input name="supplier" value={supplier} onChange={e=>setSupplier(e.target.value)} required maxLength={150} placeholder="Nombre del proveedor" disabled={busy}/></label>
  <section aria-label="Cargar documento o captura" className={`document-drop${dragging?' dragging':''}`} onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);selectFile(Array.from(e.dataTransfer.files));}}>
   <span className="drop-symbol" aria-hidden="true">↥</span><h2>Arrastra tu PDF o captura aquí</h2><p>También puedes pegar una captura de WhatsApp con <kbd>Ctrl</kbd> + <kbd>V</kbd>.</p>
   <button type="button" onClick={()=>input.current?.click()} disabled={busy}>Seleccionar archivo</button>
   <input ref={input} aria-label="Seleccionar documento o captura" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xlsx" onChange={e=>{if(e.target.files?.length)selectFile(Array.from(e.target.files));e.target.value='';}} disabled={busy}/>
   <small>PDF digital o escaneado, PNG, JPG, WEBP, TXT, CSV y XLSX.<br/>Un archivo por carga · Hasta 4 MB · PDF de hasta 20 páginas.</small>
  </section>
  {file&&<div className="selected-document">{preview&&<img src={preview} alt="Vista previa de la captura seleccionada"/>}<div><strong>{file.name}</strong><small>{(file.size/1024).toFixed(0)} KB · Se conservará el original</small></div><button type="button" disabled={busy} onClick={()=>setFile(null)}>Quitar archivo</button></div>}
  <label>{file?'Texto de la lectura (se completa al procesar)':'O pega el mensaje de WhatsApp'}<textarea name="text" rows={6} value={text} onChange={e=>setText(e.target.value)} maxLength={100000} disabled={busy} placeholder={'Precios en USD\niPhone 14 128 GB negro $480\nSamsung Galaxy S24 256 GB USD 520'}/></label>
  {file&&text&&<button type="button" disabled={busy} onClick={()=>setFile(null)}>Usar este texto en lugar del archivo</button>}
  <p className="reader-privacy">Lectura automática en tu navegador, sin servicios de OCR de pago. Revisa precios y modelos antes de publicar.</p>
  {error&&<p className="error" role="alert">{error}</p>}
  {busy&&<div role="status" aria-live="polite" className="reader-progress"><progress aria-label="Lectura de documento en curso"/><span>{progress}</span><button type="button" onClick={()=>controller.current?.abort()}>Cancelar lectura</button></div>}
  <button className="primary" disabled={busy||(!file&&!text.trim())}>{busy?'Leyendo documento…':'Leer y preparar revisión →'}</button>
 </form>;
}
