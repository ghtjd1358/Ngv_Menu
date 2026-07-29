import { useRef, useState } from "react";
import { C } from "../constants";

export default function OrderCalculator({ sandwiches, drinks }) {
  const rowIdRef = useRef(0);
  const emptyRow = () => ({ id: ++rowIdRef.current, name: "", sandwichId: "", drinkId: "" });
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [copied, setCopied] = useState(false);

  const getPrice = (row) => {
    const s = sandwiches.find(s => s.id === row.sandwichId);
    const d = drinks.find(d => d.id === row.drinkId);
    return (s?.price || 0) + (d?.price || 0);
  };

  const total = rows.reduce((sum, r) => sum + getPrice(r), 0);
  const hasOrders = rows.some(r => r.sandwichId || r.drinkId);

  const update = (id, key, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (id) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  const handleCopy = () => {
    const validRows = rows.filter(r => r.sandwichId || r.drinkId);
    const lines = validRows.map(r => {
      const s = sandwiches.find(s => s.id === r.sandwichId);
      const d = drinks.find(d => d.id === r.drinkId);
      return `${r.name || "미입력"}: ${s?.name || "-"}${d && d.price > 0 ? ` + ${d.name}` : ""} = ${getPrice(r).toLocaleString()}원`;
    });
    const itemCounts = {};
    validRows.forEach(r => {
      if (!r.sandwichId) return;
      const s = sandwiches.find(s => s.id === r.sandwichId);
      if (s) itemCounts[s.name] = (itemCounts[s.name] || 0) + 1;
    });
    const summary = Object.entries(itemCounts).map(([n, c]) => `${n} ×${c}`).join(", ");
    navigator.clipboard.writeText([
      ...lines, ``,
      summary ? `[발주] ${summary}` : "",
      `합계: ${total.toLocaleString()}원`,
    ].filter(Boolean).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle = {
    width: "100%", border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "5px 8px", fontSize: 12, color: C.text1, background: C.bg, outline: "none",
  };

  const HEADERS = ["이름", "샌드위치", "음료", "금액", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1.2fr auto auto", gap: 6 }}>
        {HEADERS.map(h => (
          <span key={h || "del"} style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: "0.05em" }}>{h}</span>
        ))}
      </div>
      {rows.map(row => {
        const price = getPrice(row);
        return (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1.2fr auto auto", gap: 6, alignItems: "center" }}>
            <input value={row.name} onChange={e => update(row.id, "name", e.target.value)} placeholder="이름" style={inputStyle} />
            <select value={row.sandwichId} onChange={e => update(row.id, "sandwichId", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">선택</option>
              {sandwiches.map(s => <option key={s.id} value={s.id}>{s.name}{s.price ? ` (${s.price.toLocaleString()}원)` : ""}</option>)}
            </select>
            <select value={row.drinkId} onChange={e => update(row.id, "drinkId", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">없음</option>
              {drinks.map(d => <option key={d.id} value={d.id}>{d.name}{d.price > 0 ? ` (${d.price.toLocaleString()}원)` : ""}</option>)}
            </select>
            <span style={{ fontSize: 12, fontWeight: 600, color: price > 0 ? C.text1 : C.text3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {price > 0 ? `${price.toLocaleString()}원` : "-"}
            </span>
            <button type="button" onClick={() => removeRow(row.id)}
              style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", fontSize: 16, padding: "0 2px" }}>
              ✕
            </button>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <button type="button" onClick={addRow}
          style={{ background: C.accentLight, color: C.accent, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + 사람 추가
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text1, fontVariantNumeric: "tabular-nums" }}>합계 {total.toLocaleString()}원</span>
      </div>
      <div style={{ height: 1, background: C.border }} />
      <button type="button" onClick={handleCopy} disabled={!hasOrders}
        style={{ background: hasOrders ? C.header : C.border, color: hasOrders ? "#fff" : C.text3, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: hasOrders ? "pointer" : "default" }}>
        {copied ? "복사됨!" : "주문 내역 텍스트로 복사"}
      </button>
    </div>
  );
}
