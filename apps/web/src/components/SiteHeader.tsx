type SiteHeaderProps = {
  currentPage?: 'home' | 'create' | 'sky-lab'
}

export function SiteHeader({ currentPage }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="StarKeepsake home">
        <span className="brand-mark" aria-hidden="true">✦</span>
        StarKeepsake
      </a>
      {currentPage === 'create' ? (
        <a className="header-link" href="/sky-lab">Explore how stars move</a>
      ) : currentPage === 'sky-lab' ? (
        <a className="header-link" href="/create">Back to your frame</a>
      ) : (
        <a className="header-link" href="/create">Begin a keepsake</a>
      )}
    </header>
  )
}
