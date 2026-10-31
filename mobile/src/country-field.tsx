import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { COUNTRIES, countryByCode, type Country } from "./geo";
import { useTheme } from "./theme";
import { Field } from "./ui";

export function CountryField({
  value,
  onChange,
  label = "Country",
  countries = COUNTRIES,
}: {
  value: string;
  onChange: (country: Country) => void;
  label?: string;
  countries?: Country[];
}) {
  const theme = useTheme();
  const list = countries.length ? countries : COUNTRIES;
  const selected = list.find((item) => item.code === value) ?? countryByCode(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? list.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            item.code.toLowerCase().includes(needle) ||
            item.dial.includes(needle.replace(/\s/g, ""))
        )
      : list;
    return filtered.slice(0, 12);
  }, [list, query]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.colors.muted, marginBottom: 6, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 12,
          padding: 13,
          minHeight: 48,
          backgroundColor: theme.colors.paper,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "600" }}>
          {selected.name} ({selected.dial})
        </Text>
        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{open ? "Close" : "Change"}</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.paper, padding: 10 }}>
          <Field label="Search country" value={query} onChange={setQuery} placeholder="India, United Kingdom, +1…" />
          {matches.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => {
                onChange(item);
                setOpen(false);
                setQuery("");
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: item.code === selected.code ? theme.colors.background : "transparent",
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: item.code === selected.code ? "700" : "500" }}>
                {item.name} ({item.dial})
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
