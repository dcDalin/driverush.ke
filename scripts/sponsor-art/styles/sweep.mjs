/**
 * Sweep: a white car whose nose and bonnet are the school's colour, the
 * colour then sweeping back along the lower side as a tapering blade, edged
 * by three thin accent pinstripes. The name sits on the doors above the
 * blade, and is knocked out in white on the roof (or, where rails cover the
 * roof, on the bonnet).
 */

export default function sweep({ k, brand }) {
  const { L, box } = k;
  const c = brand.colors;
  const far = 9;
  const zN = L.screen.front; // the bonnet ends at the windscreen
  const bladeTop = L.sill + 0.045; // the blade runs along the sill
  const zTip = L.wheels.rear.z - L.wheels.rear.r * 0.4;
  const yTip = L.sill + 0.02;
  const drop = 0.32; // how far back the sweep reaches the sill
  const pin = { dz: 0.05, dy: 0.032 }; // each pinstripe's step back and up
  // The blade's top edge: down the front of the door, sweeping back low.
  const edge = (dz, dy) =>
    [
      `M${zN + dz} ${box.ymax + 0.5 + dy}`,
      `L${zN + dz} ${L.belt + dy}`,
      `C${zN + 0.12 + dz} ${bladeTop + 0.16 + dy} ${zN + 0.1 + dz} ${bladeTop + dy} ${zN + drop + dz} ${bladeTop + dy}`,
      `C${zN + 1.2 + dz} ${bladeTop - 0.004 + dy} ${zTip - 0.5 + dz} ${yTip + 0.01 + dy} ${zTip + dz} ${yTip + dy}`,
    ].join("");
  const colour = `${edge(0, 0)}L${zTip} ${box.ymin - far}L${box.zmin - far} ${box.ymin - far}L${box.zmin - far} ${box.ymax + far}Z`;
  const stripes = [1, 2, 3]
    .map(
      (i) =>
        `<path d="${edge(pin.dz * i, pin.dy * i)}" fill="none" stroke="${c.accent}" stroke-width="0.018" stroke-linecap="round"/>`,
    )
    .join("");
  const side = [
    k.rect(-far, -far, far, far, c.base),
    `<path d="${colour}" fill="${c.primary}"/>`,
    stripes,
  ].join("");

  // From above: the bonnet in colour, the pinstripes across behind it.
  const top = [
    k.rect(-far, -far, far, far, c.base),
    k.rect(box.zmin - far, -far, zN, far, c.primary),
    [1, 2, 3]
      .map((i) =>
        k.rect(
          zN + 0.05 * i - 0.009,
          -far,
          zN + 0.05 * i + 0.009,
          far,
          c.accent,
        ),
      )
      .join(""),
  ];
  // The roof as a colour panel, when it is clear.
  const roofArea = {
    z0: L.roof.z0 + 0.1,
    z1: L.roof.z1 - 0.1,
    x0: L.roof.x0 + 0.08,
    x1: L.roof.x1 - 0.08,
  };
  if (L.roof.clear) {
    top.push(
      `<rect x="${roofArea.z0}" y="${roofArea.x0}" width="${roofArea.z1 - roofArea.z0}" height="${roofArea.x1 - roofArea.x0}" rx="0.06" fill="${c.primary}"/>`,
    );
  }

  const name = L.roof.clear
    ? k.onTop(brand, inset(roofArea, 0.06, 0.06), { on: "dark" })
    : k.onTop(
        brand,
        inset(
          {
            z0: L.bonnet.z0,
            z1: L.bonnet.z1,
            x0: L.bonnet.x0,
            x1: L.bonnet.x1,
          },
          0.2,
          0.14,
        ),
        { on: "dark" },
      );

  // The name on the doors: behind the sweep and above the blade's stripes.
  const doors = k.onSides(
    brand,
    {
      z0: Math.max(L.door.z0, zN + drop + 3 * pin.dz + 0.1),
      z1: L.door.z1 - 0.04,
      y0: bladeTop + 3 * pin.dy + 0.05,
      y1: L.door.y1 - 0.05,
    },
    { on: "light" },
  );

  // The back: white, with the name small on the boot.
  const backName = k.onBack(brand, { on: "light" });

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", top.join("")),
    k.inView("front", k.rect(-far, -far, far, far, c.primary)),
    k.inView("back", k.rect(-far, -far, far, far, c.base)),
    name,
    doors,
    backName,
  ].join("\n");
  return { defs: "", body };
}

function inset(a, dz, dx) {
  return { z0: a.z0 + dz, z1: a.z1 - dz, x0: a.x0 + dx, x1: a.x1 - dx };
}
