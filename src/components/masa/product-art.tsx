import { useId } from 'react';

/** Version 1 silhouettes are retained for frozen order presentation references. */
export function ProductArt({ id, name, className = '', version = 1 }: { id: string; name: string; className?: string; version?: number }) {
  const title = useId();
  const chocolate = id === 'chocolate';
  const vanilla = id === 'vainilla-frutos-rojos';
  const cheesecake = id === 'cheesecake-maracuya';
  const brownie = id === 'brownie-cacao';
  return <svg viewBox="0 0 560 330" role="img" aria-labelledby={title} className={className} data-product-art={id} data-presentation-version={version}>
    <title id={title}>{name}</title>
    <ellipse cx="280" cy="279" rx="220" ry="28" fill="#492044" opacity=".09" />
    <path d="M49 256Q280 211 511 256L493 277Q280 320 67 277Z" fill="#492044" />
    <ellipse cx="280" cy="253" rx="231" ry="41" fill="#D9E4B5" />
    <ellipse cx="280" cy="250" rx="205" ry="30" fill="#FFF9FD" />
    {(chocolate || vanilla) && <>
      <path d="M114 128L114 231C114 279 446 279 446 231V128Z" fill={chocolate ? '#352724' : '#D9E4B5'} />
      <path d="M114 209C171 247 384 256 446 209V231C433 272 143 273 114 231Z" fill={chocolate ? '#492044' : '#DB5376'} />
      <ellipse cx="280" cy="126" rx="166" ry="58" fill={chocolate ? '#492044' : '#FFF9FD'} />
      <path d="M115 131C124 150 137 147 143 164S163 181 169 158S191 160 204 169S223 161 231 160S247 180 262 168S284 167 296 179S316 183 323 163S341 157 354 168S373 173 381 154S398 158 407 158S432 144 445 129V147C419 189 164 199 115 150Z" fill={chocolate ? '#352724' : '#FFF9FD'} />
      {chocolate ? <>
        <path d="M180 119L213 87L234 116L201 138Z M289 104L325 77L343 111L307 130Z M342 139L373 112L394 142L365 158Z" fill="#352724" />
        <path d="M180 119L201 124L213 87 M289 104L307 114L325 77 M342 139L364 143L373 112" fill="none" stroke="#DB5376" strokeWidth="3" />
        <path d="M163 137Q230 184 408 128 M153 125Q246 159 393 111" fill="none" stroke="#D9E4B5" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="269" cy="135" rx="10" ry="5" fill="#DB5376" />
        <ellipse cx="243" cy="105" rx="6" ry="4" fill="#DB5376" />
      </> : <>
        {[ [166,115],[203,91],[243,109],[292,84],[339,100],[381,125],[296,137] ].map(([x,y],i)=><g key={i}><path d={`M${x-13} ${y-4}Q${x} ${y-24} ${x+13} ${y-4}Q${x+17} ${y+14} ${x} ${y+18}Q${x-17} ${y+12} ${x-13} ${y-4}`} fill="#DB5376"/><path d={`M${x-6} ${y-9}L${x} ${y-16}L${x+6} ${y-9}`} fill="#492044"/><circle cx={x-3} cy={y} r="2" fill="#FFF9FD"/></g>)}
        <ellipse cx="226" cy="136" rx="10" ry="8" fill="#492044"/><ellipse cx="353" cy="147" rx="10" ry="8" fill="#492044"/>
      </>}
    </>}
    {cheesecake && <>
      <path d="M175 147V238C175 272 385 272 385 238V147Z" fill="#D9E4B5"/>
      <path d="M175 225Q280 266 385 225V241Q280 283 175 241Z" fill="#8A4100"/>
      <ellipse cx="280" cy="145" rx="105" ry="38" fill="#8A4100"/>
      <ellipse cx="280" cy="138" rx="92" ry="29" fill="#DB5376"/>
      <ellipse cx="280" cy="134" rx="89" ry="28" fill="#8A4100"/>
      {[ [228,134],[247,119],[280,144],[304,122],[329,140],[260,137],[297,133],[273,120] ].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="3" ry="2" fill="#352724"/>)}
      <path d="M272 108Q248 78 280 81Q312 73 290 108" fill="#FFF9FD"/>
      <path d="M282 98Q297 67 323 87Q307 105 282 98" fill="#D9E4B5"/>
    </>}
    {brownie && <>
      <path d="M167 139L325 107L407 169L251 210Z" fill="#492044"/>
      <path d="M167 139V212L251 268V210Z" fill="#352724"/>
      <path d="M251 210L407 169V240L251 268Z" fill="#492044"/>
      <path d="M177 143L249 193L393 165L324 117Z" fill="#352724"/>
      <path d="M207 152L240 145L246 164L226 176Z M276 133L299 126L315 145L289 153Z M322 165L348 151L365 168L341 184Z" fill="#8A4100"/>
      <path d="M187 144L252 190L385 164 M199 150L266 184" fill="none" stroke="#DB5376" strokeWidth="3"/>
      <path d="M184 195L194 201 M215 218L229 226 M279 229L289 226 M352 216L367 212" stroke="#DB5376" strokeWidth="4"/>
    </>}
    {!chocolate && !vanilla && !cheesecake && !brownie && <text x="280" y="165" textAnchor="middle" fill="#492044" fontSize="18">{name}</text>}
  </svg>;
}
