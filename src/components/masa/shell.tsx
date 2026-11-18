'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import branding from '../../../branding.json';

const links = [['/', 'Inicio'], ['/catalogo', 'Catálogo'], ['/pedido', 'Hacer pedido']];
export function Brand({ footer = false }: { footer?: boolean }) {
 return <Link href="/" className={`brand ${footer ? 'brand-footer' : ''}`} aria-label={`${branding.logoText}, Inicio`}>
 {/* The editable brand URL may be a supplied SVG or a later uploaded URL. Preserve the original asset bytes. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img data-brand-logo src={branding.logoImageUrl || '/brand-mark.svg'} alt="" width="32" height="32" /><span>{branding.logoText}</span></Link>;
}
export function Shell({ children }: { children: React.ReactNode }) {
 const path = usePathname(); const [menuPath,setMenuPath]=useState<string|null>(null); const open=menuPath===path; const trigger=useRef<HTMLButtonElement>(null); const menu=useRef<HTMLElement>(null);
 const NavigationLink=Link;
 const [fragmentError,setFragmentError]=useState(false);const errorHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
   // Page titles are routine status updates. Reserve assertive alerts for errors.
   function updateAnnouncement(){
     const announcer=document.querySelector('next-route-announcer')?.shadowRoot?.getElementById('__next-route-announcer__');
     if(announcer){announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');}
   }
   updateAnnouncement();
   const observer=new MutationObserver(updateAnnouncement);
   observer.observe(document.body,{childList:true});
   return()=>observer.disconnect();
 },[]);
 useEffect(()=>{if(open)menu.current?.querySelector<HTMLAnchorElement>('a')?.focus();},[open]);
 useEffect(()=>{if(fragmentError)errorHeading.current?.focus();},[fragmentError]);
 useEffect(()=>{
   if(path!=='/')return;
   function activate(){if(!location.hash){setFragmentError(false);return;}let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{setFragmentError(true);return;}const target=document.getElementById(id);if(target){setFragmentError(false);const heading=target.matches('h1,h2,h3,main')?target:target.querySelector<HTMLElement>('h1,h2,h3');if(heading instanceof HTMLElement){heading.tabIndex=-1;heading.focus();}}else setFragmentError(true);}
   function repeated(event:MouseEvent){const a=(event.target as Element)?.closest('a');if(!a)return;const destination=new URL(a.href,location.href);if(destination.pathname===location.pathname&&destination.hash&&destination.hash===location.hash){event.preventDefault();activate();}}
   // Initial fragment focus waits for the mounted destination, then cancels native focus stealing.
   const frame=requestAnimationFrame(activate);window.addEventListener('hashchange',activate);window.addEventListener('popstate',activate);document.addEventListener('click',repeated);
   return()=>{cancelAnimationFrame(frame);window.removeEventListener('hashchange',activate);window.removeEventListener('popstate',activate);document.removeEventListener('click',repeated);};
 },[path]);
 return <><a className="skip-link" href="#contenido">Saltar al contenido</a><header className="site-header"><div className="header-inner"><Brand/><nav aria-label="Navegación principal" className="desktop-nav">{links.map(([href,label])=><NavigationLink key={href} href={href} aria-current={path===href?'page':undefined}>{label}{href==='/pedido'&&<ArrowUpRight size={17}/>}</NavigationLink>)}</nav><button ref={trigger} className="mobile-menu icon-button" aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>{setMenuPath(open?null:path);if(open)trigger.current?.focus();}}>{open?<X size={22}/>:<Menu size={22}/>}<span className="sr-only">{open?'Cerrar menú':'Abrir menú'}</span></button></div>{open&&<nav id="mobile-navigation" ref={menu} aria-label="Navegación móvil" className="mobile-nav" onKeyDown={e=>{if(e.key==='Escape'){setMenuPath(null);trigger.current?.focus();}}}>{links.map(([href,label])=><NavigationLink key={href} href={href} onClick={()=>setMenuPath(null)} aria-current={path===href?'page':undefined}>{label}<ArrowUpRight size={18}/></NavigationLink>)}</nav>}</header><main id="contenido" tabIndex={-1}>{path==='/'&&fragmentError&&<section className="page-wrap"><div className="feedback" role="alert"><div><h2 tabIndex={-1} ref={errorHeading}>No encontramos esta sección</h2><p>El enlace no corresponde a una sección de esta página.</p><Link className="text-link" href="/" onClick={()=>setFragmentError(false)}>Volver al inicio</Link></div></div></section>}{children}</main><footer className="site-footer"><div><Brand footer/><p>Tortas para compartir.<br/>Postres para recoger.</p></div><div className="footer-links"><Link href="/catalogo">Explorar el catálogo <ArrowUpRight size={16}/></Link><Link href="/duena/acceso">Acceso de la dueña</Link><span>Cali · Colombia</span></div><p className="footer-bottom">Una vitrina de ejemplo, un encargo claro.</p></footer></>;
}
export function DemoNotice() { return <p className="demo-notice">Demostración ficticia: productos, precios, disponibilidad e imágenes ilustrativos</p>; }
export function PageTitle({ eyebrow, children, compact = false }: { eyebrow?: string; children: React.ReactNode; compact?: boolean }) { return <div className={`page-title ${compact?'compact-title':''}`}>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{children}</h1><DemoNotice/></div>; }
