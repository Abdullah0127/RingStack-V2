import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import SiteLayout from './components/SiteLayout.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AuthPage, PortalDashboard } from './auth/AuthPages.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const Blog = lazy(() => import('./pages/Blog.jsx'))
const BlogPost = lazy(() => import('./pages/BlogPost.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const IndustryPage = lazy(() => import('./pages/Industries.jsx'))
const IndustriesIndexPage = lazy(() => import('./pages/Industries.jsx').then((module) => ({ default: module.IndustriesIndexPage })))
const Services = lazy(() => import('./pages/Services.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const Offers = lazy(() => import('./pages/Offers.jsx'))
const BpoServicesPage = lazy(() => import('./pages/BpoServicesPage.jsx'))
const AboutPage = lazy(() => import('./pages/PartnerPages.jsx').then((module) => ({ default: module.AboutPage })))
const TechnologyPage = lazy(() => import('./pages/PartnerPages.jsx').then((module) => ({ default: module.TechnologyPage })))
const AdvertisersPage = lazy(() => import('./pages/PartnerPages.jsx').then((module) => ({ default: module.AdvertisersPage })))
const PublishersPage = lazy(() => import('./pages/PartnerPages.jsx').then((module) => ({ default: module.PublishersPage })))

function RouteFallback() { return <div className="container section" role="status">Loading page…</div> }

export default function App() {
  return <AuthProvider><Suspense fallback={<RouteFallback/>}><Routes><Route element={<SiteLayout/>}>
    <Route path="/" element={<Home/>}/>
    <Route path="/industries" element={<IndustriesIndexPage/>}/>
    <Route path="/industries/:slug" element={<IndustryPage/>}/>
    <Route path="/technology" element={<TechnologyPage/>}/>
    <Route path="/bpo-services" element={<BpoServicesPage/>}/>
    <Route path="/offers" element={<Offers/>}/>
    <Route path="/offers/:offerId" element={<Offers/>}/>
    <Route path="/advertisers" element={<AdvertisersPage/>}/>
    <Route path="/publishers" element={<PublishersPage/>}/>
    <Route path="/about" element={<AboutPage/>}/>
    <Route path="/resources" element={<Blog/>}/>
    <Route path="/services" element={<Services/>}/>
    <Route path="/contact" element={<Contact/>}/>
    <Route path="/privacy" element={<Privacy/>}/>
    <Route path="/terms" element={<Terms/>}/>
    <Route path="/blog" element={<Blog/>}/>
    <Route path="/blog/:slug" element={<BlogPost/>}/>
    <Route path="*" element={<NotFound/>}/>
    <Route path="/advertiser/login" element={<AuthPage role="advertiser" mode="login"/>}/>
    <Route path="/publisher/login" element={<AuthPage role="publisher" mode="login"/>}/>
    <Route path="/advertiser/register" element={<AuthPage role="advertiser" mode="register"/>}/>
    <Route path="/publisher/register" element={<AuthPage role="publisher" mode="register"/>}/>
    <Route path="/advertiser/forgot-password" element={<AuthPage role="advertiser" mode="forgot"/>}/>
    <Route path="/publisher/forgot-password" element={<AuthPage role="publisher" mode="forgot"/>}/>
    <Route path="/advertiser/reset-password" element={<AuthPage role="advertiser" mode="reset"/>}/>
    <Route path="/publisher/reset-password" element={<AuthPage role="publisher" mode="reset"/>}/>
    <Route path="/advertiser-login" element={<AuthPage role="advertiser" mode="login"/>}/>
    <Route path="/publisher-login" element={<AuthPage role="publisher" mode="login"/>}/>
  </Route>
    <Route path="/advertiser/dashboard" element={<PortalDashboard role="advertiser"/>}/>
    <Route path="/publisher/dashboard" element={<PortalDashboard role="publisher"/>}/>
  </Routes></Suspense></AuthProvider>
}
