"use client";

import { useMemo, useRef, useState } from "react";
import {
  deleteCategory,
  deleteProduct,
  generateBarcode,
  generateProductCode,
  generateSku,
  getCategories,
  isProductCodeTaken,
  isSkuTaken,
  pendingStockAlerts,
  restockProduct,
  saveCategory,
  saveProduct,
  stockLevel,
  updateStock,
} from "@/lib/product-data";
import { useAllProducts } from "@/lib/use-cms";
import { fileToStoredUrl } from "@/lib/images";
import type { AdminCategory, Book, ProductMedia, PublisherInfo } from "@/types";
import {
  Button,
  EmptyState,
  Field,
  Panel,
  SelectInput,
  TextArea,
  TextInput,
  formatINR,
} from "@/components/admin/AdminUI";
import { GalleryField, ImageField } from "@/components/admin/ImageField";
import type { CaptionedImage } from "@/types";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

const blankPublisher = (): PublisherInfo => ({
  name: "Vaidya Gogate Memorial Foundation Publications",
  address: "FC Road, Shivaji Nagar, Pune 411005, Maharashtra",
  phone: "+91 20 1234 5678",
  email: "publications@vaidyagogate.org",
});

function blankProduct(): Book {
  return {
    id: `bks-${Date.now()}`,
    title: "",
    slug: "",
    author: "Vaidya Gogate Memorial Foundation",
    description: "",
    isbn: "",
    sku: "",
    productCode: "",
    barcode: "",
    pages: 0,
    language: "English",
    binding: "Paperback",
    price: 0,
    originalPrice: 0,
    currency: "INR",
    coverImage: "",
    stock: 0,
    stockStatus: "out_of_stock",
    availability: "Out of Stock",
    preorder: { enabled: false, releaseDate: "", limit: 0, note: "" },
    category: "Clinical",
    edition: "",
    publishedYear: new Date().getFullYear(),
    publisher: blankPublisher(),
    licenses: [{ label: "ISBN", value: "" }],
    media: [],
    specifications: [],
    weightKg: 0.5,
    active: true,
    openBoxDelivery: true,
    storePickupAvailable: true,
    deliveryAvailable: true,
    countryOfOrigin: "India",
  };
}

