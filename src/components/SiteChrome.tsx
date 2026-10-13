import Image from "next/image";
import Link from "next/link";

const WEB_APP_URL = "https://app.loratone.com/#/intro";

export function SiteNav({ solid = false }: { solid?: boolean }) {
  return (
    <nav className={solid ? "storia-nav scrolled" : "storia-nav"}>
      <Link href="/" className="wordmark">
        <span className="dot">
          <Image src="/storia-landing/logo-headshot.png" alt="" width={32} height={32} />
        </span>
        <span>loratone</span>
      </Link>
      <div className="links">
        <Link href="/#mission">Why we built this</Link>
        <Link href="/#how">How it works</Link>
        <Link href="/#stories">Stories</Link>
        <Link href="/#community">Our story</Link>
        <a href={WEB_APP_URL} target="_blank" rel="noopener noreferrer">Try it now!</a>
      </div>
      <div className="nav-right">
        <Link href="/whats-new" className="nav-news">
          <span className="nav-news-dot" aria-hidden="true" />
          What&apos;s new
        </Link>
        <Link className="cta" href="/#download">
          Download
        </Link>
      </div>
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
