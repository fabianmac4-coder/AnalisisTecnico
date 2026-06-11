import type { NewsItemDto } from "./newsTypes";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Tarjeta de noticia: titulo, fuente, hora, categoria y link externo. */
export function NewsCard({ item }: { item: NewsItemDto }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`news-card-${item.id}`}
      className="block rounded border border-edge bg-panel-2 p-3 transition-colors hover:border-accent/60 hover:bg-panel-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-gray-100">{item.title}</p>
        <span aria-hidden className="text-muted">
          ↗
        </span>
      </div>
      {item.summary && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-400">{item.summary}</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
        {item.publisher && <span className="font-medium">{item.publisher}</span>}
        <span>{timeAgo(item.publishedAt)}</span>
        {item.category && (
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-accent">
            {item.category}
          </span>
        )}
        <span className="rounded bg-panel-3 px-1.5 py-0.5">{item.provider}</span>
      </div>
    </a>
  );
}
