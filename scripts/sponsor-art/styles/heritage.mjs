/**
 * Heritage stripes: a white car with twin stripes in the school's colour
 * running nose to tail over the bonnet, roof and boot, each edged with a fine
 * accent pinstripe, and a rocker stripe along the bottom of the sides. The
 * name sits on the doors. The stripes are what a learner sees from above.
 */
export default function heritage({ k, brand }) {
  const { L, width } = k;
  const c = brand.colors;
  const far = 9;
  const w = width * 0.13; // each stripe
  const g = width * 0.07; // the gap between them
  const pin = 0.012;
  const off = 0.03;
  // Across the car (x): the same bands from above and on both ends.
  const stripes = [-1, 1]
    .map((side) => {
      const a = side < 0 ? -g / 2 - w : g / 2;
      const b = a + w;
      return [
        [a, b, c.primary],
        [a - off - pin, a - off, c.accent],
        [b + off, b + off + pin, c.accent],
      ];
    })
    .flat();
  const top = [
    k.rect(-far, -far, far, far, c.base),
    ...stripes.map(([a, b, fill]) => k.rect(-far, a, far, b, fill)),
  ].join("");
  const rocker = L.door.y0 + 0.01;
  const end = [
    k.rect(-far, -far, far, far, c.base),
    k.rect(-far, -far, far, rocker, c.primary),
    ...stripes.map(([a, b, fill]) => k.rect(a, rocker, b, far, fill)),
  ].join("");
  // The ends are seen from outside: x runs the other way on the front.
  const side = [
    k.rect(-far, -far, far, far, c.base),
    k.rect(-far, -far, far, rocker, c.primary),
    k.rect(-far, rocker + off, far, rocker + off + pin, c.accent),
  ].join("");

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", top),
    k.inView("front", end),
    k.inView("back", end),
    k.onSides(
      brand,
      {
        z0: L.door.z0 + 0.04,
        z1: L.door.z1 - 0.04,
        y0: rocker + off + 0.05,
        y1: L.door.y1 - 0.05,
      },
      { on: "light" },
    ),
  ].join("\n");
  return { defs: "", body };
}
