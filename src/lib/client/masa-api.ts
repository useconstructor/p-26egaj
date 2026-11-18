export type Product = { id: string; name: string; category: 'tortas' | 'postres'; presentation: string; unitPrice: number; available: boolean; revision: number; presentationId: string; presentationVersion: number; position: number };
export type Policy = { timezone: string; today: string; lastDate: string; minNoticeMinutes: number; firstTime: string; lastTime: string; capacity: number };
export type Catalog = { products: Product[]; policy: Policy; serverNow: string };
export type Draft = { items: { productId: string; quantity: number; productRevision: number }[]; date: string; time: string; name: string; phone: string; note: string };
export type Line = { productId: string; productRevision: number; presentationId: string; presentationVersion: number; name: string; presentation: string; quantity: number; unitPrice: number; subtotal: number };
export type SavedDraft = { version: number; draft: Draft; preview: { lines: Line[]; total: number } | null; updatedAt: string | null };
export type Review = { draftVersion: number; lines: Line[]; total: number; pickup: { date: string; time: string; slotId: string } };
export type Order = { id: string; status: 'recibido'|'en_preparacion'|'listo'|'entregado'; version: number; name: string; phone: string; note: string; total: number; pickup: { date: string; time: string }; lines: Line[]; history: { version: number; fromStatus: string | null; toStatus: string; createdAt: string }[]; createdAt: string };
export type Availability = { date: string; policy: Policy; serverNow: string; slots: { id: string; date: string; time: string; occupied: number; capacity: number; available: boolean; reason: null|'completa'|'anticipacion' }[]; nextAvailable: { id: string; date: string; time: string } | null };
export type Fields = Record<string,string>;
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Fields = {}, public current?: unknown) { super(message); }
}
export async function api<T>(path: string, options: { method?: string; body?: unknown; csrf?: string; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method: options.method || 'GET', credentials: 'same-origin', cache: 'no-store', signal: options.signal, headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(options.csrf ? { 'X-CSRF-Token': options.csrf } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new ApiError(0, 'NETWORK', 'No pudimos conectar. Tus datos siguen aquí; vuelve a intentarlo.'); }
  let data;
  try { data = await response.json(); } catch { throw new ApiError(response.status, 'UNAVAILABLE', 'No pudimos leer la respuesta. Vuelve a intentarlo.'); }
  if (!response.ok) throw new ApiError(response.status, data.error?.code || 'UNAVAILABLE', data.error?.message || 'No pudimos completar la solicitud.', data.error?.fields || {}, data.error?.current);
  return data as T;
}
type Visitor = { authenticated: true; csrfToken: string; expiresAt: string };
export async function visitorSession(recover = false): Promise<Visitor> {
  if (!navigator.locks) throw new ApiError(0, 'SESSION_BLOCKED', 'Este navegador no permite coordinar el acceso privado. Abre la página en un navegador compatible e intenta recuperar el acceso.');
  let context = 'direct';
  if (window.top !== window) {
    const ancestors = window.location.ancestorOrigins;
    context = `embedded:${ancestors?.length ? ancestors[ancestors.length - 1] : 'unknown'}`;
  }
  const marker = `masa-dulce-session-expected:${context}`;
  return navigator.locks.request(`masa-dulce-session`, async () => {
    let expected: boolean;
    try { expected = localStorage.getItem(marker) === '1'; } catch { throw new ApiError(0,'SESSION_BLOCKED','El acceso privado está bloqueado. Permite el almacenamiento de este sitio y vuelve a intentarlo.'); }
    let session: Visitor;
    try { session = await api<Visitor>('/api/sesion'); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (expected && !recover) throw new ApiError(401, 'SESSION_LOST', 'No podemos acceder a tu sesión anterior. Recuperar el acceso inicia una sesión nueva y no recupera los pedidos de la sesión perdida.');
      await api<Visitor>('/api/sesion', { method: 'POST', body: recover ? { recover: true } : {} });
      session = await api<Visitor>('/api/sesion');
    }
    if (!session.authenticated || !session.csrfToken) throw new ApiError(401,'SESSION_BLOCKED','No pudimos verificar el acceso. Permite las cookies para continuar.');
    localStorage.setItem(marker,'1');
    return session;
  });
}
export const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
export const statusLabel = { recibido: 'Recibido', en_preparacion: 'En preparación', listo: 'Listo', entregado: 'Entregado' };
export const emptyDraft = (): Draft => ({ items: [], date: '', time: '', name: '', phone: '', note: '' });
export function bookingStarted() { (window as Window & {constructorTrack?: (name: string) => void}).constructorTrack?.('Booking started'); }
