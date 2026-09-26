import type { SVGProps } from 'react';
const paths: Record<string, React.ReactNode> = {
  home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>,
  herd:<><path d="M5 7 3 5m16 2 2-2M5 7h14l2 5-2 6H5l-2-6z"/><path d="M7 18v3m10-3v3M8 11h.01M16 11h.01"/></>,
  wallet:<><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 15h3M6 6V4h12"/></>,
  milk:<><path d="M8 3h8l-1 4 3 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10l3-3z"/><path d="M6 12h12M10 3v4h4V3"/></>,
  menu:<><path d="M4 5h7v7H4zM15 5h5v5h-5zM4 16h5v5H4zM13 14h7v7h-7z"/></>,
  plus:<path d="M12 4v16M4 12h16"/>,
  arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,
  scale:<><path d="M12 3v18M4 7h16M6 7l-3 7h6zM18 7l-3 7h6zM8 21h8"/></>,
  box:<><path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10"/></>,
  spark:<><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></>,
  alert:<><path d="M12 3 2 21h20zM12 9v5m0 3h.01"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  cow:<><path d="M4 8 2 5m18 3 2-3M5 8h14l2 5-2 7H5l-2-7zM8 13h.01M16 13h.01M9 17h6"/></>,
  camera:<><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3"/></>,
  back:<path d="m14 5-7 7 7 7"/>,
  logout:<><path d="M10 4H4v16h6m6-4 4-4-4-4m4 4H9"/></>,
};
export function Icon({name,size=20,...props}:SVGProps<SVGSVGElement>&{name:string;size?:number}) {return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.spark}</svg>}
