import { useMemo, useState } from "react";
import { C } from "../constants";
import { parseMenuLine, isSectionHidden } from "../utils/menu";
import ItemList from "./ItemList";

export default function RestaurantCard({ restaurant, liked, onToggle, accentColor, primary = false }) {
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
    <div style={{ background: C.card, borderRadius: 16, boxShadow: "0 2px 16px rgba(20,30,60,0.08)", borderLeft: `5px solid ${color}`, display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
      <div style={{ padding: "18px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text1 }}>{name}</p>
            {hours && <p style={{ margin: "4px 0 0", fontSize: 13, color: C.text3 }}>{hours}</p>}
          </div>
          <button type="button" onClick={onToggle} aria-pressed={liked}
            aria-label={liked ? `${name} 찜 해제` : `${name} 찜하기`}
            style={{ display: "inline-flex", alignItems: "center", borderRadius: 99, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: liked ? C.redLight : C.bg, color: liked ? C.red : C.text3, whiteSpace: "nowrap", flexShrink: 0 }}>
            {liked ? "♥" : "♡"}
          </button>
        </div>
      </div>
      <div style={{ height: 1, background: C.border, margin: "0 20px" }} />
      <div style={{ padding: "14px 20px 18px", minWidth: 0, width: "100%" }}>
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
  );
}