export function ProductsSection() {
  const books = useAllProducts();
  const [editedId, setEditedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [restockQty, setRestockQty] = useState<Record<string, string>>({});
  const [stockNote, setStockNote] = useState("");

  const shown = books.filter((book) => {
    const q = query.trim().toLowerCase();
    const match =
      !q ||
      [book.title, book.sku, book.productCode, book.isbn, book.author, book.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    if (!match) return false;
    if (filter === "in") return stockLevel(book) === "in" || stockLevel(book) === "low";
    if (filter === "out") return stockLevel(book) === "out" && !book.preorder?.enabled;
    if (filter === "preorder") return Boolean(book.preorder?.enabled);
    if (filter === "draft") return book.active === false;
    return true;
  });

  const editing = creating ? blankProduct() : books.find((book) => book.id === editedId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Product management</h1>
          <p className="text-sm text-text-muted">
            Add images, videos, ISBN and licences, publisher details, generate SKU and product code, then set stock or pre-order.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setEditedId(null);
          }}
        >
          + Create product
        </Button>
      </div>

      {editing && (
        <ProductEditor
          key={creating ? "new" : editing.id}
          book={editing}
          isNew={creating}
          onDone={() => {
            setCreating(false);
            setEditedId(null);
          }}
        />
      )}

      <Panel title={`Catalogue (${shown.length})`} description="Click a title to edit. Changes publish to the shop immediately.">
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <TextInput placeholder="Search title, SKU, ISBN, product code" value={query} onChange={(event) => setQuery(event.target.value)} />
          <SelectInput value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All products</option>
            <option value="in">In stock</option>
            <option value="out">Out of stock</option>
            <option value="preorder">Pre-order</option>
            <option value="draft">Hidden from shop</option>
          </SelectInput>
        </div>
        {shown.length === 0 ? (
          <EmptyState text="No products match." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                  <th className="py-2 pr-3">Product</th>
                  <th className="px-3">SKU / code</th>
                  <th className="px-3">Price</th>
                  <th className="px-3">Stock</th>
                  <th className="px-3">Category</th>
                  <th className="px-3">Status</th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((book) => {
                  const level = stockLevel(book);
                  const waiting = pendingStockAlerts(book.id).length;
                  return (
                    <tr key={book.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <button type="button" onClick={() => { setCreating(false); setEditedId(editedId === book.id ? null : book.id); }} className="text-left font-semibold text-text-primary hover:text-burgundy">
                          {book.title || "Untitled"}
                        </button>
                        <p className="text-xs text-text-muted">{book.publisher?.name ?? book.author}</p>
                      </td>
                      <td className="px-3 font-mono text-xs">
                        <p>{book.sku || "—"}</p>
                        <p className="text-text-muted">{book.productCode || "—"}</p>
                      </td>
                      <td className="px-3 font-medium">{formatINR(book.price)}</td>
                      <td className="px-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            className="w-20 rounded-lg border border-border px-2 py-1 text-sm"
                            defaultValue={book.stock}
                            key={`${book.id}-${book.stock}`}
                            onBlur={(event) => {
                              const next = Math.max(0, Math.floor(Number(event.target.value)));
                              if (next !== book.stock) updateStock(book.id, next);
                            }}
                            aria-label={`On-hand stock for ${book.title}`}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="+qty"
                            className="w-16 rounded-lg border border-border px-2 py-1 text-sm"
                            value={restockQty[book.id] ?? ""}
                            onChange={(event) => setRestockQty((current) => ({ ...current, [book.id]: event.target.value }))}
                            aria-label={`Restock ${book.title}`}
                          />
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const add = Math.max(0, Math.floor(Number(restockQty[book.id] || 0)));
                              if (!add) return;
                              restockProduct(book.id, add);
                              setRestockQty((current) => ({ ...current, [book.id]: "" }));
                              setStockNote(`${book.title}: added ${add} units.`);
                            }}
                          >
                            Restock
                          </Button>
                        </div>
                        {waiting > 0 && <p className="text-[11px] text-amber-700">{waiting} waiting for restock</p>}
                        {stockNote.includes(book.title) && <p className="text-[11px] text-emerald-700">{stockNote}</p>}
                      </td>
                      <td className="px-3 text-text-muted">{book.category}</td>
                      <td className="px-3">
                        {book.active === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Hidden</span>}
                        {book.active !== false && level === "in" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">In stock</span>}
                        {book.active !== false && level === "low" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Low</span>}
                        {book.active !== false && level === "out" && book.preorder?.enabled && <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[11px] font-bold text-burgundy">Pre-order</span>}
                        {book.active !== false && level === "out" && !book.preorder?.enabled && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">Out</span>}
                      </td>
                      <td className="px-3 text-right">
                        <Button variant="ghost" onClick={() => { setCreating(false); setEditedId(editedId === book.id ? null : book.id); }}>
                          {editedId === book.id ? "Close" : "Edit"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CategoriesPanel />
    </div>
  );
}

function ProductEditor({ book, isNew, onDone }: { book: Book; isNew: boolean; onDone: () => void }) {
  const categories = getCategories();
  const [form, setForm] = useState<Book>(() => ({
    ...blankProduct(),
    ...book,
    publisher: { ...blankPublisher(), ...book.publisher },
    preorder: { enabled: false, releaseDate: "", limit: 0, note: "", ...book.preorder },
    licenses: book.licenses?.length ? book.licenses : [{ label: "ISBN", value: book.isbn ?? "" }],
    media: book.media ?? [],
  }));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const set = (patch: Partial<Book>) => setForm((current) => ({ ...current, ...patch }));

  const gallery: CaptionedImage[] = useMemo(
    () => (form.media ?? []).filter((item) => item.type === "image").map((item) => ({ src: item.src ?? "", caption: item.label })),
    [form.media]
  );
  const videos = (form.media ?? []).filter((item) => item.type === "video");

  const setGallery = (images: CaptionedImage[]) => {
    const nextVideos = (form.media ?? []).filter((item) => item.type === "video");
    const nextImages: ProductMedia[] = images.filter((image) => image.src).map((image, index) => ({
      type: "image",
      src: image.src,
      label: image.caption || `Image ${index + 1}`,
    }));
    set({ media: [...nextImages, ...nextVideos], coverImage: nextImages[0]?.src || form.coverImage });
  };

  const save = () => {
    if (!form.title.trim()) return setError("Add a title.");
    if (!form.price || form.price < 0) return setError("Add a selling price.");
    const sku = (form.sku ?? "").trim() || generateSku(form.category, form.id);
    const productCode = (form.productCode ?? "").trim() || generateProductCode(form.id);
    if (isSkuTaken(sku, form.id)) return setError(`SKU ${sku} is already used.`);
    if (isProductCodeTaken(productCode, form.id)) return setError(`Product code ${productCode} is already used.`);
    const isbn = (form.licenses ?? []).find((item) => item.label.toLowerCase() === "isbn")?.value || form.isbn;
    const inStock = form.stockStatus === "in_stock";
    const stock = inStock ? Math.max(0, Math.floor(form.stock)) : 0;
    if (inStock && stock < 1) return setError("In-stock products need a quantity of at least 1.");
    const record: Book = {
      ...form,
      title: form.title.trim(),
      slug: form.slug || slugify(form.title),
      sku,
      productCode,
      barcode: form.barcode || generateBarcode(),
      isbn: isbn || undefined,
      stock,
      stockStatus: inStock ? "in_stock" : "out_of_stock",
      preorder: form.preorder?.enabled ? form.preorder : { enabled: false },
      licenses: (form.licenses ?? []).filter((item) => item.value.trim()),
      media: (form.media ?? []).filter((item) => item.src),
      coverImage: form.coverImage || (form.media ?? []).find((item) => item.type === "image")?.src,
      specifications: [
        { label: "SKU", value: sku },
        { label: "Product code", value: productCode },
        ...(isbn ? [{ label: "ISBN", value: isbn }] : []),
        ...(form.edition ? [{ label: "Edition", value: form.edition }] : []),
        ...(form.pages ? [{ label: "Pages", value: String(form.pages) }] : []),
        ...(form.binding ? [{ label: "Binding", value: form.binding }] : []),
        ...(form.language ? [{ label: "Language", value: form.language }] : []),
        ...(form.publisher?.name ? [{ label: "Publisher", value: form.publisher.name }] : []),
      ],
    };
    try {
      saveProduct(record);
    } catch {
      setError("The browser storage is full. Use smaller images or image URLs.");
      return;
    }
    setError("");
    setSaved(record.slug);
  };

  return (
    <Panel
      title={isNew ? "Create product" : `Edit — ${book.title}`}
      description="Images and videos, licences, publisher, generated SKU, then stock."
      action={saved ? <span className="text-sm font-semibold text-emerald-700">Saved ✓</span> : undefined}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Field label="Title">
            <TextInput value={form.title} onChange={(event) => set({ title: event.target.value, slug: isNew ? slugify(event.target.value) : form.slug })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Author"><TextInput value={form.author} onChange={(event) => set({ author: event.target.value })} /></Field>
            <Field label="Category">
              <SelectInput value={form.category} onChange={(event) => set({ category: event.target.value })}>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Edition"><TextInput value={form.edition ?? ""} onChange={(event) => set({ edition: event.target.value })} /></Field>
            <Field label="Published year"><TextInput type="number" value={form.publishedYear ?? ""} onChange={(event) => set({ publishedYear: Number(event.target.value) || undefined })} /></Field>
            <Field label="Pages"><TextInput type="number" value={form.pages || ""} onChange={(event) => set({ pages: Number(event.target.value) || undefined })} /></Field>
            <Field label="Binding"><TextInput value={form.binding ?? ""} onChange={(event) => set({ binding: event.target.value })} /></Field>
            <Field label="Language"><TextInput value={form.language ?? ""} onChange={(event) => set({ language: event.target.value })} /></Field>
            <Field label="Weight (kg)"><TextInput type="number" step="0.1" value={form.weightKg ?? 0.5} onChange={(event) => set({ weightKg: Number(event.target.value) })} /></Field>
          </div>
          <Field label="Description">
            <TextArea rows={5} value={form.description} onChange={(event) => set({ description: event.target.value })} />
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Licences & identifiers</p>
            <div className="space-y-2">
              {(form.licenses ?? []).map((license, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                  <TextInput placeholder="ISBN / FSSAI / AYUSH…" value={license.label} onChange={(event) => set({ licenses: (form.licenses ?? []).map((item, i) => (i === index ? { ...item, label: event.target.value } : item)) })} />
                  <TextInput placeholder="Code" value={license.value} onChange={(event) => set({ licenses: (form.licenses ?? []).map((item, i) => (i === index ? { ...item, value: event.target.value } : item)) })} />
                  <Button variant="ghost" onClick={() => set({ licenses: (form.licenses ?? []).filter((_, i) => i !== index) })}>Remove</Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => set({ licenses: [...(form.licenses ?? []), { label: "", value: "" }] })}>+ Add licence</Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Publisher</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><TextInput value={form.publisher?.name ?? ""} onChange={(event) => set({ publisher: { name: event.target.value, address: form.publisher?.address, phone: form.publisher?.phone, email: form.publisher?.email, website: form.publisher?.website } })} /></Field>
              <Field label="Email"><TextInput value={form.publisher?.email ?? ""} onChange={(event) => set({ publisher: { name: form.publisher?.name ?? "", address: form.publisher?.address, phone: form.publisher?.phone, email: event.target.value, website: form.publisher?.website } })} /></Field>
              <Field label="Phone"><TextInput value={form.publisher?.phone ?? ""} onChange={(event) => set({ publisher: { name: form.publisher?.name ?? "", address: form.publisher?.address, phone: event.target.value, email: form.publisher?.email, website: form.publisher?.website } })} /></Field>
              <Field label="Website"><TextInput value={form.publisher?.website ?? ""} onChange={(event) => set({ publisher: { name: form.publisher?.name ?? "", address: form.publisher?.address, phone: form.publisher?.phone, email: form.publisher?.email, website: event.target.value } })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Address"><TextInput value={form.publisher?.address ?? ""} onChange={(event) => set({ publisher: { name: form.publisher?.name ?? "", address: event.target.value, phone: form.publisher?.phone, email: form.publisher?.email, website: form.publisher?.website } })} /></Field>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ImageField label="Cover image" value={form.coverImage} onChange={(coverImage) => set({ coverImage })} hint="Shown on the shop card." />
          <GalleryField label="Product images" images={gallery} onChange={setGallery} captionLabel="Label" />
          <VideoFields videos={videos} onChange={(next) => set({ media: [...(form.media ?? []).filter((item) => item.type === "image"), ...next] })} />

          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-sm font-semibold text-text-primary">Generated codes</p>
            <Field label="SKU">
              <div className="flex gap-2">
                <TextInput value={form.sku ?? ""} onChange={(event) => set({ sku: event.target.value })} />
                <Button variant="outline" onClick={() => set({ sku: generateSku(form.category, form.id) })}>Generate</Button>
              </div>
            </Field>
            <div className="mt-2">
              <Field label="Unique product code (10 digits)">
                <div className="flex gap-2">
                  <TextInput value={form.productCode ?? ""} onChange={(event) => set({ productCode: event.target.value.replace(/\D/g, "").slice(0, 10) })} />
                  <Button variant="outline" onClick={() => set({ productCode: generateProductCode(form.id) })}>Generate</Button>
                </div>
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Barcode (EAN-13)">
                <div className="flex gap-2">
                  <TextInput value={form.barcode ?? ""} onChange={(event) => set({ barcode: event.target.value })} />
                  <Button variant="outline" onClick={() => set({ barcode: generateBarcode() })}>Generate</Button>
                </div>
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Selling price (₹)"><TextInput type="number" value={form.price} onChange={(event) => set({ price: Number(event.target.value) })} /></Field>
            <Field label="MRP (₹)"><TextInput type="number" value={form.originalPrice ?? 0} onChange={(event) => set({ originalPrice: Number(event.target.value) })} /></Field>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-sm font-semibold text-text-primary">Stock</p>
            <div className="flex gap-2">
              <Button variant={form.stockStatus === "in_stock" ? "primary" : "outline"} onClick={() => set({ stockStatus: "in_stock", stock: Math.max(form.stock, 1) })}>In stock</Button>
              <Button variant={form.stockStatus === "out_of_stock" ? "primary" : "outline"} onClick={() => set({ stockStatus: "out_of_stock", stock: 0 })}>Out of stock</Button>
            </div>
            {form.stockStatus === "in_stock" ? (
              <div className="mt-3">
                <Field label="Quantity on hand"><TextInput type="number" min={1} value={form.stock} onChange={(event) => set({ stock: Number(event.target.value) })} /></Field>
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">
                Customers can ask to be emailed when this is back. Putting it in stock later sends that email automatically.
                {pendingStockAlerts(form.id).length > 0 && ` ${pendingStockAlerts(form.id).length} people are waiting.`}
              </p>
            )}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.preorder?.enabled)}
                onChange={(event) => set({ preorder: { ...form.preorder, enabled: event.target.checked } })}
              />
              Allow pre-order while out of stock
            </label>
            {form.preorder?.enabled && (
              <div className="mt-2 grid gap-2">
                <Field label="Expected release"><TextInput type="date" value={form.preorder.releaseDate ?? ""} onChange={(event) => set({ preorder: { ...form.preorder, enabled: true, releaseDate: event.target.value } })} /></Field>
                <Field label="Pre-order note"><TextInput value={form.preorder.note ?? ""} onChange={(event) => set({ preorder: { ...form.preorder, enabled: true, note: event.target.value } })} /></Field>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active !== false} onChange={(event) => set({ active: event.target.checked })} />
            Visible in the shop
          </label>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-4 text-sm text-emerald-700">Published on the shop as /shop/{saved}.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={save}>{isNew ? "Create product" : "Save product"}</Button>
        <Button variant="outline" onClick={onDone}>Close</Button>
        {!isNew && (
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(`Delete ${form.title}? It is removed from the shop.`)) return;
              deleteProduct(form.id);
              onDone();
            }}
          >
            Delete product
          </Button>
        )}
      </div>
    </Panel>
  );
}

function VideoFields({ videos, onChange }: { videos: ProductMedia[]; onChange: (videos: ProductMedia[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const addFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const src = await fileToStoredUrl(file);
      onChange([...videos, { type: "video", src, label: file.name }]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-text-primary">Videos</p>
      {videos.map((video, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <TextInput
            placeholder="YouTube URL or uploaded video"
            value={video.src ?? ""}
            onChange={(event) => onChange(videos.map((item, i) => (i === index ? { ...item, src: event.target.value } : item)))}
          />
          <Button variant="ghost" onClick={() => onChange(videos.filter((_, i) => i !== index))}>Remove</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => onChange([...videos, { type: "video", src: "", label: "Video" }])}>Add video URL</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "Upload video still"}</Button>
      </div>
      <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={(event) => addFile(event.target.files?.[0])} />
      <p className="text-xs text-text-muted">Paste a YouTube link, or upload a file to media storage.</p>
    </div>
  );
}

function CategoriesPanel() {
  const [categories, setCategories] = useState<AdminCategory[]>(() => getCategories());
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const refresh = () => setCategories(getCategories());

  const startEdit = (category: AdminCategory | null) =>
    setEditing(
      category ?? {
        id: `cat-${Date.now()}`,
        name: "",
        slug: "",
        sortOrder: categories.length,
        active: true,
      }
    );

  const save = () => {
    if (!editing) return;
    saveCategory({ ...editing, slug: editing.slug || editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    refresh();
    setEditing(null);
  };

  return (
    <Panel title={`Categories (${categories.length})`} description="Used to organise the store catalogue." action={<Button onClick={() => startEdit(null)}>+ Add</Button>}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
            <span className="font-medium text-text-primary">{c.name}</span>
            <Button variant="ghost" onClick={() => startEdit(c)}>Edit</Button>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Slug">
              <TextInput value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </Field>
            <Field label="Sort order">
              <TextInput type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
            </Field>
            <Field label="Active">
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="h-5 w-5 accent-burgundy" />
                Visible in store
              </label>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="danger" onClick={() => { deleteCategory(editing.id); refresh(); setEditing(null); }}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
          </div>
        </div>
      )}

      {categories.length === 0 && <EmptyState text="No categories yet." />}
    </Panel>
  );
}
