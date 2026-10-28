type SiteHeaderProps = {
  currentPage?: 'home' | 'create'
}

export function SiteHeader({ currentPage }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="StarKeepsake home">
        <span className="brand-mark" aria-hidden="true">✦</span>
        StarKeepsake
      </a>
      {currentPage === 'create' ? (
        <a className="header-link" href="/">Back to home</a>
      ) : (
        <a className="header-link" href="/create">Begin a keepsake</a>
      )}
    </header>
  )
}
