# Menu Sanity Check vs Revised Menus (Page 2 & Page 3)

**Date:** Based on revised smoothie menu (Page 2) and revised coffee menu (Page 3).

---

## Page 2 – Smoothies & Oatmeals

### Wild Bowl
| Item | Revised Menu | Website | Status |
|------|--------------|---------|--------|
| Wild Bowl pricing | small $9.99, medium $10.99 | $9.99 + Medium +$1 = $10.99 | ✅ Match |
| Rules | 1 BASE • 2 FRUITS • UP TO 8 TOPPINGS & 2 DRIZZLES | Same in description & modal | ✅ Match |
| Wild Vegan | Chia, Granola, Coconut, Almonds, Dried Cranberries, PB, Honey, Strawberries, Bananas | Same; predetermined in modal | ✅ Match |
| Signature Bowl | ½ Chia ½ Yogurt, Granola, Pecans, Sunflower, Coconut, PB, Honey, Strawberries, Blueberries | Same; predetermined in modal | ✅ Match |
| Base options | Chia Pudding, Yogurt, Oatmeal | Oatmeal, Chia Seeds Pudding, Yogurt, combos | ✅ Match (more combos on web) |
| Toppings / Drizzle / Fruits | As listed on menu | Oatmeal Dried Toppings, Drizzels, Fruit Toppings | ✅ Match |

### Smoothies
| Item | Revised Menu | Website | Status |
|------|--------------|---------|--------|
| Green Glow | $7.99 | $7.99 | ✅ Match |
| Triple B | $8.20 | $8.20 | ✅ Match |
| Tropical Bliss | $7.50 | $7.50 | ✅ Match |
| Guava Cream | $7.75 | $7.75 | ✅ Match |
| L +$0.75 | 20oz upcharge | Smoothie Size 20oz +$0.75 | ✅ Match |

### Protein Blends
| Item | Revised Menu | Website | Status |
|------|--------------|---------|--------|
| Berry Mango Tango | $9.25, Dairy, tree nuts | $9.25, Dairy, Tree Nuts | ✅ Match |
| Power Couple | $9.50, Peanuts, Tree Nuts, Dairy | $9.50, same allergens | ✅ Match |
| Power Couple description | "Chai seed pudding" (likely typo) | "Chia seed pudding" | ✅ Web uses correct "Chia" |

**Note:** Revised menu shows **SMOOTHIES** and **PROTEIN BLENDS** as separate sub-headers. On the website all six drinks are in one section **Smoothies (Organic & Fresh)** with order: Green Glow, Triple B, Tropical Bliss, Guava Cream, Berry Mango Tango, Power Couple. No separate "Protein Blends" section; you can add a subsection or label later if desired.

---

## Page 3 – Coffee & Tea

### Prices updated to match revised menu
- **Flat White:** $5.10 → **$5.15** ✅
- **Doppio:** $3.05 → **$3.25** ✅
- **Caramel Macchiato (hot):** $5.60 → **$5.50**; set **active & available** (was inactive) ✅
- **Iced Caramel Macchiato:** $5.60 → **$5.95** ✅
- **Chai Latte (Hot):** $5.25 → **$4.95** ✅
- **Iced Tea:** $3.25 → **$3.65** ✅

### Syrups
- Revised menu: **Syrups +$0.75**
- Website: was +$0.20 per pump → updated to **+$0.75** per pump and display label **"Syrups (+$0.75 each)"**. Added options: Strawberry, Coconut, Pumpkin Spice (enabled). ✅

### Items that match (no change)
- Americano $3.60, Cappuccino $4.55, Latte $4.55, Mocha $5.15  
- Cold Brew $4.65, Iced Latte $4.65, Iced Mocha Latte $5.85  
- Assorted Tea $3.25, Iced Matcha $5.45, Iced Blueberry/Mango Matcha $6.25, Iced Strawberry Matcha $6.25  
- Milk options: non-dairy +$0.75 (already correct)

### Items on revised menu **not** on website (optional to add)
- **REG/DECAF** $3.00 (may overlap with Filtered Coffee / Espresso)
- **Cafe Au Lait** $3.99
- **Red Eye** $5.00
- **Macchiato** (4oz) $3.99 – website has "Espresso Macchiato" $5.15 (different product)
- **Cortado** $3.85
- **Solo** $1.65 – website has "Espresso" $2.85
- **Iced Coffee** $3.50
- **Orange Americano** $4.75
- **Caramel Shaken Espresso** $5.95
- **London Fog** $4.95

If you want any of these added, say which ones and we can add them to the seed.

### Name / size notes
- Revised menu lists **Flat White 8oz** and **Espresso Bar M(16oz) +$0.50**; website uses Cup Size (12–16) with Small/Medium. No change made; logic is consistent.
- **Iced Tea** on menu shows two prices ($3.65/$4.00); base price on web set to $3.65. If the second price is for Large, the existing size modifier can handle the upcharge.

---

## Summary

- **Page 2 (Smoothies & Oatmeals):** Wild Bowl rules, bowl items, smoothie list, and protein blends match. Only difference is a single "Smoothies" section on the web vs. printed "Smoothies" + "Protein Blends" sub-headers.
- **Page 3 (Coffee/Tea):** Six price/availability updates and syrup pricing (+$0.75) are applied. Several espresso-bar and cold/tea items on the printed menu are not in the seed; listed above for optional addition.

Re-run the seed after pulling these changes:

```bash
node server/seed.js
```
