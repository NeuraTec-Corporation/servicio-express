'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {english} from '@/lib/translations';
type Language='es'|'en';
const LocaleContext=createContext({language:'es' as Language,setLanguage:(_:Language)=>{},t:(value:unknown,en?:string,values?:unknown[])=>String(value??'')});
export function LocaleProvider({children}:{children:React.ReactNode}){
 const [loaded,setLoaded]=useState(false);const [language,updateLanguage]=useState<Language>('es');const setLanguage=useCallback((value:Language)=>{localStorage.setItem('se_language',value);document.documentElement.lang=value;updateLanguage(value)},[]);
 useEffect(()=>{const saved=localStorage.getItem('se_language');if(saved==='en')setLanguage('en');setLoaded(true)},[]);
 useEffect(()=>{if(!loaded)return;document.documentElement.lang=language;localStorage.setItem('se_language',language);document.cookie=`se_language=${language}; Path=/; SameSite=Strict; Max-Age=31536000`},[language,loaded]);
 const t=useCallback((value:unknown,en?:string,values?:unknown[])=>{const es=String(value??'');const lookup=(key:string)=>Object.hasOwn(english,key)?english[key]:undefined;const key=es.replace(/^Error:\s*/,'').trim();const translated=language==='es'?es:(en??lookup(es)??(lookup(key)?es.replace(key,lookup(key)!):es));return values?translated.replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??'')):translated},[language]);const value=useMemo(()=>({language,setLanguage,t}),[language,t]);
 return <LocaleContext.Provider value={value}><div className="language-bar"><span>Servicio Express</span><label>{t('Idioma','Language')}<select aria-label="Idioma / Language" value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="es">Español</option><option value="en">English</option></select></label></div>{children}</LocaleContext.Provider>;
}
export const useLocale=()=>useContext(LocaleContext);
