import Link from "next/link";
import type { Book } from "@/types";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { formatCurrency } from "@/lib/utils";

export default function BookCard({ book }: { book: Book }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/shop/${book.slug}`} className="block">
        <MediaPlaceholder
          variant="book"
          label={book.title}
          src={book.coverImage}
          aspectClassName="aspect-[3/4]"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {book.category}
        </p>

        <h3 className="mt-1 text-sm font-semibold leading-snug text-text-primary">
          <Link
            href={`/shop/${book.slug}`}
            className="line-clamp-2 transition hover:text-burgundy"
          >
            {book.title}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-xs text-text-muted">{book.author}</p>

        {book.rating ? (
          <p className="mt-1 text-xs text-text-muted">
            <span className="font-semibold text-amber-500">
              ★ {book.rating.toFixed(1)}
            </span>
            {" "}· {book.reviewCount ?? 0} ratings
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-sm font-bold text-burgundy">
              {formatCurrency(book.price, book.currency)}
            </p>
            <p className="text-[11px] text-text-muted">{book.availability}</p>
          </div>
          <Link
            href={`/shop/${book.slug}`}
            className="btn-outline px-3 py-1.5 text-xs"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}