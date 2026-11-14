import { useRef } from 'react'
import calendar from '../assets/calendar.webp'
import cropsShot from '../assets/cropsShot.webp'
import drop from '../assets/drop.webp'
import field from '../assets/field.webp'
import fieldSmall from '../assets/field-1086.webp'
import guidebook from '../assets/guidebook.webp'
import reportShot from '../assets/reportShot.webp'
import salakot from '../assets/salakot.webp'
import sprout from '../assets/sprout.webp'
import sun from '../assets/sun.webp'
import thermometer from '../assets/thermometer.webp'
import weatherShot from '../assets/weatherShot.webp'
import { LandingHeader } from '../components/LandingHeader'
import { MapCta } from '../components/MapCta'
import { useReveal } from '../hooks/useReveal'
import './landing.css'

/* The landing page (from artifacts/landing-2026-11-13/landing.html): a big centered headline with
   icons in the words and no navbar until you scroll past it, the watercolor rice field under it,
   then each feature in turn. Every "Open the map" goes to /map. */
export function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useReveal(rootRef)

  return (
    <div data-name="Landing" ref={rootRef}>
      <a className="skip" href="#main">Skip to content</a>
      <LandingHeader titleRef={titleRef} />

      <main id="main">
        <span id="top" />

        <section className="hero">
          <div className="wrap">
            <a className="hero-brand" href="#top" aria-label="Ani home"><span className="brand" /></a>
            <h1 className="h1" ref={titleRef}>
              Harvest <img className="hi" src={sprout} alt="" /> tomorrow,<br />
              <img className="hi" src={drop} alt="" /> planned <img className="hi" src={sun} alt="" /> today
            </h1>
            <p className="lede">NASA's rain, heat and soil data for your place, in plain words. See the months ahead and what to plant.</p>
            <div className="acts"><MapCta /></div>
          </div>
          <img className="field" src={field} srcSet={`${fieldSmall} 1086w, ${field} 2172w`} sizes="100vw" width="2172" height="484" fetchPriority="high" alt="A watercolor rice field: a farmer ploughs with his carabao, a couple plants rice seedlings, and three children run along the dike." />
        </section>

        <section className="sec">
          <div className="col center">
            <h2 className="h3 rv" data-rv>Built for the farm, <img className="hi hat" src={salakot} loading="lazy" alt="" /> not just the forecast.</h2>
            <ul className="trio rv" data-rv>
              <li><b>Free</b>Nothing to pay.</li>
              <li><b>No sign up</b>No account, no email.</li>
              <li><b>NASA data</b>Rain, heat and soil since 1981.</li>
            </ul>
          </div>
        </section>

        <section className="sec" id="weather">
          <div className="col">
            <div className="rv" data-rv>
              <p className="eyebrow">Weather</p>
              <h2 className="h2">Rain, heat and soil,<br />on one map.</h2>
              <p className="lede">Pick your place and your dates, up to three years ahead. Then play the months one by one and watch the land change colour.</p>
            </div>
            <ul className="feats rv" data-rv>
              <li>Rain</li><li>Heat</li><li>Soil</li><li>Humidity</li><li>Sun</li><li>Plants</li>
            </ul>
            <div className="panel rv" data-rv>
              <img className="shot" src={weatherShot} width="2048" height="1280" loading="lazy" alt="The Ani map with the rain layer on over Luzon, and the Weather sidebar for a place in Nueva Ecija: your dates, rain, heat, soil and plants." />
            </div>
          </div>
        </section>

        <section className="sec" id="plant">
          <div className="col">
            <div className="center rv" data-rv>
              <p className="eyebrow">What to plant</p>
              <h2 className="h2">The crops that fit your season.</h2>
              <p className="lede">Every crop is checked against the rain and heat ahead, so you can see what to plant and when.</p>
            </div>
            <div className="bento">
              <div className="c2">
                <article className="card rv" data-rv style={{ background: 'var(--mint-200)' }}>
                  <h3 className="h3">14 crops</h3>
                  <p>Rice, corn, cassava, banana and more. Each one rated for planting now.</p>
                  <img className="side" src={cropsShot} width="444" height="830" loading="lazy" alt="The Crops panel: crops grouped into Plant now, With care and Wait, each with a photo, a 1 to 5 rating and when to harvest." />
                </article>
                <article className="card short rv" data-rv style={{ background: 'var(--mist-200)' }}>
                  <h3 className="h3">Rain and heat, checked</h3>
                  <p>Each growing month is held up against what the crop needs.</p>
                  <img className="big" src={thermometer} loading="lazy" alt="" />
                </article>
              </div>
              <div className="c2">
                <article className="card short rv" data-rv style={{ background: 'var(--lime-200)' }}>
                  <h3 className="h3">The best month to plant</h3>
                  <p>The month to plant inside your dates, and the month it's ready.</p>
                  <img className="big" src={calendar} loading="lazy" alt="" />
                </article>
                <article className="card tall rv" data-rv style={{ background: 'var(--sand-50)' }}>
                  <h3 className="h3">A growing guide</h3>
                  <p>Eight short topics for each crop, from getting the land ready to the harvest.</p>
                  <img className="big" src={guidebook} loading="lazy" alt="" />
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="report">
          <div className="col">
            <div className="rv" data-rv>
              <p className="eyebrow">Full report</p>
              <h2 className="h2">Your place and your season, on one page.</h2>
              <p className="lede">The short answer first. Then what's ahead, your best moves and the farm work for each month.</p>
            </div>
            <ul className="feats rv" data-rv>
              <li>The short answer</li><li>Looking ahead</li><li>Month by month</li>
              <li>Best moves</li><li>What to plant</li><li>Farm work by month</li>
            </ul>
            <div className="panel rv" data-rv>
              <img className="shot" src={reportShot} width="2048" height="1280" loading="lazy" alt="The full report in Ani: the short answer says rice is your best chance this year, then a season bar and right now." />
            </div>
          </div>
        </section>

        <section className="sec ready">
          <div className="col center">
            <h2 className="h3 rv" data-rv>Plan the season before it starts. <span className="soft">Ready for the next planting?</span></h2>
            <ul className="four rv" data-rv>
              <li><b>Free</b>Nothing held back.</li>
              <li><b>No sign up</b>Just pick your place.</li>
              <li><b>Any place</b>Search or use your location.</li>
              <li><b>Plain words</b>For every number.</li>
            </ul>
            <MapCta />
          </div>
        </section>
      </main>

      <footer>
        <div className="col">
          <div className="ft">
            <div className="ft-brand">
              <a href="#top" aria-label="Ani home"><span className="brand" /></a>
              <p>Harvest tomorrow, planned today</p>
            </div>
            <nav className="ft-nav" aria-label="Footer">
              <div><h3>Ani</h3><ul><li><a href="#weather">Weather</a></li><li><a href="#plant">What to plant</a></li><li><a href="#report">Full report</a></li></ul></div>
              <div><h3>Legal</h3><ul><li><a href="#top">Terms of service</a></li></ul></div>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
