#!/usr/bin/env python3
"""
Rebuild strings.mr.js and MARATHI_WORKSHEET.md from the keys in index.html.

Run this whenever markup changes (a key added, removed or reworded):

    python3 tools/build-i18n.py

Any Marathi already filled into strings.mr.js is PRESERVED — the file is parsed
first and existing non-empty values are carried across. New keys arrive empty,
and keys that no longer exist in the markup are dropped and reported.

An entry left empty is treated by the runtime as "not translated", so the English
stays on the page. That means this file is safe to ship half-finished.
"""

import html as H
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'index.html')
STRINGS = os.path.join(ROOT, 'strings.mr.js')
WORKSHEET = os.path.join(ROOT, 'MARATHI_WORKSHEET.md')


def extract_keys(src):
    """Return (ordered_keys, {key: english}) from the markup."""
    src = re.sub(r'<!--.*?-->', '', src, flags=re.S)   # never key off commented markup
    entries, order = {}, []

    def add(key, value):
        key = key.strip()
        if not key:
            return
        value = re.sub(r'\s+', ' ', H.unescape(value)).strip()
        if key not in entries:
            entries[key] = value
            order.append(key)
        elif not entries[key] and value:
            entries[key] = value

    # element text (data-i18n) and markup-bearing text (data-i18n-html)
    for m in re.finditer(r'<([a-zA-Z0-9]+)\b([^>]*?)data-i18n(-html)?="([^"]+)"([^>]*)>', src):
        tag, key = m.group(1), m.group(4)
        start = i = m.end()
        depth = 1
        pat = re.compile(r'</?' + tag + r'\b', re.I)
        while depth and i < len(src):
            mm = pat.search(src, i)
            if not mm:
                break
            depth += -1 if src[mm.start():mm.start() + 2 + len(tag)].startswith('</') else 1
            i = mm.end()
        inner = src[start:src.rfind('<', start, i)] if i > start else ''
        add(key, re.sub(r'<[^>]+>', '', inner))

    # attribute keys: data-i18n-attr="alt:some.key, data-modal-title:other.key"
    for m in re.finditer(r'data-i18n-attr="([^"]+)"', src):
        tagm = re.search(r'<[^>]*data-i18n-attr="' + re.escape(m.group(1)) + r'"[^>]*>', src, re.S)
        tag = tagm.group(0) if tagm else ''
        for pair in m.group(1).split(','):
            bits = pair.split(':')
            if len(bits) < 2:
                continue
            attr, key = bits[0].strip(), bits[1].strip()
            av = re.search(re.escape(attr) + r'="([^"]*)"', tag)
            add(key, av.group(1) if av else '')

    return order, entries


def read_existing(path):
    """Pull already-translated values out of the current strings file."""
    if not os.path.exists(path):
        return {}
    text = open(path, encoding='utf-8').read()
    found = {}
    for m in re.finditer(r"^\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'", text, re.M):
        key = m.group(1).replace("\\'", "'").replace('\\\\', '\\')
        val = m.group(2).replace("\\'", "'").replace('\\\\', '\\')
        if val.strip():
            found[key] = val
    return found


def jsq(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    order, english = extract_keys(open(HTML, encoding='utf-8').read())
    existing = read_existing(STRINGS)

    kept = {k: v for k, v in existing.items() if k in english}
    dropped = sorted(set(existing) - set(english))

    groups = {}
    for k in order:
        groups.setdefault(k.split('.')[0], []).append(k)

    out = io.StringIO()
    out.write("""// ── ACT4AMR — Marathi strings ────────────────────────────────────────────
//
//  ⚠  MACHINE-DRAFTED, NOT REVIEWED BY A MARATHI SPEAKER  ⚠
//
//  Every value below was drafted by Claude and has NOT been checked by a native
//  speaker or a clinician. This page publishes public-health guidance under the
//  Public Health Department, NHM, CHRI, PATH and GSK names. Wrong wording on how
//  to take or dispose of antibiotics is a safety problem, not a typo.
//
//  HAVE A MARATHI SPEAKER REVIEW THIS FILE BEFORE THE PAGE GOES PUBLIC.
//  Pay closest attention to: pledge.commitments.*, journey.step*.detail,
//  about.card*.body and hero.body — those carry the actual medical instruction.
//
// ─────────────────────────────────────────────────────────────────────────
// The English above each line is the source text.
//
//   • An entry left as '' counts as NOT translated and the English shows
//     instead, so this file is safe to ship half-finished. Translate in any
//     order — each completed line goes live on its own.
//   • Keep the keys exactly as they are. Only the values change.
//   • Some strings carry inline markup (<strong>…</strong>). Keep those tags in
//     the Marathi or the emphasis is lost.
//   • This is public-health guidance published under government and partner
//     branding. It should be written or reviewed by a Marathi speaker, not
//     machine-translated.
//
// Regenerate after markup changes with:  python3 tools/build-i18n.py
// Existing translations are preserved.
//
// Loaded lazily by app.js only when the reader switches to Marathi, so English
// never pays for this file.
registerStrings('mr', {
""")
    for group, keys in groups.items():
        out.write("\n  // ── %s %s\n" % (group, "─" * max(0, 58 - len(group))))
        for k in keys:
            if english[k]:
                out.write("  // EN: %s\n" % english[k])
            out.write("  %s: %s,\n" % (jsq(k), jsq(kept.get(k, ''))))
    out.write("});\n")
    open(STRINGS, 'w', encoding='utf-8').write(out.getvalue())

    w = io.StringIO()
    w.write("# ACT4AMR — Marathi translation worksheet\n\n")
    w.write("%d strings. Fill the **Marathi** column, then paste each value into the\n" % len(order))
    w.write("matching key in `strings.mr.js`. Anything left blank stays English on the page,\n")
    w.write("so this can be done a section at a time.\n\n")
    w.write("Keep any `<strong>` tags. This is public-health guidance published under\n")
    w.write("government and partner branding, so it needs a Marathi speaker rather than\n")
    w.write("machine translation.\n")
    for group, keys in groups.items():
        done = sum(1 for k in keys if kept.get(k))
        w.write("\n## %s  (%d/%d done)\n\n| Key | English | Marathi |\n|---|---|---|\n"
                % (group, done, len(keys)))
        for k in keys:
            w.write("| `%s` | %s | %s |\n"
                    % (k, english[k].replace('|', '\\|'), kept.get(k, '').replace('|', '\\|')))
    open(WORKSHEET, 'w', encoding='utf-8').write(w.getvalue())

    print("keys in markup:      %d" % len(order))
    print("translations kept:   %d" % len(kept))
    print("still to translate:  %d" % (len(order) - len(kept)))
    if dropped:
        print("dropped (no longer in markup): %s" % ", ".join(dropped))
    blank_en = [k for k in order if not english[k]]
    if blank_en:
        print("WARNING — keys with no English source: %s" % ", ".join(blank_en))
    return 0


if __name__ == '__main__':
    sys.exit(main())
