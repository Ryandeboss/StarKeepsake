import { SiteHeader } from '../components/SiteHeader'

export function LandingPage() {
  return (
    <div className="site-shell">
      <SiteHeader currentPage="home" />
      <main className="landing-content">
        <section className="landing-hero" aria-labelledby="landing-heading">
          <div className="landing-copy">
            <p className="eyebrow">A little piece of forever</p>
            <h1 id="landing-heading">Keep the night you’ll never <em>forget.</em></h1>
            <p>Turn a meaningful moment into a keepsake made to hold the feeling. Start with your story, and we’ll help you picture it under the stars.</p>
            <a className="button-primary" href="/create">Create your preview <span aria-hidden="true">→</span></a>
            <p className="landing-note">Your preview is private and yours to shape.</p>
          </div>

          <div className="landing-artwork-wrap" aria-label="Example StarKeepsake artwork" role="img">
            <div className="landing-artwork">
              <div className="landing-artwork-content">
                <small>the night we said yes</small>
                <strong>Under this sky,<br />always.</strong>
                <span>Joshua Tree · 11.07.24</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
