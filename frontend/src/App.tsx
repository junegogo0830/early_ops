import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Scan from './pages/Scan';
import Alerts from './pages/Alerts';
import Orders from './pages/Orders';
import Store from './pages/Store';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/store" element={<Store />} />
        </Routes>
        <nav className="flex gap-2 text-xs text-stone-500">
          {['', 'scan', 'alerts', 'orders', 'store'].map(p => (
            <NavLink key={p} to={`/${p}`}
              className={({isActive}) => `px-2 py-1 rounded ${isActive ? 'bg-stone-900 text-white' : 'hover:bg-stone-200'}`}>
              /{p}
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  );
}