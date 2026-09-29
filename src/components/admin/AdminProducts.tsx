"use client";

import { useState } from "react";
import {
  addCustomBook,
  deleteCategory,
  generateBarcode,
  getCategories,
  getLiveBooks,
  getOverride,
  saveCategory,
  saveProductOverride,
  stockLevel,
} from "@/lib/product-data";
import type { AdminCategory, Book } from "@/types";
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

export function ProductsSection() {
  const [books, setBooks] = useState<Book[]>(() => getLiveBooks());
  const [editedId, setEditedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = () => setBooks(getLiveBooks());
  const book = editedId ? getLiveBooks().find((b) => b.id === editedId) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Products & Inventory</h1>
          <p className="text-sm text-text-muted">
            Manage pricing, barcode, stock, manufacture info, description and specifications.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd((v) => !v)}>+ Add product</Button>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <ProductEditorPanel book={book} onDone={refresh} />

      <Panel title={`Catalog (${books.length})`} description="Changes apply live across the store.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                <th className="py-2 pr-3">Product</th>
                <th className="px-3">SKU / Barcode</th>
                <th className="px-3">Price</th>
                <th className="px-3">Stock</th>
                <th className="px-3">Category</th>
                <th className="px-3">Status</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {books.map((b) => {
                const override = getOverride(b.id);
                const level = stockLevel({ ...b, stock: override?.stock ?? b.stock });
                return (
                  <tr key={b.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-3">
                      <button type="button" onClick={() => setEditedId(editedId === b.id ? null : b.id)} className="text-left font-semibold text-text-primary hover:text-burgundy">
                        {b.title}
                      </button>
                      <p className="text-xs text-text-muted">{b.seller}</p>
                    </td>
                    <td className="px-3">
                      <p className="font-mono text-xs">{b.sku}</p>
                      <p className="font-mono text-xs text-text-muted">{override?.barcode ?? "—"}</p>
                    </td>
                    <td className="px-3">
                      <span className="font-medium">{formatINR(override?.price ?? b.price)}</span>
                      {override?.originalPrice && override.originalPrice > (override.price ?? b.price) && (
                        <p className="text-xs text-text-muted line-through">{formatINR(override.originalPrice)}</p>
                      )}
                    </td>
                    <td className="px-3">
                      <span className={level === "in" ? "text-emerald-700" : level === "low" ? "text-amber-700" : "text-red-600"}>
                        {override?.stock ?? b.stock}
                      </span>
                    </td>
                    <td className="px-3 text-text-muted">{override?.category ?? b.category}</td>
                    <td className="px-3">
                      {level === "in" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">In stock</span>}
                      {level === "low" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Low</span>}
                      {level === "out" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">Out</span>}
                    </td>
                    <td className="px-3 text-right">
                      <Button variant="ghost" onClick={() => setEditedId(editedId === b.id ? null : b.id)}>
                        {editedId === b.id ? "Close" : "Edit"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <CategoriesPanel />

      {showAdd && <AddProductForm onDone={() => { refresh(); setShowAdd(false); }} />}
    </div>
  );
}

function ProductEditorPanel({ book, onDone }: { book: Book | null; onDone: () => void }) {
  const [form, setForm] = useState(() => {
    const override = book ? getOverride(book.id) : undefined;
    return {
      price: override?.price ?? book?.price ?? 0,
      originalPrice: override?.originalPrice ?? book?.originalPrice ?? 0,
      stock: override?.stock ?? book?.stock ?? 0,
      barcode: override?.barcode ?? "",
      manufacturer: override?.manufacturer ?? book?.seller ?? "",
      description: override?.description ?? book?.description ?? "",
      weight: override?.dimensions?.weight ?? 0,
    };
  });
  const [saved, setSaved] = useState(false);

  if (!book) return null;

  const save = () => {
    const existing = getOverride(book.id);
    saveProductOverride({
      bookId: book.id,
      price: form.price > 0 ? form.price : undefined,
      originalPrice: form.originalPrice > form.price ? form.originalPrice : undefined,
      stock: form.stock,
      barcode: form.barcode || generateBarcode(),
      manufacturer: form.manufacturer,
      description: form.description,
      dimensions: { weight: form.weight, width: 0, height: 0, depth: 0 },
      specifications: existing?.specifications ?? book.specifications,
      category: existing?.category ?? book.category,
      active: true,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
    onDone();
  };

  return (
    <Panel title={`Edit — ${book.title}`} action={saved ? <span className="text-sm font-semibold text-emerald-700">Saved ✓</span> : undefined}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Selling price (₹)">
          <TextInput type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        </Field>
        <Field label="Original / MRP (₹)">
          <TextInput type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })} />
        </Field>
        <Field label="Stock on hand">
          <TextInput type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
        </Field>
        <Field label="Barcode (EAN-13)">
          <TextInput value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder={generateBarcode()} />
        </Field>
        <Field label="Manufacturer / Seller">
          <TextInput value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
        </Field>
        <Field label="Unit weight (kg)">
          <TextInput type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Description">
          <TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={save}>Save changes</Button>
      </div>
    </Panel>
  );
}

function AddProductForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    title: "",
    price: 0,
    stock: 0,
    category: "Clinical",
    id: "",
  });
  const categories = getCategories();

  const save = () => {
    if (!form.title || !form.price) return;
    const id = form.id || `bks-${Date.now()}`;
    addCustomBook({
      id,
      title: form.title,
      slug: form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      author: "VGMF Publications",
      description: "",
      price: form.price,
      currency: "INR",
      stock: form.stock,
      availability: form.stock > 0 ? "In Stock" : "Out of Stock",
      category: form.category,
      seller: "Vaidya Gogate Memorial Foundation Publications",
      sku: `VGMF-BK-${String(Date.now()).slice(-4)}`,
      openBoxDelivery: true,
      specifications: [],
    });
    onDone();
  };

  return (
    <Panel title="Add new product">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Product ID (optional)">
          <TextInput value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="auto" />
        </Field>
        <Field label="Price (₹)"><TextInput type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
        <Field label="Stock"><TextInput type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></Field>
        <Field label="Category">
          <SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categories.map((c) => <option key={c.id}>{c.name}</option>)}
          </SelectInput>
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={save}>Add product</Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </Panel>
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