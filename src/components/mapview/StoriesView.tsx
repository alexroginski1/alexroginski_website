// "Our Stories" — an embedded Google Form for submissions. Responses land
// directly in the linked Google Sheet; there's no site-side database or
// moderation queue, so stories aren't displayed back on the site.
const STORY_FORM_EMBED_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScRiuI8iFmpQKyQwSsiDeaMWOnrQht_Kv4XmFhlgFTT7kyGyw/viewform?embedded=true'

export default function StoriesView() {
  return (
    <div className="stories-view">
      <div className="stories-header">
        <h2 className="stories-title">Our Stories</h2>
        <p className="stories-tagline">Tales of people finding stuff to do on this site : )</p>
      </div>
      <iframe
        src={STORY_FORM_EMBED_URL}
        className="stories-form-iframe"
        title="Submit a story"
      >
        Loading…
      </iframe>
    </div>
  )
}
