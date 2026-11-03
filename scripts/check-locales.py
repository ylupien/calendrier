#!/usr/bin/env python3
"""Checks the translations: same keys in French and English, and every t('…') key used in the code exists.

    python3 scripts/check-locales.py

Frontend: frontend/src/locales/<lang>/<Name>.json (key "Name.path.to.key").
Backend:  backend/src/locales/<lang>.json.
Plural keys (key_one, key_other, key_zero) count as the key itself.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ('fr', 'en')
PLURAL = re.compile(r'_(zero|one|two|few|many|other)$')


def flatten(obj, prefix=''):
    keys = set()
    for k, v in obj.items():
        path = f'{prefix}.{k}' if prefix else k
        keys |= flatten(v, path) if isinstance(v, dict) else {path}
    return keys


def frontend_keys(lang):
    keys = set()
    for f in sorted((ROOT / 'frontend/src/locales' / lang).glob('*.json')):
        keys |= flatten(json.loads(f.read_text(encoding='utf-8')), f.stem)
    return keys


def backend_keys(lang):
    f = ROOT / 'backend/src/locales' / f'{lang}.json'
    return flatten(json.loads(f.read_text(encoding='utf-8'))) if f.exists() else set()


def used_keys(folder, patterns, exts):
    """patterns: (regex, prefix) — the prefix is added to the key found (HttpError keys live under errors.)."""
    found = {}
    for f in (ROOT / folder).rglob('*'):
        if f.suffix not in exts or 'node_modules' in f.parts:
            continue
        text = f.read_text(encoding='utf-8')
        for pattern, prefix in patterns:
            for m in re.finditer(pattern, text):
                found.setdefault(prefix + m.group(1), f.relative_to(ROOT))
    return found


def report(label, keys_by_lang, used):
    errors = 0
    fr, en = (keys_by_lang[l] for l in LANGS)
    for missing, lang in ((fr - en, 'en'), (en - fr, 'fr')):
        for k in sorted(missing):
            print(f'[{label}] absente en {lang} : {k}')
            errors += 1
    known = {PLURAL.sub('', k) for k in fr | en} | fr | en
    for k, where in sorted(used.items()):
        # Dynamic keys (`common.theme.${mode}`) are not checked.
        if '${' in k or k.endswith('.'):
            continue
        if k not in known:
            print(f'[{label}] clé inconnue {k} ({where})')
            errors += 1
    return errors


errors = report(
    'frontend',
    {l: frontend_keys(l) for l in LANGS},
    used_keys('frontend/src', [(r"\bth?\(\s*'([^']+)'", ''), (r'\bth?\(\s*"([^"]+)"', '')], {'.svelte', '.js'}),
)
if (ROOT / 'backend/src/locales').exists():
    errors += report(
        'backend',
        {l: backend_keys(l) for l in LANGS},
        used_keys('backend/src', [(r"\bt\(\s*'([^']+)'", ''), (r"HttpError\(\s*\d+\s*,\s*'([^']+)'", 'errors.')], {'.js'}),
    )
print('Traductions : OK' if not errors else f'{errors} problème(s)')
sys.exit(1 if errors else 0)
