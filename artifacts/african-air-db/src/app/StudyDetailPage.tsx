import { ArrowLeft, MapPin, CalendarRange, FlaskConical, Quote, ExternalLink } from "lucide-react";
import { Chem } from "./utils/chemFormat";
import { getStudyById, getPollutants } from "./services/studyService";
import { useAsync } from "./hooks/useData";
import { useMemo } from "react";

interface Props {
  studyId: string;
  onBack: () => void;
  onNavigateToCountry: (country: string) => void;
}

export default function StudyDetailPage({ studyId, onBack, onNavigateToCountry }: Props) {
  const { data: study, loading } = useAsync(() => getStudyById(studyId), [studyId]);
  const { data: pollutants } = useAsync(getPollutants);

  const pollutantDict = useMemo(() => {
    if (!pollutants) return new Map<string, { name: string; category: string }>();
    return new Map(pollutants.map(p => [p.key, { name: p.name, category: p.category }]));
  }, [pollutants]);

  // Unique pollutants across all records, sorted by category → name
  const pollutantChips = useMemo(() => {
    if (!study) return [];
    const seen = new Set<string>();
    const chips: { key: string; name: string; category: string }[] = [];
    for (const record of study.records) {
      for (const key of Object.keys(record.measurements)) {
        if (!seen.has(key)) {
          seen.add(key);
          const p = pollutantDict.get(key);
          chips.push({ key, name: p?.name ?? key, category: p?.category ?? "" });
        }
      }
    }
    return chips.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [study, pollutantDict]);

  // Unique study areas
  const areas = useMemo(() => {
    if (!study) return [];
    const seen = new Set<string>();
    return study.records
      .map(r => r.studyArea)
      .filter((a): a is string => !!a && !seen.has(a) && !!seen.add(a));
  }, [study]);

  // Unique environment settings
  const settings = useMemo(() => {
    if (!study) return [];
    const seen = new Set<string>();
    return study.records
      .map(r => r.description)
      .filter((d): d is string => !!d && !seen.has(d) && !!seen.add(d));
  }, [study]);

  if (loading || !study) return null;

  const displayTitle = study.title || study.source || "Untitled Study";
  const authorDisplay = study.author || study.source;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#F7F9FC]">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">Study</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

          {/* Title + citation */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h1 className="text-base font-bold text-foreground leading-snug">{displayTitle}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {authorDisplay && (
                <span className="flex items-center gap-1">
                  <Quote size={11} />
                  {authorDisplay}
                </span>
              )}
              {study.journal && (
                <span className="italic">{study.journal}</span>
              )}
              {study.identifier && (
                <a
                  href={study.identifier}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Source <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* Location | Years */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <MapPin size={12} className="text-primary" />
                Location
              </div>
              <div className="text-sm text-foreground font-medium">{study.country}</div>
              {study.region && (
                <div className="text-xs text-muted-foreground mt-0.5">{study.region}</div>
              )}
              {areas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {areas.map(a => (
                    <span key={a} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{a}</span>
                  ))}
                </div>
              )}
              <button
                onClick={() => onNavigateToCountry(study.country)}
                className="mt-2 text-[11px] text-primary font-medium hover:underline"
              >
                View on map →
              </button>
            </div>

            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <CalendarRange size={12} className="text-primary" />
                Period
              </div>
              <div className="text-sm text-foreground font-medium">
                {study.yearFrom}
                {study.yearTo && study.yearTo !== study.yearFrom ? `–${study.yearTo}` : ""}
              </div>
              {settings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {settings.map(s => (
                    <span key={s} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pollutants */}
          {pollutantChips.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                <FlaskConical size={12} className="text-primary" />
                Pollutants Measured ({pollutantChips.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pollutantChips.map(p => (
                  <span
                    key={p.key}
                    className="inline-flex items-center rounded-md bg-primary/8 border border-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    <Chem name={p.name} />
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
