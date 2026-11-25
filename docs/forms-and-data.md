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
        { headers },
      );
    const result = await addStudent(supabase, data.branchId, data.email);
    return result.error
      ? dataWithError({ ok: false }, result.error, { headers })
      : dataWithSuccess({ ok: true }, "Student added.", { headers });
  }
}
```

- The field errors from `validateForm` land back in the same fields.
- `dataWithSuccess` / `dataWithError` (remix-toast) leave a one-time message
  the root shows as a toast. The root loader revalidates only after a
  submission, so the offline app still loads it once per visit.
- Every server form has `<HoneypotInputs />`; `validateForm` refuses a post
  without the trap field.

## Inline changes

A button that changes one thing (release a student, remove an admin) uses a
keyed fetcher, `useInlineAction(key)`: keyed by the thing it changes, its
`pending` intent drives the button's `isLoading`, and the loader brings the
new state once it settles. It posts plain fields with an `intent`; the action
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
