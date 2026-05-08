import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    days: { type: "string", default: "7" },
    "max-papers": { type: "string", default: "50" },
    output: { type: "string", default: "papers.json" },
  },
  strict: true,
});

const DAYS = parseInt(args.days, 10);
const MAX_PAPERS = parseInt(args["max-papers"], 10);
const OUTPUT = args.output;

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const HEADERS = { "User-Agent": "NPDResearchBot/1.0 (research aggregator)" };
const NCBI_API_KEY = process.env.NCBI_API_KEY || "";
const DELAY_MS = NCBI_API_KEY ? 120 : 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0].replace(/-/g, "/");
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function sanitizeInput(str) {
  return str.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;",
  }[c]));
}

const SEARCH_QUERIES = [
  `("Narcissistic Personality Disorder"[Mesh] OR "narcissistic personality disorder"[tiab] OR "pathological narcissism"[tiab] OR "narcissistic personality"[tiab] OR "narcissistic trait*"[tiab] OR "grandiose narcissism"[tiab] OR "vulnerable narcissism"[tiab] OR "covert narcissism"[tiab] OR "overt narcissism"[tiab] OR "malignant narcissism"[tiab] OR (narcissis*[tiab] AND (personality[tiab] OR pathological[tiab] OR grandiose[tiab] OR vulnerable[tiab] OR clinical[tiab] OR trait*[tiab])))`,
  `("narcissistic personality disorder"[tiab] OR "pathological narcissism"[tiab]) AND (psychotherapy[tiab] OR treatment[tiab] OR "therapeutic alliance"[tiab] OR "schema therapy"[tiab] OR psychodynamic[tiab] OR "mentalization-based therapy"[tiab])`,
  `(narcissis*[tiab] OR "pathological narcissism"[tiab]) AND (empathy[tiab] OR mentalizing[tiab] OR "social cognition"[tiab] OR fMRI[tiab] OR neuroimaging[tiab] OR "functional connectivity"[tiab] OR EEG[tiab])`,
  `("pathological narcissism"[tiab] OR "vulnerable narcissism"[tiab] OR "narcissistic personality disorder"[tiab]) AND (attachment[tiab] OR trauma[tiab] OR "childhood trauma"[tiab] OR "emotional neglect"[tiab] OR shame[tiab] OR "emotional abuse"[tiab])`,
  `(narcissis*[tiab]) AND ("social media"[tiab] OR selfie[tiab] OR Instagram[tiab] OR TikTok[tiab] OR Facebook[tiab] OR "self-presentation"[tiab] OR "online dating"[tiab])`,
  `(narcissis*[tiab] OR "narcissistic personality"[tiab]) AND (leadership[tiab] OR workplace[tiab] OR "CEO narcissism"[tiab] OR "destructive leadership"[tiab] OR "workplace bullying"[tiab])`,
  `(narcissis*[tiab] OR "pathological narcissism"[tiab]) AND ("body image"[tiab] OR "body dissatisfaction"[tiab] OR "eating disorder"[tiab] OR "disordered eating"[tiab] OR "muscle dysmorphia"[tiab] OR "self-objectification"[tiab])`,
  `(narcissis*[tiab] OR "grandiose narcissism"[tiab]) AND (sport*[tiab] OR athlete*[tiab] OR exercise[tiab] OR "exercise dependence"[tiab] OR doping[tiab] OR "performance enhancement"[tiab])`,
  `("narcissistic personality disorder"[tiab] OR "pathological narcissism"[tiab]) AND ("borderline personality disorder"[tiab] OR BPD[tiab] OR "antisocial personality disorder"[tiab] OR psychopathy[tiab] OR "dark triad"[tiab])`,
  `("narcissistic personality disorder"[tiab] OR "pathological narcissism"[tiab] OR "vulnerable narcissism"[tiab]) AND (depression[tiab] OR suicid*[tiab] OR "self-harm"[tiab] OR shame[tiab] OR "self-esteem"[tiab] OR "emotion regulation"[tiab])`,
  `(narcissis*[tiab]) AND ("intimate partner violence"[tiab] OR IPV[tiab] OR "coercive control"[tiab] OR aggression[tiab] OR violence[tiab] OR stalking[tiab])`,
  `(narcissis*[tiab] OR "narcissistic personality disorder"[tiab]) AND (adolescent*[tiab] OR youth[tiab] OR "young adult*"[tiab] OR student*[tiab])`,
];

