# UI components

Every control is a shadcn component from `app/components/ui/`, in the house
look: house icons (`~/components/brand/icon` + `icons.ts`, never an icon
pack), house colour tokens (`bg-{voice}` with `text-{voice}-foreground`),
flat buttons, the traffic-light loader (never a spinner), 44 px touch targets.

## Adding a component

Add it in shadcn's own shape by hand (the kit imports from the `radix-ui`
package); do not run `npx shadcn add`, which would pull in an icon pack.
Swap its icons for house ones and its colours for house tokens.

## What to reach for

| Need                                | Use                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any button                          | `Button` (`rush`, `ink`, `paper`, `ghost`, `amber`, `green`, `link`, `quiet`, `quiet-rush`, `game-gold`, `game`, `game-outline`, `game-link`; sizes up to `icon`, `stamp`). `isLoading` while its action runs.                                                         |
| A button shaped like something else | `asChild` on `Button`, `Item` or `Card` with one child.                                                                                                                                                                                                                |
| A form field                        | The field kit, `~/components/ui/forms/server` (route actions) or `/client` (browser forms): `InputField`, `TextareaField`, `SelectField`, `CheckboxField`, `CheckboxGroupField`, `SwitchField`, `OtpField`. Label, error and description are wired for screen readers. |
| A one-time code                     | `OtpField` (shadcn input-otp).                                                                                                                                                                                                                                         |
| A list row                          | `Item` (`game`, `game-ghost` in the game).                                                                                                                                                                                                                             |
| A panel                             | `Card`.                                                                                                                                                                                                                                                                |
| On/off, pick one                    | `Toggle`, `ToggleGroup`, `Switch`.                                                                                                                                                                                                                                     |
| A menu                              | `DropdownMenu`.                                                                                                                                                                                                                                                        |
| Tabs                                | `Tabs`.                                                                                                                                                                                                                                                                |
| A confirm                           | `AlertDialog`.                                                                                                                                                                                                                                                         |
| A side panel                        | `Sheet`.                                                                                                                                                                                                                                                               |
| A message after an action           | `toast` (sonner); from an action, remix-toast's `dataWithSuccess` / `dataWithError`.                                                                                                                                                                                   |

## Kept custom on purpose

These draw something shadcn has no part for, so they stay plain elements
(owner, 2026-11-24; still true after the 2026-11-25 overhaul):

- markers pinned to the 3D table: pins (`board-spot-picks`), line-up cars
  (`board-car-picks`), the finish chip (`board-finish-cue`);
- the game's expandable task card (`board-player`);
- the joystick (`board-controls`);
- image overlay boxes (`image-region-editor`) and the tap-anywhere reveal
  area (`image-focus-player`);
- the 3D scenes, the canvas and the SVG brand art.

The internal tools' list rows are `Item` too (#7).
