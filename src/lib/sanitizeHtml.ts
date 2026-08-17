const ALLOWED_TAGS = new Set(['A', 'BR', 'B', 'STRONG', 'I', 'EM'])

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Allowlist-sanitizes event descriptions that may contain raw HTML — some
// calendar sources embed literal <a href="…"> tags in their ICS DESCRIPTION
// field rather than plain text. Only <a href="http(s)://…"> plus a few
// inline text tags survive; everything else is unwrapped to plain text so
// it can be safely rendered via dangerouslySetInnerHTML.
export function sanitizeDescriptionHtml(raw: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(raw)
  }

  const doc = new DOMParser().parseFromString(raw, 'text/html')

  function clean(node: ParentNode) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as HTMLElement

      if (!ALLOWED_TAGS.has(el.tagName)) {
        node.replaceChild(doc.createTextNode(el.textContent ?? ''), el)
        continue
      }

      for (const attr of Array.from(el.attributes)) {
        if (el.tagName === 'A' && attr.name === 'href') continue
        el.removeAttribute(attr.name)
      }

      if (el.tagName === 'A') {
        const href = el.getAttribute('href') ?? ''
        if (!/^https?:\/\//i.test(href)) {
          el.removeAttribute('href')
        } else {
          el.setAttribute('target', '_blank')
          el.setAttribute('rel', 'noopener noreferrer')
          // Calendar sources embed links like "Event Link" or "Source" as
          // plain inline text — buttonize them so they read as tappable
          // actions rather than blending into the description prose.
          el.setAttribute('class', 'std-map-desc-link')
        }
      }

      clean(el)
    }
  }

  clean(doc.body)
  return doc.body.innerHTML
}
