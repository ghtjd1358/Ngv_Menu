import { useEffect, useRef, useState } from "react";
import { C } from "../constants";
import OrderCalculator from "./OrderCalculator";

export default function QuiznosModal({ open, onClose, items = [], drinks = [], updatedAt }) {
  const [tab, setTab] = useState("menu");
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => setTab(id)}
      style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", borderRadius: 8, background: tab === id ? C.header : "transparent", color: tab === id ? "#fff" : C.text3 }}>
      {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <button type="button" aria-label="닫기" onClick={onClose}
        className="anim-fade-in"
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer" }} />
      <div ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="퀴즈노스 주문"
        style={{ position: "relative", width: "100%", maxWidth: 520, background: C.card, borderRadius: "24px 24px 0 0", padding: 24, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "slideUpModal 0.28s cubic-bezier(0.32, 0.72, 0, 1) both", outline: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text1 }}>퀴즈노스</p>
          <button type="button" onClick={onClose}
            style={{ background: "#F4F6FB", border: "none", borderRadius: 99, width: 28, height: 28, cursor: "pointer", color: C.text3, fontSize: 13 }}>
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {tabBtn("menu", "메뉴")}
          {tabBtn("calculator", "주문 계산")}
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {tab === "menu" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {updatedAt && <p style={{ margin: "0 0 4px", fontSize: 11, color: C.text3 }}>업데이트: {updatedAt}</p>}
              {items.map((it) => (
                <div key={it.id} className="qz-item" style={{ borderRadius: 14, padding: 12, background: C.bg, display: "flex", gap: 12, alignItems: "center" }}>
                  {it.image && <img src={it.image} alt={it.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{it.name}</span>
                      {it.price && <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>{it.price.toLocaleString()}원</span>}
                      {typeof it.calorie === "number" && <span style={{ fontSize: 10, color: C.text3, background: C.border, borderRadius: 99, padding: "1px 7px" }}>{it.calorie} kcal</span>}
                    </div>
                    {it.desc && <p style={{ margin: "3px 0 0", fontSize: 11, color: C.text3, lineHeight: 1.5 }}>{it.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <OrderCalculator sandwiches={items} drinks={drinks} />
          )}
        </div>
      </div>
    </div>
  );
}
