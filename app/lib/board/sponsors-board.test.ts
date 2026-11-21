import { describe, expect, it } from "vitest";

import { BOUNDS, onTarmac, sponsorSpot } from "~/lib/board/full-board";

describe("the sponsor's spot on the board", () => {
  const spot = sponsorSpot();

  it("stays on the board, clear of its edge", () => {
    expect(spot.x0).toBeGreaterThan(BOUNDS.x0 + 3);
    expect(spot.x1).toBeLessThan(BOUNDS.x1 - 3);
    expect(spot.z0).toBeGreaterThan(BOUNDS.z0 + 3);
    expect(spot.z1).toBeLessThan(BOUNDS.z1 - 3);
  });

  it("keeps at least 4 m of grass between it and any road", () => {
    for (let x = spot.x0; x <= spot.x1; x += 0.5) {
      for (let z = spot.z0; z <= spot.z1; z += 0.5) {
        expect(onTarmac(x, z, 4), `${x}, ${z}`).toBe(false);
      }
    }
  });

  it("is shaped for a wide logo", () => {
    const ratio = (spot.x1 - spot.x0) / (spot.z1 - spot.z0);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.6);
  });
});
