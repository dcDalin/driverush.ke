/**
 * Split: two-tone. The school's colour below a line along the top of the
 * doors, white above, with a sharp accent stripe and a thin white pinstripe
 * on the split. The name sits on the doors in white, and in the school's
 * colour on the white roof (or the bonnet, where rails cover the roof).
 */
export default function split({ k, brand }) {
  const { L } = k;
  const c = brand.colors;
  const far = 9;
  const y = L.door.y1 + 0.015; // the split, along the top of the doors
  const band = (from, to, fill) => k.rect(-far, from, far, to, fill);
  // The same bands on the sides and both ends, so they meet at the corners.
  const lower = [
    band(-far, far, c.base),
    band(-far, y, c.primary),
    band(y, y + 0.028, c.accent),
    band(y + 0.046, y + 0.056, c.primary),
  ].join("");

  const named = L.roof.clear
    ? {
        z0: L.roof.z0 + 0.14,
        z1: L.roof.z1 - 0.14,
        x0: L.roof.x0 + 0.12,
        x1: L.roof.x1 - 0.12,
      }
    : {
        z0: L.bonnet.z0 + 0.2,
        z1: L.bonnet.z1 - 0.2,
        x0: L.bonnet.x0 + 0.16,
        x1: L.bonnet.x1 - 0.16,
      };

  const body = [
    k.inView("left", lower),
    k.inView("right", lower),
    k.inView("front", lower),
    k.inView("back", lower),
    k.inView("top", k.rect(-far, -far, far, far, c.base)),
    k.onTop(brand, named, { on: "light" }),
    k.onSides(
      brand,
      {
        z0: L.door.z0 + 0.04,
        z1: L.door.z1 - 0.04,
        y0: L.door.y0 + 0.02,
        y1: L.door.y1 - 0.03,
      },
      { on: "dark" },
    ),
  ].join("\n");
  return { defs: "", body };
}