function loadSummarizedPmids() {
  const path = "data/summarized_pmids.json";
  if (!existsSync(path)) return new Set();
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return new Set(data.pmids || []);
  } catch {
    return new Set();
  }
}

async function searchPubMed(query, retmax = 50) {
  const mindate = getDateNDaysAgo(DAYS);
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    sort: "date",
    retmode: "json",
    datetype: "pdat",
    mindate,
    maxdate: "3000/12/31",
  });
  if (NCBI_API_KEY) params.set("api_key", NCBI_API_KEY);
  const url = `${ESEARCH}?${params}`;
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`PubMed search failed: ${resp.status}`);
  const data = await resp.json();
  return data?.esearchresult?.idlist || [];
}

async function fetchSummaries(pmids) {
  if (!pmids.length) return [];
  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "json",
  });
  if (NCBI_API_KEY) params.set("api_key", NCBI_API_KEY);
  const url = `${ESUMMARY}?${params}`;
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`PubMed summary failed: ${resp.status}`);
  const data = await resp.json();
  const result = data.result || {};
  const papers = [];
  for (const pmid of pmids) {
    const item = result[pmid];
    if (!item || item.error) continue;
    const abstract = (item.abstracttext || item.abstract || "").toString().slice(0, 2000);
    papers.push({
      pmid: String(pmid),
      title: sanitizeInput((item.title || "").replace(/<[^>]*>/g, "")),
      journal: sanitizeInput(item.fulljournalname || item.source || ""),
      date: item.pubdate || "",
      abstract: sanitizeInput(abstract),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      authors: (item.authors || []).map((a) => a.name).join(", "),
      keywords: [],
    });
  }
  return papers;
}

async function main() {
  const summarized = loadSummarizedPmids();
  const allPmids = new Set();

  console.error(`[INFO] Searching PubMed for NPD papers from last ${DAYS} days...`);
  console.error(`[INFO] Already summarized: ${summarized.size} PMIDs`);

  for (let i = 0; i < SEARCH_QUERIES.length; i++) {
    try {
      const pmids = await searchPubMed(SEARCH_QUERIES[i], 20);
      console.error(`[INFO] Query ${i + 1}/${SEARCH_QUERIES.length}: found ${pmids.length} PMIDs`);
      for (const id of pmids) {
        if (!summarized.has(id)) allPmids.add(id);
      }
    } catch (e) {
      console.error(`[WARN] Query ${i + 1} failed: ${e.message}`);
    }
    if (i < SEARCH_QUERIES.length - 1) await sleep(DELAY_MS);
  }

  let pmidList = [...allPmids];
  if (pmidList.length > MAX_PAPERS) {
    pmidList = pmidList.slice(0, MAX_PAPERS);
  }

  console.error(`[INFO] Unique new PMIDs: ${allPmids.size}, fetching top ${pmidList.length}`);

  let papers = [];
  const BATCH = 50;
  for (let i = 0; i < pmidList.length; i += BATCH) {
    const batch = pmidList.slice(i, i + BATCH);
    try {
      const batchPapers = await fetchSummaries(batch);
      papers = papers.concat(batchPapers);
    } catch (e) {
      console.error(`[WARN] Fetch batch failed: ${e.message}`);
      if (i + BATCH < pmidList.length) {
        console.error(`[INFO] Retrying after delay...`);
        await sleep(2000);
        try {
          const retryPapers = await fetchSummaries(batch);
          papers = papers.concat(retryPapers);
        } catch { /* skip */ }
      }
    }
    if (i + BATCH < pmidList.length) await sleep(DELAY_MS);
  }

  console.error(`[INFO] Fetched ${papers.length} papers`);

  const output = {
    date: getToday(),
    count: papers.length,
    papers,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf8");
  console.error(`[INFO] Saved to ${OUTPUT}`);
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
