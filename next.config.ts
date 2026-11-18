import type {NextConfig} from 'next';
const config:NextConfig={poweredByHeader:false,outputFileTracingIncludes:{'/api/management':['./db/002_management.sql'],'/api/admin/reset':['./db/002_management.sql']},async headers(){return [{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'same-origin'},{key:'Cache-Control',value:'private, no-store'}]}]}};
export default config;
