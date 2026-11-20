'use client';

export const MAX_FILE_BYTES=4*1024*1024;
export const MAX_PDF_PAGES=20;
export const SUPPORTED_FILE=/\.(pdf|png|jpe?g|webp|txt|csv|xlsx)$/i;
export function validateFile(file:Pick<File,'name'|'size'>){
 if(!SUPPORTED_FILE.test(file.name))throw new Error('Formato no admitido. Usa PDF, PNG, JPG, WEBP, TXT, CSV o Excel XLSX.');
 if(!file.size)throw new Error('El archivo está vacío.');
 if(file.size>MAX_FILE_BYTES)throw new Error('El archivo supera 4 MB. Divide el PDF o reduce el tamaño de la captura.');
}
export type ReadResult={text:string;method:'pdf-text'|'ocr'|'pdf-mixed';pages:number;confidence:number|null};
export async function readDocument(file:File,onProgress:(message:string)=>void,signal:AbortSignal):Promise<ReadResult>{
 let rejectAbort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(new DOMException('Lectura cancelada','AbortError'));});
 signal.addEventListener('abort',rejectAbort,{once:true});
 try{if(signal.aborted)throw new DOMException('Lectura cancelada','AbortError');return await Promise.race([readDocumentWork(file,message=>{if(!signal.aborted)onProgress(message);},signal),cancelled]);}
 finally{signal.removeEventListener('abort',rejectAbort);}
}
async function readDocumentWork(file:File,onProgress:(message:string)=>void,signal:AbortSignal):Promise<ReadResult>{
 validateFile(file);
 let worker:import('tesseract.js').Worker|undefined;
 let task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
 const abort=()=>{void worker?.terminate();void task?.destroy();};
 signal.addEventListener('abort',abort,{once:true});
 const check=()=>{if(signal.aborted)throw new DOMException('Lectura cancelada','AbortError');};
 const scores:number[]=[];
 const recognize=async(image:HTMLCanvasElement)=>{
  check();
  if(!worker){onProgress('Preparando lector de capturas…');const {createWorker}=await import('tesseract.js');check();worker=await createWorker('spa+eng',1,{workerPath:'/reader/worker.min.js',corePath:'/reader/core',langPath:'/reader/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')onProgress(`Leyendo imagen: ${Math.round(m.progress*100)} %`);}});check();await worker.setParameters({preserve_interword_spaces:'1'});}
  const result=await worker.recognize(image);check();scores.push(result.data.confidence);return result.data.text;
 };
 try{
  check();
  if(!/\.pdf$/i.test(file.name)){
   const bitmap=await createImageBitmap(file);check();
   try{
    if(bitmap.width*bitmap.height>32_000_000)throw new Error('La imagen tiene demasiados píxeles. Recorta la lista o divide la captura.');
    const scale=Math.min(2,2600/bitmap.width,Math.sqrt(8_000_000/(bitmap.width*bitmap.height)));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la imagen.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const text=await recognize(canvas);canvas.width=canvas.height=0;
    if(!text.trim())throw new Error('No se encontró texto legible. Recorta la lista y usa una captura más nítida.');
    return {text,method:'ocr',pages:1,confidence:scores[0]};
   }finally{bitmap.close();}
  }
  onProgress('Abriendo PDF…');
  const pdf=await import('pdfjs-dist');check();pdf.GlobalWorkerOptions.workerSrc='/reader/pdf.worker.min.mjs';
  task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/reader/cmaps/',cMapPacked:true,standardFontDataUrl:'/reader/standard_fonts/',wasmUrl:'/reader/wasm/'});
  // Password-protected files fail promptly instead of leaving the reader waiting.
  task.onPassword=()=>{void task?.destroy();};
  const documentPdf=await task.promise;check();
  if(documentPdf.numPages>MAX_PDF_PAGES)throw new Error(`El PDF tiene ${documentPdf.numPages} páginas. Divide el documento en grupos de hasta ${MAX_PDF_PAGES}.`);
  const texts:string[]=[];let ocrPages=0;
  for(let n=1;n<=documentPdf.numPages;n++){
   check();onProgress(`Leyendo página ${n} de ${documentPdf.numPages}…`);
   const page=await documentPdf.getPage(n);const content=await page.getTextContent();
   let line='',lastY:number|null=null;const lines:string[]=[];
   for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==null&&Math.abs(y-lastY)>3){lines.push(line);line='';}line+=(line?'  ':'')+item.str;lastY=y;if(item.hasEOL){lines.push(line);line='';lastY=null;}}
   if(line)lines.push(line);
   let text=lines.join('\n');
   // A digital header over a scanned price list must not suppress OCR.
   const hasImages=(await page.getOperatorList()).fnArray.some(op=>op===pdf.OPS.paintImageXObject||op===pdf.OPS.paintInlineImageXObject);
   if(text.replace(/\s/g,'').length<30||hasImages){
    onProgress(`Leyendo página escaneada ${n} de ${documentPdf.numPages}…`);
    const base=page.getViewport({scale:1});const scale=Math.min(2.2,2600/base.width,Math.sqrt(8_000_000/(base.width*base.height)));
    const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvas,viewport}).promise;check();
    const recognized=await recognize(canvas);canvas.width=canvas.height=0;ocrPages++;
    if(recognized.trim())text=recognized;
   }
   texts.push(text);page.cleanup();
   if(texts.join('\n').length>100000)throw new Error('El documento supera 100.000 caracteres. Divídelo en listas más pequeñas.');
  }
  if(!texts.join('').trim())throw new Error('El PDF no contiene texto legible. Prueba con una copia sin contraseña y páginas nítidas.');
  return {text:texts.join('\n\n'),method:ocrPages?'pdf-mixed':'pdf-text',pages:documentPdf.numPages,confidence:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null};
 }catch(error){if(signal.aborted)throw new DOMException('Lectura cancelada','AbortError');if(error instanceof Error&&/Invalid PDF|InvalidPDF|MissingPDF|UnexpectedResponse/i.test(error.name+' '+error.message))throw new Error('El PDF está dañado o incompleto. Descárgalo nuevamente y vuelve a cargarlo.');if(error instanceof Error&&/could not be decoded|InvalidStateError/i.test(error.name+' '+error.message))throw new Error('La imagen no se pudo abrir. Guarda la captura como PNG o JPG y vuelve a cargarla.');if(error instanceof Error&&/password|Password|destroyed/i.test(error.message))throw new Error('El PDF está protegido o no pudo abrirse. Sube una copia sin contraseña.');throw error;}
 finally{signal.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});await task?.destroy().catch(()=>{});}
}
