export const roleLabels={it:'IT · NeuraTec',owner:'Dueños',manager:'Manager',technician:'Técnicos',staff:'Staff'} as const;
export type Role=keyof typeof roleLabels;
export type Account={id:string;code:string;role:Role;display_name:string;office:string;active:boolean;must_change:boolean;session_epoch:number};
export const rolePrefixes:Record<Role,string>={it:'IT',owner:'DUE',manager:'MGR',technician:'TEC',staff:'STF'};
export function canManage(role:Role){return ['it','owner','manager'].includes(role)}
export function orderVisible(user:Account,data:{technician?:string;office?:string}){
 if(canManage(user.role))return true;
 if(user.role==='staff')return data.office===user.office;
 return (data.technician===user.code||data.technician===user.display_name)&&data.office===user.office;
}
export function routeAllowed(role:Role,path:string,method:string,action=''){
 if(path.startsWith('/api/accounts'))return role==='it';
 if(path==='/api/admin/reset')return canManage(role);
 if(path==='/api/admin/recovery')return role==='it';
 if(path.startsWith('/api/backups'))return canManage(role);
 if(method==='DELETE')return canManage(role);
 if(path==='/api/management')return canManage(role);
 if(path==='/api/publish'||path.startsWith('/api/policy'))return canManage(role);
 if(path==='/api/import')return canManage(role);
 if(path==='/api/workshop/inventory-controls')return method==='GET'||canManage(role);
 if(path==='/api/workshop/operations'&&method==='POST'){
  if(['decide','settle','transfer','supplier_return'].includes(action))return canManage(role);
  if(['reserve','consume','return','quote'].includes(action))return role!=='staff';
  return canManage(role)||role==='staff';
 }
 return ['/api/offers','/api/history','/api/workshop','/api/workshop/operations','/api/workshop/media','/api/workshop/insights','/api/customers','/api/directory'].includes(path)||path.startsWith('/api/source/');
}
export function phoneKey(value:string){return value.replace(/[^0-9]/g,'').replace(/^00/,'')}
