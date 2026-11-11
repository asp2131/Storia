"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const WEB_APP_URL = "https://app.loratone.com/#/intro";

const NAV_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#about", label: "About us" },
  { href: "/#start", label: "For schools & SLPs" },
];

export function SiteNav({ solid = false }: { solid?: boolean }) {
  // ponytail: native <dialog> + showModal() gives Esc-to-close and inerts the page behind it
  const menuRef = useRef<HTMLDialogElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => menuRef.current?.close();

  return (
    <nav className={solid ? "storia-nav scrolled" : "storia-nav"}>
      <Link href="/" className="wordmark">
        <span className="dot">
          <Image src="/storia-landing/logo-headshot.png" alt="" width={32} height={32} />
        </span>
        <span>loratone</span>
      </Link>
      <div className="links">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        <Link href="/whats-new" className="nav-news">
          <span className="nav-news-dot" aria-hidden="true" />
          What&apos;s new
        </Link>
        <a className="cta" href={WEB_APP_URL} target="_blank" rel="noopener noreferrer">
          Try Loratone
        </a>
        <button
          type="button"
          className="nav-menu-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => {
            menuRef.current?.showModal();
            setMenuOpen(true);
          }}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <dialog
        id="site-menu"
        ref={menuRef}
        className="nav-sheet"
        aria-label="Site menu"
        onClose={() => setMenuOpen(false)}
      >
        <button type="button" className="nav-sheet-close" aria-label="Close menu" onClick={closeMenu}>
          ×
        </button>
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={closeMenu}>
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/whats-new" onClick={closeMenu}>
              What&apos;s new
            </Link>
          </li>
          <li>
            <a href={WEB_APP_URL} target="_blank" rel="noopener noreferrer" onClick={closeMenu}>
              Try Loratone
            </a>
          </li>
        </ul>
      </dialog>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="storia-footer">
      <div className="footer-inner">
        <span>© 2026 Loratone, Inc. · Made in New Orleans</span>
        <div className="footer-links">
          <Link href="/whats-new">What&apos;s new</Link>
          <Link href="/privacy-policy">Privacy</Link>
          <a href="mailto:hello@loratone.kids">Contact</a>
          <a href={WEB_APP_URL} target="_blank" rel="noopener noreferrer">Try it now!</a>
        </div>
      </div>
    </footer>
  );
}
