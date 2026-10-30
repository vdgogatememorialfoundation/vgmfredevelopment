import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CartItem = { id: string; title: string; quantity: number; price: number };

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: Omit<CartItem, "quantity">) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    return {
      items,
      count,
      total,
      add: (item) =>
        setItems((current) => {
          const found = current.find((row) => row.id === item.id);
          if (found) return current.map((row) => (row.id === item.id ? { ...row, quantity: row.quantity + 1 } : row));
          return [...current, { ...item, quantity: 1 }];
        }),
      setQuantity: (id, quantity) =>
        setItems((current) => {
          if (quantity <= 0) return current.filter((row) => row.id !== id);
          return current.map((row) => (row.id === id ? { ...row, quantity } : row));
        }),
      remove: (id) =>
        setItems((current) =>
          current.flatMap((row) => {
            if (row.id !== id) return [row];
            if (row.quantity <= 1) return [];
            return [{ ...row, quantity: row.quantity - 1 }];
          })
        ),
      clear: () => setItems([]),
    };
  }, [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider missing");
  return value;
}
