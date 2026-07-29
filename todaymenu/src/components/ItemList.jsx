import { C } from "../constants";

export default function ItemList({ items, showPrices = false }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {items.map((item, i) =>
        item.type === "section" ? (
          <li key={`section-${item.label}-${i}`} style={{ paddingTop: i === 0 ? 0 : 4, width: "100%" }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: C.accent }}>{item.label}</span>
          </li>
        ) : (
          <li key={`item-${item.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, width: "100%", minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: C.text1, lineHeight: 1.5, wordBreak: "keep-all" }}>{item.name}</span>
            {showPrices && item.price && (
              <span style={{ fontSize: 13, color: C.text3, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{item.price}</span>
            )}
          </li>
        )
      )}
    </ul>
  );
}
