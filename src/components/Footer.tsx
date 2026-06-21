export default function Footer() {
  return (
    <footer className="border-t border-stone-200 py-6 mt-12 bg-stone-50">
      <div className="max-w-2xl mx-auto px-6 flex gap-6 text-sm text-stone-500">
        <a
          href="https://www.linkedin.com/in/alex-roginski-68b40219a/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-stone-900 transition-colors"
        >
          LinkedIn
        </a>
        <a
          href="mailto:roginskialexr@gmail.com"
          className="hover:text-stone-900 transition-colors"
        >
          roginskialexr@gmail.com
        </a>
      </div>
    </footer>
  )
}
