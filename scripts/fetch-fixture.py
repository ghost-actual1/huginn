#!/usr/bin/env python3
"""Fetch a slice of live headlines into fixtures/headlines.json.

Used by scripts/cluster-eval.mjs so threshold changes are measured against real
headlines instead of invented ones. Stdlib only.

    python3 scripts/fetch-fixture.py [--limit 20] [--out fixtures/headlines.json]
"""

import argparse
import html
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# Imported lazily from the JS registry so there is exactly one source of truth.
SOURCES_JS = "src/sources.js"


def read_sources():
    text = open(SOURCES_JS, encoding="utf-8").read()
    out = []
    for blob in re.finditer(r"\{ id: '([^']+)'.*?rss: '([^']+)'", text):
        out.append((blob.group(1), blob.group(2)))
    return out


def tag(item, name):
    m = re.search(r"<{0}[^>]*>([\s\S]*?)</{0}>".format(name), item, re.I)
    if not m:
        return ""
    value = re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1))
    value = re.sub(r"<[^>]*>", "", value)
    return html.unescape(value).strip()


def fetch(pair):
    source_id, url = pair
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HUGINN/3.0 fixture"})
        raw = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001 - one dead feed must not stop the run
        return source_id, [], str(exc)[:80]
    blocks = re.findall(r"<item[\s>][\s\S]*?</item>", raw, re.I) or re.findall(r"<entry[\s>][\s\S]*?</entry>", raw, re.I)
    items = []
    for block in blocks:
        title = tag(block, "title")
        if not title:
            continue
        desc = tag(block, "description") or tag(block, "summary")
        items.append({"sourceId": source_id, "title": title, "description": re.sub(r"\s+", " ", desc)[:400]})
        if len(items) >= limit:
            break
    return source_id, items, None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--out", default="fixtures/headlines.json")
    args = ap.parse_args()
    limit = args.limit

    sources = read_sources()
    results = []
    with ThreadPoolExecutor(16) as pool:
        for source_id, items, err in pool.map(fetch, sources):
            if err:
                print("fail", source_id, err)
            results.extend(items)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=1, ensure_ascii=False)
    print(len(results), "headlines from", len(sources), "sources ->", args.out)
