import { Suspense } from 'react';
import { OrderForm } from '@/components/masa/order-form';
import { Loading } from '@/components/masa/shared';
export const metadata={title:'Hacer y revisar pedido | Masa Dulce'};
export default function Page(){return <Suspense fallback={<Loading>Recuperando tu selección…</Loading>}><OrderForm/></Suspense>;}
