// Mirrors https://github.com/alexroginski1/stuff_to_do/blob/main/config/settings.py's
// SOURCES dict — synced by hand, so a newly added upstream source won't show
// up here until this list is updated too. "Manually Added Events" has no
// entry on purpose: it's the calendar owner's own curated additions, not a
// scraped site. Disabled sources (settings.py `enabled: False`) are omitted
// since they aren't currently being scraped.
//
// `calendar` matches the stats API's calendar key (its "SF " prefix already
// stripped — see functions/_shared/statsApi.ts), so it lines up with
// EventSourceBreakdown.key without further transformation.
export type EventSourceInfo = {
  label: string
  calendar: string
  url: string
}

export const ALL_EVENT_SOURCES: EventSourceInfo[] = [
  { label: 'The Faight', calendar: 'Arts/Culture', url: 'https://www.thefaight.com/events' },
  { label: 'Decentered Featured Events', calendar: 'Arts/Culture', url: 'https://decentered.org/events' },
  { label: 'SF Funcheap', calendar: 'Fun Cheap', url: 'https://sf.funcheap.com/region/san-francisco/' },
  { label: 'Luma', calendar: 'Tech', url: 'https://luma.com/sf' },
  { label: 'Decentered Community Events', calendar: 'Community', url: 'https://decentered.org/events' },
  {
    label: "Manny's: Community, Politics, and Culture",
    calendar: 'Community',
    url: 'https://www.eventbrite.com/o/mannys-community-politics-and-culture-15114280512',
  },
  { label: 'The SF Nook: SF Event Space', calendar: 'Community', url: 'https://www.thesfnook.com/events' },
  { label: 'Bird & Beckett', calendar: 'Community', url: 'https://birdbeckett.com/events/' },
  {
    label: 'The Moth',
    calendar: 'Community',
    url: 'https://www.themoth.org/tickets/upcoming-events?location=san-francisco-ca',
  },
  { label: 'Salesforce Transit Center', calendar: 'Community', url: 'https://ma.to/venue/transitcentersf' },
  { label: 'The Commons: Third Space', calendar: 'Community', url: 'https://luma.com/thecommons' },
  { label: 'Future of Us', calendar: 'Community', url: 'https://luma.com/future-of-us' },
  { label: 'The SF Contemplarium', calendar: 'Community', url: 'https://luma.com/sfcontemplarium' },
  { label: 'TIAT Art and Tech', calendar: 'Arts/Culture', url: 'https://luma.com/tiat' },
  { label: 'Partiful', calendar: 'Partiful', url: 'https://partiful.com/explore/sf' },
  { label: 'Mox Event Space', calendar: 'Tech', url: 'https://moxsf.com/events' },
  { label: 'Art Bae', calendar: 'Arts/Culture', url: 'https://www.artbae.info/map-calendar' },
  {
    label: 'SF Art Galleries - Openings & Events',
    calendar: 'Arts/Culture',
    url: 'https://calendar.google.com/calendar/embed?src=33alanb%40gmail.com&ctz=America%2FLos_Angeles',
  },
  { label: 'SF Bar Guide', calendar: 'Bars', url: 'https://www.sfbarguide.com/' },
  { label: 'Golden Sardine', calendar: 'Bars', url: 'https://www.goldensardinesf.com/events' },
  { label: 'The Saloon', calendar: 'Bars', url: 'https://ma.to/venue/thesaloonsf' },
  { label: 'The Rite Spot', calendar: 'Bars', url: 'https://ma.to/venue/the_ritespot' },
  { label: 'Arcana', calendar: 'Bars', url: 'https://ma.to/venue/arcanasf' },
  { label: 'Bar Part Time', calendar: 'Bars', url: 'https://ma.to/venue/barparttime' },
  { label: 'Savoy Tivoli', calendar: 'Bars', url: 'https://www.savoytivoli.com/' },
  { label: 'Astronomy on Tap SF', calendar: 'Bars', url: 'https://astronomyontap.org/events/' },
  { label: 'The Makeout Room', calendar: 'Bars', url: 'http://www.makeoutroom.com/' },
  { label: 'Root Division', calendar: 'Arts/Culture', url: 'https://rootdivision.org/gallery/events/' },
  {
    label: 'ARCH Art Supplies: Workshops & Events',
    calendar: 'Arts/Culture',
    url: 'https://shop.archsupplies.com/pages/workshops',
  },
  {
    label: 'Flax: Art & Design',
    calendar: 'Arts/Culture',
    url: 'https://flaxart.com/workshops-events/?srsltid=AfmBOooYfLsyvCosDkqgH2sP92_eUxOztus_wk68Wy-RaVG6U1l6S3zv',
  },
  { label: 'Madrone Art Bar', calendar: 'Bars', url: 'https://www.eventbrite.com/o/madrone-art-bar-33448786911' },
  { label: 'Providence', calendar: 'Bars', url: 'https://www.eventbrite.com/o/36520958623' },
  { label: 'Balboa Cafe', calendar: 'Bars', url: 'https://www.balboacafesf.com/calendar' },
  { label: 'SF Climate Action Club', calendar: 'Community', url: 'https://luma.com/climateactionclub' },
  { label: 'SF Craft Club', calendar: 'Arts/Culture', url: 'https://luma.com/user/sfcraftclub' },
  { label: 'GistIRL: Make Friends and Network', calendar: 'Community', url: 'https://app.gistirl.com/' },
  { label: 'Unplug and Play Collective', calendar: 'Community', url: 'https://www.unplugandplaycollective.com/' },
  {
    label: 'Community Music Hangout',
    calendar: 'Community',
    url: 'https://calendar.google.com/calendar/embed?src=88c5018286c9ab2d0e27326287e61a2b5d42b3ed4008ba650b81f054f65026dd%40group.calendar.google.com&ctz=America%2FLos_Angeles',
  },
  { label: 'Fat Boys Run Club', calendar: 'Exercise', url: 'https://www.heylo.com/g/75ea182e-9df2-4b4d-bc78-a2e299384993' },
  { label: 'Midnight Runners SF', calendar: 'Exercise', url: 'https://www.heylo.com/g/-LmBjhGfivWBeac11cNQ' },
  { label: 'November Project SF', calendar: 'Exercise', url: 'https://www.heylo.com/g/48f5e552-13d3-4987-bd0b-66e8855dfd46' },
  { label: 'Page Street Fit', calendar: 'Exercise', url: 'https://www.heylo.com/g/6e3b8574-b970-4713-995a-1c641daeca26' },
  { label: 'SF Pickup Volleyball', calendar: 'Exercise', url: 'https://www.heylo.com/g/-LsD1YBcDKPOcrsMQ-mT' },
  {
    label: 'San Francisco Beach Volleyball - SFBV',
    calendar: 'Exercise',
    url: 'https://www.heylo.com/g/7b9b7d08-d381-4280-bbc7-612795d40302',
  },
  { label: 'Nob Hill Run Club', calendar: 'Exercise', url: 'https://partiful.com/u/gaH33LxCrvQo0r1F2Y5M' },
  { label: 'GatherSF', calendar: 'Community', url: 'https://partiful.com/u/HoM5CgWY4UxtI5vu9HtU' },
  { label: 'Neighbourgood', calendar: 'Community', url: 'https://partiful.com/u/96zWlHxa9R49qlpyJKO7' },
  { label: 'Studio 203: Figure Drawing', calendar: 'Arts/Culture', url: 'https://www.meetup.com/studio-203-figure-drawing/' },
  { label: 'San Francisco Chess Club', calendar: 'Community', url: 'https://partiful.com/u/98UJpsxnnCr8p7cb77hD' },
  { label: 'Touch Grass Walk Club', calendar: 'Community', url: 'https://partiful.com/u/3Kd8VzusjiFIN0wx4TVs' },
  { label: 'Golden Gate Walk Club', calendar: 'Community', url: 'https://partiful.com/u/Uqyv9rLfCdfoExUq88h9' },
  { label: 'Luz Circle', calendar: 'Community', url: 'https://partiful.com/u/9ysLpxe3H5cOS5cOS0uI' },
  { label: 'Board Games with EGL', calendar: 'Community', url: 'https://www.heylo.com/g/12979145-cf38-42c9-b755-e3a27b458bf9' },
  { label: 'The Web SF', calendar: 'Arts/Culture', url: 'https://www.heylo.com/g/1fda3590-3f27-4ee0-afc1-a63473b8a200' },
  { label: 'Lower Haight Local', calendar: 'Community', url: 'https://www.heylo.com/g/18608def-640e-4bb9-8331-1d28f1908040' },
  { label: 'Sapiens', calendar: 'Community', url: 'https://www.heylo.com/g/b30541ef-38c1-40c6-af55-3d100bf5d93d' },
  { label: 'Bad Art Club', calendar: 'Community', url: 'https://www.eventbrite.com/cc/bad-art-club-4684923' },
  {
    label: 'Founders Running Club San Francisco',
    calendar: 'Tech',
    url: 'https://www.heylo.com/g/1270104d-2bf6-4f8c-ae29-22ef502df080',
  },
  {
    label: "The San Francisco 'Not Quite a Book Club' Book Club",
    calendar: 'Community',
    url: 'https://www.meetup.com/the-san-francisco-not-quite-a-book-club-book-club/',
  },
  {
    label: 'SF Social Mixers and Networking',
    calendar: 'Community',
    url: 'https://www.meetup.com/sf-social-mixers-and-networking/',
  },
  {
    label: '20 & 30-somethings friends & fun in SF',
    calendar: 'Community',
    url: 'https://www.meetup.com/20-somethings-friends-fun-in-sf/',
  },
  {
    label: 'San Francisco Philosophy Reading Group',
    calendar: 'Community',
    url: 'https://www.meetup.com/sf-philosophy-reading-group/',
  },
  { label: 'Music Jam SF', calendar: 'Community', url: 'https://www.meetup.com/meetup-group-dvhbxtfg/' },
  {
    label: 'Global AI Makers • West Coast',
    calendar: 'Tech',
    url: 'https://www.meetup.com/global-ai-makers-san-francisco/',
  },
  {
    label: 'San Francisco Startup Pitch and Networking',
    calendar: 'Tech',
    url: 'https://www.meetup.com/sanfrancisco-startup-pitch-and-networking/',
  },
  { label: 'Bay Area Socials', calendar: 'Community', url: 'https://www.meetup.com/baysocials/' },
  { label: 'Play Games Learn Names', calendar: 'Community', url: 'https://www.meetup.com/san-francisco-game-meetup-group/' },
  { label: 'San Francisco Movie Club', calendar: 'Community', url: 'https://www.meetup.com/sf-movie-club/' },
  { label: 'San Francisco AI Code and Coffee', calendar: 'Tech', url: 'https://www.meetup.com/sf-code-coffee/' },
  { label: 'San Francisco Vegan Society Events', calendar: 'Community', url: 'https://www.meetup.com/sfvegansociety/' },
  { label: 'SF Mission Fun Runs', calendar: 'Community', url: 'https://www.meetup.com/missionfunruns/' },
  {
    label: 'San Francisco Bay Area Blood on the Clocktower',
    calendar: 'Community',
    url: 'https://www.meetup.com/san-francisco-blood-on-the-clocktower/',
  },
  { label: 'San Francisco Artsy Stuff', calendar: 'Arts/Culture', url: 'https://www.meetup.com/meetup-group-glpdmivm/' },
  { label: 'Free Yoga SF', calendar: 'Exercise', url: 'https://www.meetup.com/fitnesssf/' },
  { label: 'Bay Area Social Scene', calendar: 'Community', url: 'https://www.meetup.com/bay-area-social-scene/' },
  { label: 'San Francisco Photographers', calendar: 'Community', url: 'https://www.meetup.com/sf-photo/' },
  { label: 'SF Sketchers', calendar: 'Arts/Culture', url: 'https://www.meetup.com/sf-sketchers/' },
  { label: 'Catch Up', calendar: 'Exercise', url: 'https://www.meetup.com/catch-up/' },
  { label: 'SF Zen Center', calendar: 'Mindfulness', url: 'https://www.sfzc.org/city-center-calendar' },
  {
    label: 'Fort Mason Center for Arts & Culture',
    calendar: 'Arts/Culture',
    url: 'https://www.eventbrite.com/o/20246696685',
  },
  { label: 'A Listers Entertainment', calendar: 'Bars', url: 'https://www.eventbrite.com/o/12913251409' },
  { label: 'Fog City Run', calendar: 'Exercise', url: 'https://www.heylo.com/g/eba0b87a-f4ca-4ff2-bdfb-0d6b4729eb84' },
  { label: 'Presidio Events', calendar: 'Community', url: 'https://presidio.gov/explore/events' },
  { label: 'Dance Fridays', calendar: 'Dancing', url: 'https://www.eventbrite.com/o/dance-fridays-8106527232' },
  { label: 'SFMOMA', calendar: 'Arts/Culture', url: 'https://www.sfmoma.org/events/' },
  { label: 'BATS Improv', calendar: 'Shows', url: 'https://www.eventbrite.com/o/bats-improv-shows-120768857464' },
  { label: "Cobb's Comedy Club", calendar: 'Shows', url: 'https://www.cobbscomedy.com/shows' },
  { label: 'Curiosity Guild', calendar: 'Community', url: 'https://www.eventbrite.com/o/120760437937?aff=web' },
  { label: 'The Setup Comedy', calendar: 'Shows', url: 'https://setupcomedy.com/comedyshow-sanfrancisco' },
  { label: 'Endgames Improv', calendar: 'Shows', url: 'https://www.eventbrite.com/o/1465732808' },
  { label: 'Cheaper Than Therapy', calendar: 'Shows', url: 'https://tickets.cttcomedy.com/events/' },
  { label: '4 Star Theater', calendar: 'Shows', url: 'https://www.4-star-movies.com/' },
  { label: 'Commonwealth Club', calendar: 'Shows', url: 'https://www.commonwealthclub.org/events' },
  { label: 'Boom Boom Room', calendar: 'Bars', url: 'https://boomboomroom.com/events/' },
  { label: 'Wildhawk', calendar: 'Bars', url: 'https://www.wildhawksf.com/happenings' },
  { label: 'White Rabbit', calendar: 'Bars', url: 'https://www.whiterabbitsf.com/calendar' },
  { label: 'Mellow Nights', calendar: 'Shows', url: 'https://nights.themellowsf.com/#calendar' },
  { label: 'The Booksmith', calendar: 'Shows', url: 'https://booksmith.com/events/list/upcoming-events' },
  { label: 'Wave', calendar: 'Community', url: 'https://www.wavecollectivespace.com/community-events' },
  { label: "Stookey's Blue Room", calendar: 'Bars', url: 'https://www.stookeysblueroom.com/musicandevents' },
]

export const EVENT_SOURCE_LINKS: Record<string, string> = Object.fromEntries(
  ALL_EVENT_SOURCES.map((source) => [source.label, source.url])
)
