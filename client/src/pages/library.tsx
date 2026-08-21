import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Book, Search, ExternalLink, X, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DICTIONARY_ENTRIES,
  DICTIONARY_PAGE_MAP,
  type DictionaryEntry,
} from "@shared/living-dictionary";

/**
 * The full work, served as a static file. Deep links use the PDF viewer's
 * #page fragment, so entry numbers land on the right page.
 */
const DICTIONARY_PDF_URL = "/free-soul-living-dictionary.pdf";

function openAt(entryNumber?: string) {
  const page = entryNumber ? DICTIONARY_PAGE_MAP[entryNumber] : undefined;
  window.open(
    page ? `${DICTIONARY_PDF_URL}#page=${page}` : DICTIONARY_PDF_URL,
    "_blank",
    "noopener,noreferrer",
  );
}

function EntryCard({ entry }: { entry: DictionaryEntry }) {
  const page = DICTIONARY_PAGE_MAP[entry.number];
  return (
    <div
      className="glass-panel rounded-2xl p-6 border border-white/5"
      data-testid={`dictionary-entry-${entry.number}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-xs font-mono text-muted-foreground/60 flex-shrink-0">
            {entry.number}
          </span>
          <h3 className="text-lg font-display font-bold break-words">{entry.term}</h3>
        </div>
        {page && (
          <button
            onClick={() => openAt(entry.number)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 flex-shrink-0"
            title={`Open the full work at page ${page}`}
            data-testid={`open-source-${entry.number}`}
          >
            p.{page} <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/50 mb-1 flex items-center gap-1.5">
            <Scale className="w-3 h-3" /> Official
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{entry.official}</p>
        </div>
        <div className="pl-4 border-l-2 border-primary/40">
          <p className="text-[11px] uppercase tracking-wider text-primary/70 mb-1">
            True
          </p>
          <p className="text-sm leading-relaxed">{entry.true_def}</p>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DICTIONARY_ENTRIES;
    return DICTIONARY_ENTRIES.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.official.toLowerCase().includes(q) ||
        e.true_def.toLowerCase().includes(q) ||
        e.number.toLowerCase() === q,
    );
  }, [query]);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Back to the Circle
      </Link>

      <div className="glass-panel rounded-3xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Book className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">The Living Dictionary</h1>
            <p className="text-sm text-muted-foreground">
              Free Soul Ecclesiastical Movement &amp; House of El Tribal Authority
            </p>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed mb-6 max-w-2xl">
          Words are the manifestation of thought. Each of these{" "}
          {DICTIONARY_ENTRIES.length} entries states the official definition and
          the true one, so both stand in the record and either may be examined.
          Every statement is offered as lawful assertion, open to rebuttal
          point-by-point. These are the meanings used throughout the Circle.
        </p>

        <Button
          variant="outline"
          onClick={() => openAt()}
          className="border-primary/30 text-primary hover:bg-primary/10"
          data-testid="button-open-full-work"
        >
          <ExternalLink className="w-4 h-4 mr-2" /> Read the full work
        </Button>
        <p className="text-xs text-muted-foreground/50 mt-3">
          This work is not legal advice.
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search definitions…"
          className="bg-background/50 border-white/10 h-12 pl-11 pr-11"
          data-testid="input-dictionary-search"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            aria-label="Clear search"
            data-testid="button-clear-search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4" data-testid="dictionary-result-count">
        {results.length} of {DICTIONARY_ENTRIES.length} entries
      </p>

      {results.length === 0 ? (
        <div className="p-12 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground">
          <Book className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No entry matches “{query}”.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((entry) => (
            <EntryCard key={entry.number} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
