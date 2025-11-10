"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";

type ParseResult = {
  cleaned: string[];
  total: number;
};

const DEFAULT_COMMENT = "# Disavow list";

const normalizeGreenEntries = (text: string): string[] =>
  Array.from(
    new Set(
      text
        .replace(/\r/g, "\n")
        .split(/[\n,;\t]+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((value) => toDisavowDomain(value))
        .filter((item): item is string => !!item),
    ),
  );

const looksLikeUrl = (value: string): boolean => {
  const target = value.trim().toLowerCase();
  if (!target) return false;
  if (target.startsWith("domain:")) return true;
  if (target.startsWith("http://") || target.startsWith("https://")) return true;
  if (target.startsWith("www.")) return true;
  return target.includes(".");
};

const toDisavowDomain = (value: string): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(/^domain:/i, "");
  if (!withoutPrefix) return null;

  const ensureProtocol = withoutPrefix.includes("://")
    ? withoutPrefix
    : `https://${withoutPrefix}`;

  let hostname = "";

  try {
    const url = new URL(ensureProtocol);
    hostname = url.hostname;
  } catch {
    hostname = withoutPrefix.split(/[/?#]/)[0] ?? "";
  }

  const normalized = hostname.replace(/^www\./i, "").toLowerCase();
  if (!normalized) return null;

  return `domain:${normalized}`;
};

const parseDomains = (
  raw: string,
  dedupe: boolean,
  skipNonUrl: boolean,
): ParseResult => {
  const tokens = raw
    .replace(/\r/g, "\n")
    .split(/[\n,;\t]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const total = tokens.length;
  const processed = tokens
    .map((token) => {
      if (skipNonUrl && !looksLikeUrl(token)) return null;
      return toDisavowDomain(token);
    })
    .filter((item): item is string => !!item);

  const cleaned = dedupe ? Array.from(new Set(processed)) : processed;

  return { cleaned, total };
};

type ProcessOptions = {
  customStatus?: (total: number, cleaned: number) => string;
  greenOverride?: Set<string>;
};

export default function Home() {
  const [comment, setComment] = useState(DEFAULT_COMMENT);
  const [rawInput, setRawInput] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, output: 0, greenRemoved: 0 });
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [skipNonUrl, setSkipNonUrl] = useState(true);
  const [utf8Check, setUtf8Check] = useState(false);
  const [greenlist, setGreenlist] = useState<string[]>([]);
  const [greenlistFileName, setGreenlistFileName] = useState<string | null>(null);
  const [greenlistInput, setGreenlistInput] = useState("");
  const [isGreenlistOpen, setIsGreenlistOpen] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<string | null>(null);
  const greenlistSet = useMemo(() => new Set(greenlist), [greenlist]);

  const runProcessing = useCallback(
    (
      source: string,
      dedupeFlag: boolean,
      skipFlag: boolean,
      options?: ProcessOptions,
    ) => {
      if (!source.trim()) {
        setDomains([]);
        setStats({ total: 0, output: 0, greenRemoved: 0 });
        setStatus("Nothing to format.");
        return;
      }

      const { cleaned, total } = parseDomains(source, dedupeFlag, skipFlag);
      const filterSet = options?.greenOverride ?? greenlistSet;
      const filtered = cleaned.filter((entry) => !filterSet.has(entry));
      setDomains(filtered);
      setStats({
        total,
        output: filtered.length,
        greenRemoved: cleaned.length - filtered.length,
      });
      setStatus(
        options?.customStatus
          ? options.customStatus(total, filtered.length)
          : total === 0
            ? "Nothing to format."
            : `Trimmed ${total} entries into ${filtered.length}.`,
      );
    },
    [greenlistSet],
  );

  const handleProcess = useCallback(() => {
    if (!rawInput.trim()) {
      runProcessing("", dedupe, skipNonUrl);
      setLastProcessed(null);
      return;
    }

    runProcessing(rawInput, dedupe, skipNonUrl);
    setLastProcessed(rawInput);
  }, [rawInput, dedupe, skipNonUrl, runProcessing]);

  const handleToggleDedupe = useCallback(() => {
    const next = !dedupe;
    setDedupe(next);
    if (lastProcessed !== null) {
      runProcessing(
        lastProcessed,
        next,
        skipNonUrl,
        {
          customStatus: (total, filtered) =>
            next
              ? `Removed duplicates: ${filtered}/${total} domains left.`
              : `Showing all ${filtered} entries.`,
        },
      );
    }
  }, [dedupe, lastProcessed, skipNonUrl, runProcessing]);

  const handleToggleSkip = useCallback(() => {
    const next = !skipNonUrl;
    setSkipNonUrl(next);
    if (lastProcessed !== null) {
      runProcessing(
        lastProcessed,
        dedupe,
        next,
        {
          customStatus: (total, filtered) =>
            next
              ? `Skipped plain text: ${filtered}/${total} entries kept.`
              : `Including all ${filtered} entries.`,
        },
      );
    }
  }, [skipNonUrl, lastProcessed, dedupe, runProcessing]);

  const handleFileUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = utf8Check
          ? new TextDecoder("utf-8", { fatal: true }).decode(
              await file.arrayBuffer(),
            )
          : await file.text();

        setRawInput((prev) => [prev, text].filter(Boolean).join("\n"));
        setFileName(file.name);
        setStatus(
          utf8Check ? `UTF-8 verified: ${file.name}` : `Loaded ${file.name}`,
        );
      } catch {
        setStatus(`UTF-8 verification failed for ${file.name}`);
        setFileName(null);
      } finally {
        event.target.value = "";
      }
    },
    [utf8Check],
  );

  const applyGreenlistEntries = useCallback(
    (entries: string[], label: string | null) => {
      const overrideSet = new Set(entries);
      setGreenlist(entries);
      setGreenlistFileName(label);
      setStatus(
        entries.length
          ? `Greenlist loaded (${entries.length} domains).`
          : `Greenlist empty; nothing to skip.`,
      );

      if (lastProcessed !== null) {
        runProcessing(lastProcessed, dedupe, skipNonUrl, {
          customStatus: (total, filtered) =>
            entries.length
              ? `Greenlist applied: ${filtered}/${total} domains kept.`
              : `Greenlist cleared: ${filtered}/${total} domains available.`,
          greenOverride: overrideSet,
        });
      }
    },
    [dedupe, skipNonUrl, lastProcessed, runProcessing],
  );

  const handleGreenlistUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const decode = async () =>
        utf8Check
          ? new TextDecoder("utf-8", { fatal: true }).decode(
              await file.arrayBuffer(),
            )
          : await file.text();

      try {
        const text = await decode();
        const normalized = normalizeGreenEntries(text);
        applyGreenlistEntries(normalized, file.name);
      } catch {
        setStatus(`Failed to read ${file.name}`);
      } finally {
        event.target.value = "";
      }
    },
    [utf8Check, applyGreenlistEntries],
  );

  const handleClearGreenlist = useCallback(() => {
    setGreenlistInput("");
    applyGreenlistEntries([], null);
  }, [applyGreenlistEntries]);

  const handleApplyGreenlistPaste = useCallback(() => {
    if (!greenlistInput.trim()) {
      setStatus("Paste greenlist domains first.");
      return;
    }

    const normalized = normalizeGreenEntries(greenlistInput);
    applyGreenlistEntries(normalized, "Pasted greenlist");
    setGreenlistInput("");
  }, [greenlistInput, applyGreenlistEntries]);

  const preview = useMemo(() => {
    const trimmedComment = comment.trim();
    return [trimmedComment, ...domains].filter(Boolean).join("\n");
  }, [comment, domains]);

  const hasOutput = preview.trim().length > 0;
  const utf8Safe = useMemo(
    () => !utf8Check || !preview.includes("\ufffd"),
    [preview, utf8Check],
  );
  const actionDisabled = !hasOutput || (utf8Check && !utf8Safe);
  const outputLabel = dedupe ? "Unique" : "Output";
  const canApplyGreenlistPaste = greenlistInput.trim().length > 0;

  const handleDownload = useCallback(() => {
    if (!preview.trim()) return;
    const blob = new Blob([preview], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.download = `disavow-${stamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [preview]);

  const handleCopy = useCallback(async () => {
    if (!preview.trim() || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(preview);
    setStatus("Copied to clipboard.");
  }, [preview]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12 md:py-16">
        <header className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.5em] text-slate-400">
            Disavow
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Clean bad backlinks fast
          </h1>
          <p className="text-base text-slate-400">
            Drop junk URLs, get a tidy `domain:` list, export.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium text-slate-300">
                Paste URLs or domains
              </label>
              <textarea
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder="https://spammysite.com/offer&#10;spammydomain.com&#10;domain:worstsite.net"
                className="h-56 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/50"
              />
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-800 px-4 py-2 text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200">
                  <input
                    type="file"
                    accept=".txt,.csv,.tsv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  Upload file
                </label>
                {fileName ? (
                  <span className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
                    {fileName}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    txt / csv / tsv supported
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                      Unique only
                    </p>
                    <p className="text-xs text-slate-400">
                      {dedupe ? "On" : "Off"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleDedupe}
                    aria-pressed={dedupe}
                    aria-label="Toggle unique domains"
                    className={`relative h-6 w-12 rounded-full border border-slate-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      dedupe ? "bg-cyan-500" : "bg-slate-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                        dedupe ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Skip non-URLs
                    </p>
                    <p className="text-xs text-slate-400">
                      {skipNonUrl ? "Filtering" : "Allow all"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSkip}
                    aria-pressed={skipNonUrl}
                    aria-label="Toggle skip non-url lines"
                    className={`relative h-6 w-12 rounded-full border border-slate-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      skipNonUrl ? "bg-cyan-500" : "bg-slate-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                        skipNonUrl ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                      Verify UTF-8
                    </p>
                    <p
                      className={`text-xs ${
                        utf8Check
                          ? utf8Safe
                            ? "text-emerald-400"
                            : "text-rose-400"
                          : "text-slate-500"
                      }`}
                    >
                      {utf8Check ? (utf8Safe ? "Ready" : "Invalid chars") : "Off"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUtf8Check((prev) => !prev)}
                    aria-pressed={utf8Check}
                    aria-label="Toggle UTF-8 verification"
                    className={`relative h-6 w-12 rounded-full border border-slate-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      utf8Check ? "bg-cyan-500" : "bg-slate-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                        utf8Check ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
                <div className="sm:col-span-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Greenlist
                      </p>
                      <p className="text-xs text-slate-400">
                        Strip safe domains before export.
                      </p>
                      <p className="text-xs text-emerald-400">
                        {greenlist.length > 0
                          ? `Greenlist enabled for ${greenlist.length} ${
                              greenlist.length === 1 ? "domain" : "domains"
                            }.`
                          : "Greenlist idle."}
                      </p>
                    </div>
                    {greenlist.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearGreenlist}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-200"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-800 px-3 py-2 text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200">
                      <input
                        type="file"
                        accept=".txt,.csv,.tsv"
                        className="hidden"
                        onChange={handleGreenlistUpload}
                      />
                      Upload greenlist
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsGreenlistOpen((prev) => !prev)}
                      className="flex items-center gap-1 rounded-full border border-slate-800 px-3 py-2 text-[0.7rem] text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                    >
                      <span>{isGreenlistOpen ? "Hide paste" : "Paste greenlist"}</span>
                      <span
                        className={`transition-transform ${
                          isGreenlistOpen ? "rotate-180" : ""
                        }`}
                      >
                        ▼
                      </span>
                    </button>
                    {greenlistFileName ? (
                      <span className="rounded-full border border-slate-800 px-3 py-1 text-[0.7rem] text-slate-400">
                        {greenlistFileName} • {greenlist.length} domains
                      </span>
                    ) : (
                      <span className="text-[0.7rem] text-slate-500">
                        No greenlist applied
                      </span>
                    )}
                  </div>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isGreenlistOpen ? "max-h-80 opacity-100 mt-3" : "max-h-0 opacity-0"
                    }`}
                  >
                    <textarea
                      value={greenlistInput}
                      onChange={(event) => setGreenlistInput(event.target.value)}
                      placeholder="domain:safesite.com&#10;https://trusted.com"
                      className="h-28 w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                    />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleApplyGreenlistPaste}
                        disabled={!canApplyGreenlistPaste}
                        className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950 transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        Apply paste
                      </button>
                      <button
                        type="button"
                        onClick={() => setGreenlistInput("")}
                        className="rounded-2xl border border-slate-800 px-4 py-2 text-xs font-semibold tracking-wide text-slate-300 transition hover:border-slate-600"
                      >
                        Clear text
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleProcess}
                className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-400"
              >
                Format domains
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawInput("");
                  setDomains([]);
                  setStats({ total: 0, output: 0, greenRemoved: 0 });
                  setFileName(null);
                  setComment(DEFAULT_COMMENT);
                  setDedupe(true);
                  setSkipNonUrl(true);
                  setUtf8Check(false);
                  setGreenlist([]);
                  setGreenlistFileName(null);
                  setGreenlistInput("");
                  setIsGreenlistOpen(false);
                  setLastProcessed(null);
                  setStatus("");
                }}
                className="rounded-2xl border border-slate-800 px-4 py-3 text-sm font-semibold tracking-wide text-slate-300 transition hover:border-slate-600"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl shadow-slate-950/40">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Output
              </p>
              <p className="text-2xl font-semibold text-slate-100">
                {stats.output} domains
              </p>
              <p className="text-xs text-slate-500">
                {dedupe ? "Unique only" : "Duplicates kept"}
              </p>
              <p className="text-xs text-emerald-400">
                {stats.greenRemoved > 0
                  ? `Filtered ${stats.greenRemoved} ${
                      stats.greenRemoved === 1 ? "domain" : "domains"
                    } via greenlist.`
                  : "Awaiting greenlist hits."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">Input</p>
                <p className="text-2xl font-semibold text-slate-100">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">
                  {outputLabel}
                </p>
                <p className="text-2xl font-semibold text-slate-100">
                  {stats.output}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Comment line
              </label>
              <input
                type="text"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={DEFAULT_COMMENT}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
            <textarea
              value={preview}
              readOnly
              placeholder="domain:spammysite.com"
              className="h-52 w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-200 outline-none"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={actionDisabled}
                className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                Download txt
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={actionDisabled}
                className="rounded-2xl border border-slate-800 px-4 py-3 text-sm font-semibold tracking-wide text-slate-300 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
              >
                Copy
              </button>
            </div>
            {utf8Check && !utf8Safe && (
              <p className="text-sm text-rose-400">
                UTF-8 check failed. Strip odd characters before exporting.
              </p>
            )}
            {status && (
              <p className="text-sm text-slate-400" role="status">
                {status}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
