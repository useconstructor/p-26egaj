import { Suspense } from 'react';
import { CatalogPage } from '@/components/masa/storefront';
import { Loading } from '@/components/masa/shared';
export const metadata={title:'Catálogo de tortas y postres | Masa Dulce'};
export default function Page(){return <Suspense fallback={<Loading/>}><CatalogPage/></Suspense>;}
