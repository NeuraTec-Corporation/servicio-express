import type {Metadata} from 'next';
import './globals.css';
import './management.css';
import './catalog-selection.css';
import './pricing.css';
import './enterprise-charts.css';
import './workshop.css';
export const metadata:Metadata={title:'Servicio Express · Precios',description:'Consulta privada de ofertas de proveedores',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
