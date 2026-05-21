#!/usr/bin/env python3
"""Selective Unity AssetBundle exporter for local authorized analysis.

This tool exports supported UnityPy object types from AssetBundles:
Texture2D/Sprite -> PNG, AudioClip -> WAV, Mesh -> OBJ, plus optional text/shader/font.

It is intentionally opt-in:
- default mode is --dry-run;
- actual export requires --confirm-private-analysis;
- use narrow --bundle/--bundle-glob/--include-types filters.

Do not use this to redistribute proprietary game assets.
"""

from __future__ import annotations

import argparse
import csv
import fnmatch
import re
from pathlib import Path
from typing import Iterable

import UnityPy
from UnityPy.tools import extractor


DEFAULT_SOURCE = Path(r"F:\SteamLibrary\steamapps\common\BidKing\BidKing_Data\StreamingAssets")
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "reverse" / "bidking" / "exported_assets"
EXPORTABLE_TYPES = {
    "Texture2D",
    "Sprite",
    "AudioClip",
    "Mesh",
    "TextAsset",
    "Shader",
    "Font",
    "MonoBehaviour",
    "GameObject",
}


def safe_name(name: str, fallback: str) -> str:
    value = name.strip() if name else fallback
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value[:120] or fallback


def discover_bundles(source_root: Path, exact: list[str], globs: list[str]) -> list[Path]:
    selected: list[Path] = []
    for rel in exact:
        path = (source_root / rel).resolve()
        if path.exists() and path.is_file():
            selected.append(path)
    if globs:
        all_files = [p for p in source_root.rglob("*") if p.is_file()]
        for pattern in globs:
            normalized = pattern.replace("\\", "/")
            for path in all_files:
                rel = path.relative_to(source_root).as_posix()
                if fnmatch.fnmatch(rel, normalized):
                    selected.append(path)
    # Preserve order while deduping.
    seen = set()
    result = []
    for path in selected:
        if path not in seen:
            seen.add(path)
            result.append(path)
    return result


def object_name(obj) -> str:
    try:
        instance = obj.parse_as_object()
        return getattr(instance, "m_Name", "") or getattr(instance, "name", "") or ""
    except Exception:
        return ""


def iter_candidates(bundle_path: Path, include_types: set[str], name_re: re.Pattern[str] | None):
    env = UnityPy.load(str(bundle_path))
    for obj in env.objects:
        type_name = obj.type.name
        if type_name not in include_types:
            continue
        name = object_name(obj)
        if name_re and not name_re.search(name):
            continue
        yield obj, type_name, name


def export_candidate(obj, type_name: str, name: str, bundle_rel: str, out_root: Path) -> list[Path]:
    bundle_base = Path(bundle_rel).with_suffix("")
    base_dir = out_root / type_name / bundle_base.parent
    base_dir.mkdir(parents=True, exist_ok=True)
    fallback = f"{type_name}_{obj.path_id}"
    base = base_dir / f"{safe_name(name, fallback)}_{obj.path_id}"
    if type_name in {"Texture2D", "Sprite"}:
        export_path = f"{base}.png"
    elif type_name == "Mesh":
        export_path = f"{base}.obj"
    else:
        export_path = str(base)
    extractor.export_obj(obj, export_path, append_path_id=False, export_unknown_as_typetree=True)
    prefix = base.name
    candidates = sorted(base_dir.glob(f"{prefix}*"))
    outputs: list[Path] = []
    for candidate in candidates:
        if candidate.is_file():
            outputs.append(candidate)
        elif candidate.is_dir():
            outputs.extend(sorted(path for path in candidate.rglob("*") if path.is_file()))
    return outputs


def parse_types(raw: str) -> set[str]:
    values = {item.strip() for item in raw.split(",") if item.strip()}
    unknown = values - EXPORTABLE_TYPES
    if unknown:
        raise SystemExit(f"Unsupported type(s): {', '.join(sorted(unknown))}")
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description="Selectively export objects from Unity AssetBundles.")
    parser.add_argument("--source-root", default=str(DEFAULT_SOURCE), help="StreamingAssets root")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Export output directory")
    parser.add_argument("--bundle", action="append", default=[], help="Exact bundle path relative to source root")
    parser.add_argument("--bundle-glob", action="append", default=[], help="Glob relative to source root, e.g. ui/prefab/battle/*.data")
    parser.add_argument(
        "--include-types",
        default="Texture2D,Sprite,AudioClip,Mesh",
        help="Comma-separated Unity object types to export",
    )
    parser.add_argument("--name-regex", help="Only export objects whose m_Name matches this regex")
    parser.add_argument("--max-bundles", type=int, default=0, help="Limit number of bundles processed")
    parser.add_argument("--max-objects", type=int, default=0, help="Limit objects exported/listed")
    parser.add_argument("--dry-run", action="store_true", help="List candidates without exporting")
    parser.add_argument(
        "--confirm-private-analysis",
        action="store_true",
        help="Required for actual export; confirms you have rights/authorization for local analysis",
    )
    args = parser.parse_args()

    source_root = Path(args.source_root).resolve()
    out_root = Path(args.out).resolve()
    include_types = parse_types(args.include_types)
    name_re = re.compile(args.name_regex, re.I) if args.name_regex else None

    if not source_root.exists():
        raise SystemExit(f"Missing source root: {source_root}")
    if not args.bundle and not args.bundle_glob:
        raise SystemExit("Provide at least one --bundle or --bundle-glob filter.")
    if not args.dry_run and not args.confirm_private_analysis:
        raise SystemExit("Refusing to export without --confirm-private-analysis. Use --dry-run to inspect first.")

    bundles = discover_bundles(source_root, args.bundle, args.bundle_glob)
    if args.max_bundles:
        bundles = bundles[: args.max_bundles]
    out_root.mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    total = 0
    for bundle in bundles:
        bundle_rel = bundle.relative_to(source_root).as_posix()
        for obj, type_name, name in iter_candidates(bundle, include_types, name_re):
            total += 1
            exported_paths: list[str] = []
            status = "dry-run"
            error = ""
            if not args.dry_run:
                try:
                    exported_paths = [str(p.relative_to(out_root).as_posix()) for p in export_candidate(obj, type_name, name, bundle_rel, out_root)]
                    status = "exported" if exported_paths else "no-output"
                except Exception as exc:
                    status = "error"
                    error = f"{type(exc).__name__}: {exc}"
            manifest_rows.append(
                {
                    "bundle": bundle_rel,
                    "type": type_name,
                    "name": name,
                    "path_id": obj.path_id,
                    "status": status,
                    "outputs": "|".join(exported_paths),
                    "error": error,
                }
            )
            if args.max_objects and total >= args.max_objects:
                break
        if args.max_objects and total >= args.max_objects:
            break

    manifest = out_root / ("dry_run_manifest.csv" if args.dry_run else "export_manifest.csv")
    with manifest.open("w", encoding="utf-8", newline="") as handle:
        fieldnames = ["bundle", "type", "name", "path_id", "status", "outputs", "error"]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print(f"Bundles considered: {len(bundles)}")
    print(f"Objects matched: {len(manifest_rows)}")
    print(f"Manifest: {manifest}")
    if args.dry_run:
        print("Dry run only. Add --confirm-private-analysis and remove --dry-run to export.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
