# Forms and data

How DriveRush reads and writes data, after the thinkrush monorepo (here one
app, so its packages are folders).

## The layers

| Layer          | Where               | Does                                                                                                                                                           |
| -------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | `supabase/schemas/` | Tables, row level security, functions that check the caller. The last word on who may do what. See `supabase/schemas/README.md` and `docs/database-access.md`. |
| Data functions | `app/database/`     | One typed function per read or change, client first. The only code that calls `supabase.from(...)` or `supabase.rpc(...)`.                                     |
| Schemas        | `app/schemas/`      | zod rules for every form and inline action, shared by the browser and the action.                                                                              |
| Routes         | `app/routes/`       | Loaders read through data functions; actions validate with a schema, then call one.                                                                            |
| Components     | `app/components/`   | Render loader data; submit through forms or fetchers. Never import a Supabase client.                                                                          |

## `app/database`

- `supabase/server.ts` (a request's client, as the signed-in person),
  `supabase/browser.ts` (the browser's client, loaded lazily),
  `supabase/service.server.ts` (service role: trusted server code only).
- `types/database.ts` is generated (`npm run db:gen-types`). `types/index.ts`
  names what the app uses: `TypedSupabaseClient`, `AppRole`, `Entitlement`,
  `FunctionArgs<"fn">`, `FunctionReturns<"fn">`. No hand-written row types.
- One folder per domain: `auth`, `progress`, `entitlement`, `learner`,
  `schools`, `console`. Big domains split into `queries.ts` and `mutations.ts`.
- Names are verb first: `getX`, `listX`, `addX`, `setX`, `removeX`.
- **Reads throw** (`orThrow`): a loader's failure reaches the route's
  ErrorBoundary. **Writes return a `Result`** (`toResult`): `{ data, error }`,
  where `error` is a plain sentence for a toast. `result.ts` maps the
  database's refusal tokens (`admin_limit`, `not_pending`, ...) to sentences.

```ts
// app/database/schools/mutations.ts
export async function addStudent(
  supabase: TypedSupabaseClient,
  branchId: string,
  email: string,
) {
  return toResult(
    await supabase.rpc("school_add_student", {
      p_branch_id: branchId,
      p_email: email,
    }),
  );
}
```

## Gates

Every loader and action of an account route opens with one of
`getRequestClient` (anyone; returns who they are), `requireUser` (401
otherwise) or `requireStaff` (403 otherwise), from
`app/lib/auth/require.server.ts`. Each route checks for itself: a data request
can run a child loader alone. `app/lib/auth/gate-first.test.ts` fails a route
that does not.

The check costs one session read per request, however many loaders ask:
React Router hands every loader (and the middleware) of a request the same
`Request`, and `getRequestClient` remembers its answer for it. Another read
two loaders of one request both need goes through
`oncePerRequest(request, key, read)` (`app/lib/server/once-per-request.ts`).
Pages about one person export `middleware = [privatePage]`
(`app/lib/auth/private-page.server.ts`): `private, no-store`, and the
cookies Supabase refreshed. A modal route whose page under it is already
gated needs no loader of its own; its action checks.

## Forms that post to a route action

remix-hook-form, through `useServerForm` (`app/lib/forms/use-server-form.ts`):

```tsx
const { methods, fetcher, formRef, busy } = useServerForm({
  schema: AddStudentSchema,
  key: "add-student", // unique on the page: one fetcher, one set of errors
  resetOnSuccess: true,
  defaultValues: { intent: "add-student", email: "", branchId },
});
return (
  <ServerFormProvider methods={methods}>
    <fetcher.Form
      ref={formRef}
      method="post"
      onSubmit={methods.handleSubmit}
      noValidate
    >
      <HoneypotInputs />
      <InputField name="email" label="Student's email" disabled={busy} />
      <Button type="submit" isLoading={busy}>
        Add student
      </Button>
    </fetcher.Form>
  </ServerFormProvider>
);
```

In the action:

```ts
const { supabase, headers } = await requireUser(request);
const formData = await request.formData();
switch (readFormIntent(formData)) {
  case "add-student": {
    const { errors, data } = await validateForm(formData, AddStudentSchema); // honeypot first
    if (errors)
      return dataWithError(
        { ok: false, errors },
        "Check the highlighted fields.",
        { status: 400, headers },
      );
    const result = await addStudent(supabase, data.branchId, data.email);
    return result.error
      ? dataWithError({ ok: false }, result.error, { status: 400, headers })
      : dataWithSuccess({ ok: true }, "Student added.", { headers });
  }
}
```

- The field errors from `validateForm` land back in the same fields.
- A refusal answers **400**: nothing changed, so React Router does not re-run
  the page's loaders (a typo never reloads the dashboard).
- `dataWithSuccess` / `dataWithError` (remix-toast) leave a one-time message
  in a cookie; once the submission settles the shell reads it from
  `/api/flash` and shows it (`useFlashToasts`). The root loader never reads
  it: it is the same for every visitor, so public pages can be prerendered.
- A route modal (`ModalForm`, `ConfirmModal`, or `RouteModal` with
  `useCloseWhenDone`) closes the moment its action answers `{ ok: true }`,
  while the frame re-reads behind it; the address goes back to `closeTo`
  when that is done. While a form is sent, Escape, the backdrop and Cancel
  wait. `useServerForm` keys its fetcher per mount, so a modal opened again
  starts fresh.
- A dashboard frame exports `shouldRevalidate = frameShouldRevalidate`
  (`app/lib/ui/frame-revalidate.ts`): moving about inside it (tabs, modals,
  a list's search in the address) reads nothing again; a saved form, a live
  update or another school does. It exports an `ErrorBoundary` drawing
  `FrameError`, so a lapsed session or a refused change stays inside it.
- Every server form has `<HoneypotInputs />`; `validateForm` refuses a post
  without the trap field.

## Inline changes

A button that changes one thing (release a student, remove an admin) uses a
keyed fetcher, `useInlineAction(key)`: keyed by the thing it changes, its
`pending` intent drives the button's `isLoading`, `sent(intent)` lets the row
show the change at once (an invite counted as sent again), and the loader
brings the new state once it settles. It posts plain fields with an `intent`; the action
parses them with the matching schema (`StudentActionSchema`, ...).

## Resource routes

On-demand data for a component that is not a page of its own lives under
`app/routes/api/` (no default export), read and written through typed
fetchers: `useFetcher<typeof loader>()`. Example: the account menu's school
invites, `/api/me/school-invites`.

## Forms handled in the browser

The sign-in sheet talks to Supabase Auth from the browser, so it uses plain
react-hook-form (`useForm` + `zodResolver`) with the same schemas and the
client field kit (`~/components/ui/forms/client`). Validate on submit, then
as the person types (`mode: "onSubmit"`, `reValidateMode: "onChange"`), so an
error never moves a button out from under a tap.

## Tests

| Suite      | Command                       | What                                                                                                                  |
| ---------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Unit       | `npm test`                    | Pure logic and components beside the code (`*.test.ts(x)`), data functions with a mocked client, schemas, gate-first. |
| pgTAP      | `npm run test:pgtap`          | The database: security manifest, guards, row level security, behaviour.                                               |
| Database   | `npx vitest run --project db` | Data through the real API (`test/db`).                                                                                |
| Routes     | `npm run test:routes`         | Loaders and actions called directly with real persona cookies (`test/routes`).                                        |
| End to end | `npm run test:e2e`            | Playwright in Chromium (`e2e/`).                                                                                      |

`npm run test:db` runs pgTAP, database and routes; all but unit need
`npm run db:start`.
