import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'Fazenda Varela IA',short_name:'Fazenda IA',description:'Gestão rural da Fazenda Varela',start_url:'/painel',display:'standalone',background_color:'#f5f3ed',theme_color:'#064c38',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml'}]};}
