import { db } from "@/lib/server/db";
import { announcements, certificates, flyers, notices } from "@/data/content";
import { articles } from "@/data/articles";
import { books } from "@/data/books";
import { clinics } from "@/data/clinics";
import { events } from "@/data/events";
import { videos } from "@/data/videos";
import { faqCategories, galleryItems, homeFaqs, partners, testimonials } from "@/data/site";
import { DEFAULT_BANNERS, DEFAULT_SETTINGS } from "@/lib/cms/defaults";

const SEED_KEY = "seed:v1";

type Row = { collection: string; data: Record<string, unknown>; status: string };

function seedRows(): Row[] {
  const rows: Row[] = [];
  const add = (collection: string, list: object[], status = "published") =>
    list.forEach((data) => rows.push({ collection, data: data as Record<string, unknown>, status }));

  add("banners", DEFAULT_BANNERS);
  add("announcements", announcements);
  add("notices", notices);
  add("flyers", flyers);
  add("articles", articles);
  add("videos", videos);
  add("clinics", clinics);
  add("products", books);
  add("certificates", certificates, "valid");
  add("testimonials", testimonials);
  add("partners", partners.map((name) => ({ name })));
  add("gallery", galleryItems);
  const homeQuestions = new Set(homeFaqs.map((q) => q.question));
  add(
    "faqs",
    faqCategories.flatMap((cat) =>
      cat.items.map((item) => ({ ...item, category: cat.title, showOnHome: homeQuestions.has(item.question) }))
    )
  );
  for (const event of events) {
    const { speakers = [], schedule = [], ...rest } = event;
    add("events", [rest]);
    add("speakers", speakers.map((s) => ({ ...s, eventSlug: event.slug })));
    add("schedule", schedule.map((s) => ({ ...s, eventSlug: event.slug })));
  }
  return rows;
}

export async function runSeed() {
  const sql = await db();
  const done = await sql`select 1 from vgmf.settings where key = ${SEED_KEY}`;
  if (done.length) return;
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(420260929)`;
    const again = await tx`select 1 from vgmf.settings where key = ${SEED_KEY}`;
    if (again.length) return;
    const rows = seedRows();
    let order = 0;
    let last = "";
    for (const row of rows) {
      order = row.collection === last ? order + 1 : 0;
      last = row.collection;
      await tx`insert into vgmf.items (collection, data, status, sort_order)
        values (${row.collection}, ${tx.json(row.data as never)}, ${row.status}, ${order})`;
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await tx`insert into vgmf.settings (key, value) values (${key}, ${tx.json(value as never)}) on conflict (key) do nothing`;
    }
    await tx`insert into vgmf.settings (key, value) values (${SEED_KEY}, ${tx.json({ at: new Date().toISOString() } as never)})`;
  });
}
