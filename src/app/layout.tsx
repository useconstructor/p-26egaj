import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import './globals.css';
import branding from '../../branding.json';
import fontCopies from '@/data/brand-fonts.json';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/masa/shell';
export const metadata: Metadata = { title: 'Masa Dulce — Tortas y postres para recoger', description: 'Explora las tortas y postres de Masa Dulce, pastelería ficticia en Cali. Consulta la disponibilidad y prepara tu encargo para recoger.', icons:{icon:'/icon.svg',apple:'/brand-mark.svg'},manifest:'/manifest.webmanifest' };
export default function RootLayout({children}:{children:React.ReactNode}){
 const collectorUrl=`${process.env.NEXT_PUBLIC_CONSTRUCTOR_API!.replace(/\/$/,'')}/v1/projects/${process.env.NEXT_PUBLIC_PROJECT_ID}/analytics/script.js`;
 const fontUrl=(source:string)=>(fontCopies as Record<string,string>)[source]||source;
 const fontCss=branding.brandbook.fontFaces.map(f=>`@font-face{font-family:${JSON.stringify(f.family)};font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${JSON.stringify(fontUrl(f.url))})}`).join('\n');
 const style={'--brand-background':branding.backgroundColor,'--brand-surface':branding.secondaryColor,'--brand-primary':branding.primaryColor,'--brand-accent':branding.accentColor,'--brand-text':branding.textColor,'--brand-font-heading':`"${branding.fontHeading}", sans-serif`,'--brand-font-body':`"${branding.fontBody}", sans-serif`} as CSSProperties;
 return <html lang="es" style={style}><head><style>{fontCss}</style>{branding.brandbook.fontFaces.filter(f=>f.weight==='700'&&f.family===branding.fontHeading||f.weight==='400'&&f.family===branding.fontBody).map(f=><link key={f.family} rel="preload" as="font" type="font/ttf" crossOrigin="anonymous" href={fontUrl(f.url)}/>)}</head><body><TooltipProvider><Shell>{children}</Shell></TooltipProvider><script src={"https://constructor-api-git-dev-useconstructor.vercel.app/v1/projects/P-26EGAJ/analytics/script.js"} defer></script><script src="/constructor-editor.js" defer></script></body></html>;
}
