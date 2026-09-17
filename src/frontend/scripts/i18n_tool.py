# -*- coding: utf-8 -*-
"""
i18n helper for the VYRLE frontend (Swedish-string-as-key dictionaries).

  python i18n_tool.py check                 -> counts, conflicts, missing keys (one JSON string per line)
  python i18n_tool.py add <ns> <pairs.json> -> append [[sv, en], ...] to src/i18n/en/<ns>.ts (skips keys that exist anywhere)

Run from src/frontend.
"""
import io, re, sys, glob, json, os

SRC = 'src'
EN_DIR = os.path.join(SRC, 'i18n', 'en')
STR = r"""'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\$])*)`"""
CALL = re.compile(r"(?<![\w.$])t\(\s*(?:" + STR + r")\s*\)", re.S)
PAIR = re.compile(r"(?:'((?:\\.|[^'\\])*)'|\"((?:\\.|[^\"\\])*)\")\s*:\s*(?:'((?:\\.|[^'\\])*)'|\"((?:\\.|[^\"\\])*)\")", re.S)

def unesc(s):
    def u(m): return chr(int(m.group(1), 16))
    s = re.sub(r'\\u([0-9a-fA-F]{4})', u, s)
    return s.replace("\\'", "'").replace('\\"', '"').replace('\\`', '`').replace('\\n', '\n').replace('\\\\', '\\')

def read(p): return io.open(p, encoding='utf-8').read()

def dictionaries():
    out = {}
    for f in sorted(glob.glob(os.path.join(EN_DIR, '*.ts'))):
        ns = os.path.basename(f)[:-3]
        if ns == 'index': continue
        d = {}
        for m in PAIR.finditer(read(f)):
            k = unesc(m.group(1) if m.group(1) is not None else m.group(2))
            v = unesc(m.group(3) if m.group(3) is not None else m.group(4))
            d[k] = v
        out[ns] = d
    return out

def call_sites():
    keys = {}
    for f in glob.glob(os.path.join(SRC, '**', '*.ts*'), recursive=True):
        f = f.replace('\\', '/')
        if '/i18n/' in f: continue
        for m in CALL.finditer(read(f)):
            raw = next(g for g in m.groups() if g is not None)
            keys.setdefault(unesc(raw), f)
    return keys

def check():
    dicts = dictionaries()
    merged, conflicts = {}, []
    for ns, d in dicts.items():
        print("%-16s %d keys" % (ns + '.ts', len(d)))
        for k, v in d.items():
            if k in merged and merged[k][1] != v: conflicts.append((k, merged[k][0], ns))
            merged.setdefault(k, (ns, v))
    print("conflicting duplicate keys: %d" % len(conflicts))
    for k, a, b in conflicts: print("  CONFLICT %s (%s vs %s)" % (json.dumps(k, ensure_ascii=False), a, b))
    sites = call_sites()
    missing = [k for k in sites if k not in merged]
    print("t() call sites: %d, missing EN entries: %d" % (len(sites), len(missing)))
    for k in missing: print("  MISSING " + json.dumps(k, ensure_ascii=False) + "   <- " + sites[k])

def q(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"

def add(ns, pairs_file):
    merged = {}
    for d in dictionaries().values(): merged.update(d)
    pairs = json.load(io.open(pairs_file, encoding='utf-8'))
    path = os.path.join(EN_DIR, ns + '.ts')
    s = read(path)
    ins = ''.join("  %s: %s,\n" % (q(k), q(v)) for k, v in pairs if k not in merged)
    i = s.rfind('};')
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s[:i] + ins + s[i:])
    print("added %d of %d to %s.ts" % (ins.count('\n'), len(pairs), ns))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) >= 2 and sys.argv[1] == 'add': add(sys.argv[2], sys.argv[3])
    else: check()
