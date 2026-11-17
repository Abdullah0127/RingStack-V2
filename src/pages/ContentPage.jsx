import { useLocation, Navigate } from 'react-router-dom'
import { pages } from '../data/siteContent.js'
import { DetailPage } from './DetailPage.jsx'
export default function ContentPage(){const key=useLocation().pathname.slice(1);const images={technology:'technology',advertisers:'analytics',publishers:'workspace','bpo-services':'meeting'};return pages[key]?<DetailPage data={pages[key]} eyebrow={key==='technology'?'Technology':key==='bpo-services'?'BPO Services':key} image={images[key]}/>:<Navigate to="/" replace/>}
