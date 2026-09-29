import Link from "next/link";
import type { Book } from "@/types";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { formatCurrency } from "@/lib/utils";

export default function BookCard({ book }: { book: Book }) {
  return (
    <article className="card group flex h-full flex-col overflow-hidden">
      <Link href={`/shop/${book.slug}`} className="block overflow-hidden [&>div]:transition [&>div]:duration-700 group-hover:[&>div]:scale-105">
        <MediaPlaceholder
          variant="book"
          label={book.title}
          src={book.coverImage}
          aspectClassName="aspect-[4/5]"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {book.category}
        </p>

        <h3 className="mt-1 text-[13px] font-semibold leading-snug text-text-primary">
          <Link
            href={`/shop/${book.slug}`}
            className="line-clamp-2 transition hover:text-burgundy"
          >
            {book.title}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-[11px] text-text-muted">{book.author}</p>

        {book.rating ? (
          <p className="mt-1 text-[11px] text-text-muted">
            <span className="font-semibold text-amber-500">
              ★ {book.rating.toFixed(1)}
            </span>
            {" "}· {book.reviewCount ?? 0}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <div>
            <p className="text-sm font-bold text-burgundy">
              {formatCurrency(book.price, book.currency)}
            </p>
            <p className="truncate text-[10px] text-text-muted">{book.availability}</p>
          </div>
          <Link
            href={`/shop/${book.slug}`}
            className="btn-outline shrink-0 px-2.5 py-1 text-[11px]"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}