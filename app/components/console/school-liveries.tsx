/**
 * A school's liveries in the console: upload a new one from its folder, and
 * preview, publish, retire or delete the ones it has.
 *
 * Upload: staff pick the livery folder the art pipeline made
 * (`seed/fixtures/liveries/<slug>/`). The browser checks every part is
 * there, reads `livery.json` into the form (label, colours, roof board), and
 * on Upload names each file by its content, sends only what the bucket
 * lacks, and saves a draft. Nobody but staff sees a draft; Preview shows it
 * on the board, Publish makes it the school's livery for everyone.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Link, useFetcher } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Icon } from "~/components/brand/icon";
import {
  ArrowOutIcon,
  DeleteIcon,
  FolderIcon,
  UploadIcon,
  WarningIcon,
} from "~/components/brand/icons";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { InputField } from "~/components/ui/forms/client";
import { Input } from "~/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "~/components/ui/item";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import type { ConsoleLivery } from "~/database/console/queries";
import {
  DEFAULT_LIVERY_META,
  type LiveryMeta,
  LiveryMetaSchema,
  planLivery,
} from "~/lib/board/livery-files";
import {
  type PickedFolder,
  readFolder,
  readMeta,
  uploadLiveryFolder,
  type UploadProgress,
} from "~/lib/console/livery-upload";
import { useInlineAction } from "~/lib/forms/use-inline-action";

const LIVERY_BADGE = {
  live: "green",
  draft: "amber",
  retired: "outline",
} as const;

function day(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
}

/** The folder picker's own attributes (not in React's input types). */
const FOLDER_PICKER = { webkitdirectory: "", directory: "" } as Record<
  string,
  string
>;

type Stage =
  | { kind: "idle" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "saving"; uploaded: number; kept: number }
  | { kind: "failed"; message: string };

