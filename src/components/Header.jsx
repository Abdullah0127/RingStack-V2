import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { BRAND, industries, navItems } from "../data/siteContent.js";

function Dropdown({ label, to, children, open, onToggle, onNavigate }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onToggle(false);
    }
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onToggle(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onToggle, open]);
  return (
    <div className={`nav-dropdown${to ? " nav-dropdown-with-link" : ""}`} ref={ref}>
      {to ? (
        <>
          <NavLink to={to} onClick={onNavigate}>{label}</NavLink>
          <button
            className="dropdown-toggle"
            type="button"
            aria-label={`Toggle ${label} menu`}
            aria-expanded={open}
            onClick={() => onToggle(!open)}
          >
            <span aria-hidden="true">⌄</span>
          </button>
        </>
      ) : (
        <button type="button" aria-expanded={open} onClick={() => onToggle(!open)}>
          {label} <span aria-hidden="true">⌄</span>
        </button>
      )}
      {open && <div className="dropdown-panel">{children}</div>}
    </div>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdown, setDropdown] = useState("");
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "light",
  );
  const toggleIndustries = useCallback((open) => setDropdown(open ? "industries" : ""), []);
  const toggleLogin = useCallback((open) => setDropdown(open ? "login" : ""), []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ringstack-theme", next);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "dark" ? "#101916" : "#f7faf8");
  }
  function closeMenu() {
    setMenuOpen(false);
    setDropdown("");
  }
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>{BRAND}</span>
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <nav
          id="primary-navigation"
          className={`primary-navigation${menuOpen ? " open" : ""}`}
          aria-label="Main navigation"
        >
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <Dropdown
            label="Industries"
            to="/industries"
            open={dropdown === "industries"}
            onToggle={toggleIndustries}
            onNavigate={closeMenu}
          >
            {industries.map((item) => (
              <Link
                key={item.slug}
                to={`/industries/${item.slug}`}
                onClick={closeMenu}
              >
                {item.name}
              </Link>
            ))}
            <Link to="/industries" onClick={closeMenu}>
              All industries
            </Link>
          </Dropdown>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={closeMenu}>
              {item.label}
            </NavLink>
          ))}
          <Dropdown
            label="Login"
            open={dropdown === "login"}
            onToggle={toggleLogin}
          >
            <Link to="/advertiser/login" onClick={closeMenu}>Advertiser login</Link>
            <Link to="/publisher/login" onClick={closeMenu}>Publisher login</Link>
          </Dropdown>
          <Link
            className="button button-primary"
            to="/contact"
            onClick={closeMenu}
          >
            Contact
          </Link>
        </nav>
        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "☀" : "◐"}
        </button>
      </div>
    </header>
  );
}
