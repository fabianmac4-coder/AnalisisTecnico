import { NEWS_CATEGORIES } from "./newsTypes";
import { useNewsStore } from "./newsStore";

/** Chips de filtro por categoria (clasificacion por reglas en el backend). */
export function NewsFilters() {
  const category = useNewsStore((s) => s.globalCategory);
  const setCategory = useNewsStore((s) => s.setCategory);

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="news-filters">
      {NEWS_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => void setCategory(cat)}
          data-testid={`news-filter-${cat}`}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
            category === cat
              ? "border-accent bg-accent/20 text-accent"
              : "border-edge bg-panel-2 text-muted hover:bg-panel-3 hover:text-gray-200"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