export function LiveryUploader({ schoolId }: { schoolId: string }) {
  const [folder, setFolder] = React.useState<PickedFolder | null>(null);
  const [stage, setStage] = React.useState<Stage>({ kind: "idle" });
  const fetcher = useFetcher<{ ok: boolean }>({
    key: `livery-draft:${schoolId}`,
  });
  const draftForm = React.useRef<HTMLFormElement>(null);
  const draftInput = React.useRef<HTMLInputElement>(null);
  const pickerRef = React.useRef<HTMLInputElement>(null);

  const methods = useForm<LiveryMeta>({
    resolver: zodResolver(LiveryMetaSchema) as never,
    defaultValues: DEFAULT_LIVERY_META,
  });
  const plan = React.useMemo(
    () => (folder ? planLivery([...folder.files.keys()]) : null),
    [folder],
  );

  const pick = async (list: FileList | null) => {
    const picked = readFolder(list);
    setFolder(picked);
    setStage({ kind: "idle" });
    if (picked) methods.reset(await readMeta(picked));
  };

  // The draft is saved: start again with an empty picker.
  React.useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setFolder(null);
      if (pickerRef.current) pickerRef.current.value = "";
    }
    setStage({ kind: "idle" });
  }, [fetcher.state, fetcher.data]);

  const upload = methods.handleSubmit(async (meta) => {
    if (!folder || !plan || plan.missing.length) return;
    try {
      const { getSupabaseBrowserClient } =
        await import("~/database/supabase/browser");
      const { row, uploaded, kept } = await uploadLiveryFolder({
        supabase: getSupabaseBrowserClient(),
        schoolId,
        folder,
        meta,
        onProgress: (progress) => setStage({ kind: "uploading", progress }),
      });
      setStage({ kind: "saving", uploaded, kept });
      if (draftInput.current && draftForm.current) {
        // remix-hook-form's encoding: each value JSON, so the row arrives whole.
        draftInput.current.value = JSON.stringify(row);
        await fetcher.submit(draftForm.current, { method: "POST" });
      }
    } catch (error) {
      setStage({
        kind: "failed",
        message:
          error instanceof Error && error.message
            ? error.message
            : "The upload stopped. Check the connection and try again.",
      });
    }
  });

  const busy = stage.kind === "uploading" || stage.kind === "saving";
  const progress =
    stage.kind === "uploading" && stage.progress.total > 0
      ? Math.round((stage.progress.done / stage.progress.total) * 100)
      : stage.kind === "saving"
        ? 100
        : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a livery</CardTitle>
        <CardDescription>
          Choose the school's livery folder (the art pipeline's
          seed/fixtures/liveries/&lt;slug&gt;). Only files the bucket does not
          have yet are sent. It is saved as a draft for you to preview.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`livery-folder-${schoolId}`}>Livery folder</Label>
          <Input
            ref={pickerRef}
            id={`livery-folder-${schoolId}`}
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => void pick(e.target.files)}
            {...FOLDER_PICKER}
          />
        </div>

        {folder && plan ? (
          plan.missing.length ? (
            <Alert variant="error" icon={WarningIcon}>
              <AlertTitle>This folder is not a whole livery</AlertTitle>
              <AlertDescription>
                Missing: {plan.missing.join(", ")}.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="ok" icon={FolderIcon}>
              <AlertTitle>{folder.name || "Folder"} is ready</AlertTitle>
              <AlertDescription>
                {plan.counts.cars} cars, roof board, banner, posters and marks
                {plan.counts.thumbs
                  ? `, ${plan.counts.thumbs} car pictures`
                  : ""}
                {plan.counts.stills ? `, ${plan.counts.stills} stills` : ""}.
                {plan.hasMeta
                  ? " Colours read from livery.json."
                  : " No livery.json: check the colours below."}
              </AlertDescription>
            </Alert>
          )
        ) : null}

        {folder && plan && !plan.missing.length ? (
          <FormProvider {...methods}>
            <form
              onSubmit={(e) => void upload(e)}
              noValidate
              className="grid gap-3 sm:grid-cols-2"
            >
              <InputField
                name="label"
                label="Name"
                className="sm:col-span-2"
                disabled={busy}
                inputProps={{
                  placeholder: "Fitted per vehicle, November 2026",
                }}
              />
              <InputField
                name="base"
                label="Body colour"
                disabled={busy}
                inputProps={{ placeholder: "#f6f6f3" }}
              />
              <InputField
                name="topBoard.edge"
                label="Roof board edge"
                disabled={busy}
                inputProps={{ placeholder: "#e3271b" }}
              />
              <InputField
                name="rail.gold"
                label="Classroom rail"
                disabled={busy}
                inputProps={{ placeholder: "#f4a20c" }}
              />
              <InputField
                name="rail.red"
                label="Rail stripes"
                disabled={busy}
                inputProps={{ placeholder: "#e3271b" }}
              />
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <InputField
                  name="topBoard.width"
                  label="Roof board width (m)"
                  disabled={busy}
                  inputProps={{ inputMode: "decimal" }}
                />
                <InputField
                  name="topBoard.height"
                  label="Height (m)"
                  disabled={busy}
                  inputProps={{ inputMode: "decimal" }}
                />
                <InputField
                  name="topBoard.cut"
                  label="Corner cut"
                  disabled={busy}
                  inputProps={{ inputMode: "decimal" }}
                />
              </div>
              {stage.kind === "uploading" || stage.kind === "saving" ? (
                <div
                  className="flex flex-col gap-1.5 sm:col-span-2"
                  aria-live="polite"
                >
                  <Progress value={progress} aria-label="Upload progress" />
                  <p className="m-0 text-[13px] text-ink-3">
                    {stage.kind === "saving"
                      ? `Saving the draft (${stage.uploaded} sent, ${stage.kept} already stored).`
                      : `${stage.progress.done} of ${stage.progress.total} files: ${stage.progress.uploaded} sent, ${stage.progress.kept} already stored.`}
                  </p>
                </div>
              ) : null}
              {stage.kind === "failed" ? (
                <Alert
                  variant="error"
                  icon={WarningIcon}
                  className="sm:col-span-2"
                >
                  <AlertTitle>Not uploaded</AlertTitle>
                  <AlertDescription>{stage.message}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                variant="rush"
                className="self-start"
                isLoading={busy}
              >
                <Icon icon={UploadIcon} size={18} />
                Upload as a draft
              </Button>
            </form>
          </FormProvider>
        ) : null}

        <fetcher.Form ref={draftForm} method="post" hidden>
          <HoneypotInputs />
          <input type="hidden" name="intent" value="save-livery-draft" />
          <input ref={draftInput} type="hidden" name="draft" defaultValue="" />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function Confirm({
  trigger,
  title,
  body,
  confirm,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LiveryRow({
  livery,
  first,
}: {
  livery: ConsoleLivery;
  first: boolean;
}) {
  const action = useInlineAction(`livery:${livery.id}`);
  const submit = (intent: string) =>
    action.submit({ intent, liveryId: livery.id });
  return (
    <Item
      className={first ? "rounded-none" : "rounded-none border-t border-line"}
    >
      <ItemContent>
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <Badge variant={LIVERY_BADGE[livery.status]}>{livery.status}</Badge>
          {livery.label}
        </ItemTitle>
        <ItemDescription>
          Uploaded {day(livery.created_at)}
          {livery.published_at && livery.status !== "draft"
            ? ` · published ${day(livery.published_at)}`
            : ""}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-wrap justify-end">
        <Button size="sm" variant="ghost" asChild>
          <Link
            to={`/model-town-board/play?livery=${livery.id}`}
            target="_blank"
          >
            Preview
            <Icon icon={ArrowOutIcon} size={14} />
          </Link>
        </Button>
        {livery.status !== "live" ? (
          <Confirm
            trigger={
              <Button
                size="sm"
                variant="paper"
                isLoading={action.pending === "publish-livery"}
              >
                Publish
              </Button>
            }
            title="Publish this livery?"
            body="Everyone sees it on the board within a few minutes. The school's current livery is retired."
            confirm="Publish"
            onConfirm={() => submit("publish-livery")}
          />
        ) : (
          <Confirm
            trigger={
              <Button
                size="sm"
                variant="ghost"
                isLoading={action.pending === "retire-livery"}
              >
                Retire
              </Button>
            }
            title="Take this livery off the board?"
            body="The school's learners see plain cars and it stops taking turns until another livery is published."
            confirm="Retire"
            onConfirm={() => submit("retire-livery")}
          />
        )}
        {livery.status !== "live" ? (
          <Confirm
            trigger={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${livery.label}`}
                isLoading={action.pending === "delete-livery"}
              >
                <Icon icon={DeleteIcon} size={16} />
              </Button>
            }
            title="Delete this livery?"
            body="Its row goes; its files stay in storage (other liveries may share them)."
            confirm="Delete"
            onConfirm={() => submit("delete-livery")}
          />
        ) : null}
      </ItemActions>
    </Item>
  );
}

export function LiveryList({ liveries }: { liveries: ConsoleLivery[] }) {
  if (liveries.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-3">
        No livery yet. Upload the school's folder above.
      </p>
    );
  }
  return (
    <ItemGroup className="rounded-lg border border-line bg-surface">
      {liveries.map((livery, i) => (
        <LiveryRow key={livery.id} livery={livery} first={i === 0} />
      ))}
    </ItemGroup>
  );
}
