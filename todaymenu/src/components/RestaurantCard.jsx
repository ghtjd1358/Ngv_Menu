import { useMemo, useState } from "react";
import { C } from "../constants";
import { parseMenuLine, isSectionHidden } from "../utils/menu";
import ItemList from "./ItemList";

export default function RestaurantCard({ restaurant, accentColor, primary = false }) {
  const { name, hours, lunch } = restaurant;
  const [showOrder, setShowOrder] = useState(false);

  const { mainItems, orderItems } = useMemo(() => {
    const allParsed = (Array.isArray(lunch) ? lunch : []).map(parseMenuLine);
    const mainItems = [], orderItems = [];
    let state = "main";
    for (const item of allParsed) {
      if (item.type === "section") {
        if (isSectionHidden(item.label)) state = "hidden";
        else if (item.label.includes("주문식")) { state = "order"; orderItems.push(item); }
        else { state = "main"; mainItems.push(item); }
      } else {
        if (state === "main") mainItems.push(item);
        else if (state === "order") orderItems.push(item);
      }
    }
    return { mainItems, orderItems };
  }, [lunch]);

  const hasOrder = orderItems.some(i => i.type === "item");
  const color = accentColor || C.accent;

  return (
    <div className="restaurant-card-outer" style={{ borderRadius: 20, padding: 2, background: "rgba(234,237,252,0.65)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 4px rgba(15,25,60,0.04), 0 8px 28px rgba(15,25,60,0.07)", width: "100%", minWidth: 0 }}>
      <div style={{ background: C.card, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color} 0%, ${color}40 100%)`, flexShrink: 0 }} />
        <div style={{ padding: "16px 20px 12px" }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text1 }}>{name}</p>
          {hours && <p style={{ margin: "3px 0 0", fontSize: 12, color: C.text3 }}>{hours}</p>}
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent 0%, ${C.border} 12%, ${C.border} 88%, transparent 100%)`, margin: "0 20px" }} />
        <div style={{ padding: "12px 20px 16px", minWidth: 0, width: "100%" }}>
        {mainItems.length === 0 && !hasOrder ? (
          <p style={{ margin: 0, fontSize: 13, color: C.text3 }}>메뉴 정보 없음</p>
        ) : (
          <>
            {mainItems.length > 0 && <ItemList items={mainItems} fontSize={primary ? 17 : 15} />}
            {hasOrder && (
              <div style={{ marginTop: mainItems.length > 0 ? 12 : 0 }}>
                <button type="button" onClick={() => setShowOrder(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: C.text3, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ fontSize: 10, transition: "transform 0.15s", display: "inline-block", transform: showOrder ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  주문식 메뉴 (개인 사비)
                </button>
                {showOrder && (
                  <div className="anim-slide-down" style={{ marginTop: 8 }}>
                    <ItemList items={orderItems} showPrices />
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
