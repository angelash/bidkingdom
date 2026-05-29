#!/usr/bin/env python3
"""Extract read-only BidKing Unity analysis artifacts.

This script is intentionally conservative:
- decode table/config text into TSV files;
- restore local hot-update DLL/PDB bytes for metadata analysis;
- index resources and AssetBundle manifest dependencies;
- do not export image/audio/model payloads beyond path/hash metadata.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
from typing import Any


SOURCE_ROOT = Path(os.environ.get("BIDKING_UNITY_ROOT", "reverse/local/BidKing"))
STREAMING = SOURCE_ROOT / "BidKing_Data" / "StreamingAssets"
OUT_ROOT = Path(__file__).resolve().parents[1] / "reverse" / "bidking"
XOR_KEY = bytes.fromhex("72797273")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def rel(path: Path, root: Path = SOURCE_ROOT) -> str:
    return path.relative_to(root).as_posix()


def decode_tables() -> dict[str, Any]:
    source = STREAMING / "Tables"
    out = OUT_ROOT / "config" / "tables_tsv"
    out.mkdir(parents=True, exist_ok=True)
    index: list[dict[str, Any]] = []

    for table_path in sorted(source.glob("*.txt")):
        encoded = table_path.read_text(encoding="utf-8", errors="replace").strip()
        decoded = base64.b64decode(encoded)
        text = decoded.decode("utf-8-sig", errors="replace")
        rows = [line.split("\t") for line in text.splitlines() if line]
        col_counts = sorted({len(row) for row in rows})
        out_path = out / table_path.name
        out_path.write_text(text, encoding="utf-8", newline="")
        preview = rows[0][: min(8, len(rows[0]))] if rows else []
        index.append(
            {
                "name": table_path.name,
                "source": rel(table_path),
                "output": out_path.relative_to(OUT_ROOT).as_posix(),
                "encoded_bytes": table_path.stat().st_size,
                "decoded_bytes": len(decoded),
                "rows": len(rows),
                "column_counts": col_counts,
                "first_row_preview": preview,
                "decoded_sha256": sha256_bytes(decoded),
            }
        )

    write_json(OUT_ROOT / "config" / "tables_index.json", index)
    write_csv(
        OUT_ROOT / "config" / "tables_index.csv",
        index,
        [
            "name",
            "source",
            "output",
            "encoded_bytes",
            "decoded_bytes",
            "rows",
            "column_counts",
            "first_row_preview",
            "decoded_sha256",
        ],
    )
    return {"tables": len(index), "out": str(out)}


def decode_dll_bytes() -> dict[str, Any]:
    source = STREAMING / "dll"
    out = OUT_ROOT / "code" / "decoded_assemblies"
    out.mkdir(parents=True, exist_ok=True)
    index: list[dict[str, Any]] = []

    for source_path in sorted(source.glob("*.bytes")):
        data = source_path.read_bytes()
        first4 = data[:4]
        transform = "none"
        decoded = data
        if first4 == b"MZ\x90\x00" or first4 == b"BSJB":
            transform = "none"
        elif first4 in {b"?#\xe2s", b"0*81"}:
            decoded = bytes(byte ^ XOR_KEY[i % len(XOR_KEY)] for i, byte in enumerate(data))
            transform = "xor-72797273"
        output_name = source_path.name.removesuffix(".bytes")
        out_path = out / output_name
        out_path.write_bytes(decoded)
        index.append(
            {
                "name": source_path.name,
                "source": rel(source_path),
                "output": out_path.relative_to(OUT_ROOT).as_posix(),
                "transform": transform,
                "source_first4_hex": first4.hex("-"),
                "decoded_first4_hex": decoded[:4].hex("-"),
                "bytes": len(decoded),
                "decoded_sha256": sha256_bytes(decoded),
            }
        )

    write_json(OUT_ROOT / "code" / "decoded_assemblies_index.json", index)
    write_csv(
        OUT_ROOT / "code" / "decoded_assemblies_index.csv",
        index,
        [
            "name",
            "source",
            "output",
            "transform",
            "source_first4_hex",
            "decoded_first4_hex",
            "bytes",
            "decoded_sha256",
        ],
    )
    return {"files": len(index), "out": str(out)}


def parse_filelist() -> dict[str, Any]:
    path = STREAMING / "filelist.txt"
    rows: list[dict[str, Any]] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    header = lines[0] if lines else ""
    version = None
    declared_count = None
    match = re.search(r"Ver:(\d+)\|FileCount:(\d+)", header)
    if match:
        version = int(match.group(1))
        declared_count = int(match.group(2))
    for line in lines[1:]:
        if "|" not in line or "=$" not in line:
            continue
        file_path, rest = line.split("|", 1)
        checksum, size_text = rest.rsplit("=$", 1)
        local_path = STREAMING / file_path
        exists = local_path.exists()
        size = int(size_text) if size_text.isdigit() else None
        rows.append(
            {
                "path": file_path,
                "checksum": checksum,
                "declared_size": size,
                "local_exists": exists,
                "local_size": local_path.stat().st_size if exists and local_path.is_file() else None,
                "top_folder": file_path.split("/", 1)[0] if "/" in file_path else "",
            }
        )

    write_json(
        OUT_ROOT / "resources" / "filelist_index.json",
        {"version": version, "declared_count": declared_count, "actual_entries": len(rows), "entries": rows},
    )
    write_csv(
        OUT_ROOT / "resources" / "filelist_index.csv",
        rows,
        ["path", "checksum", "declared_size", "local_exists", "local_size", "top_folder"],
    )

    diff_path = STREAMING / "fileDiff.txt"
    urls = [line.strip() for line in diff_path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip()]
    write_json(OUT_ROOT / "resources" / "filediff_urls.json", {"urls": urls})
    return {"filelist_entries": len(rows), "filediff_urls": len(urls)}


def parse_assetbundle_manifest() -> dict[str, Any]:
    path = STREAMING / "StandaloneWindows64.manifest"
    bundles: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if stripped.startswith("Name: "):
            if current:
                bundles.append(current)
            current = {"name": stripped.removeprefix("Name: "), "dependencies": []}
        elif current and stripped.startswith("Dependency_"):
            _, value = stripped.split(":", 1)
            current["dependencies"].append(value.strip())
    if current:
        bundles.append(current)

    dep_rows: list[dict[str, Any]] = []
    for bundle in bundles:
        for dep in bundle["dependencies"]:
            dep_rows.append({"bundle": bundle["name"], "dependency": dep})

    write_json(
        OUT_ROOT / "resources" / "assetbundle_manifest_index.json",
        {"source": rel(path), "bundle_count": len(bundles), "dependency_edges": len(dep_rows), "bundles": bundles},
    )
    write_csv(
        OUT_ROOT / "resources" / "assetbundle_manifest_bundles.csv",
        [{"name": b["name"], "dependency_count": len(b["dependencies"])} for b in bundles],
        ["name", "dependency_count"],
    )
    write_csv(
        OUT_ROOT / "resources" / "assetbundle_manifest_dependencies.csv",
        dep_rows,
        ["bundle", "dependency"],
    )
    return {"bundles": len(bundles), "dependencies": len(dep_rows)}


def index_streaming_assets() -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for current_root, _, filenames in os.walk(STREAMING):
        root = Path(current_root)
        for filename in filenames:
            path = root / filename
            relative = rel(path, STREAMING)
            parts = relative.split("/")
            suffix = path.suffix.lower()
            rows.append(
                {
                    "path": relative,
                    "top_folder": parts[0] if len(parts) > 1 else "",
                    "extension": suffix,
                    "size": path.stat().st_size,
                    "has_sidecar_manifest": (path.parent / f"{path.name}.manifest").exists(),
                }
            )

    write_csv(
        OUT_ROOT / "resources" / "streaming_assets_index.csv",
        rows,
        ["path", "top_folder", "extension", "size", "has_sidecar_manifest"],
    )

    summary: dict[str, dict[str, float | int]] = {}
    for row in rows:
        key = str(row["top_folder"])
        bucket = summary.setdefault(key, {"files": 0, "bytes": 0})
        bucket["files"] = int(bucket["files"]) + 1
        bucket["bytes"] = int(bucket["bytes"]) + int(row["size"])
    for bucket in summary.values():
        bucket["mb"] = round(int(bucket["bytes"]) / (1024 * 1024), 2)

    write_json(
        OUT_ROOT / "resources" / "streaming_assets_summary.json",
        {"root": str(STREAMING), "files": len(rows), "by_top_folder": summary},
    )
    return {"streaming_files": len(rows), "folders": len(summary)}


def copy_manifests_and_records() -> dict[str, Any]:
    out = OUT_ROOT / "config" / "update_manifests"
    out.mkdir(parents=True, exist_ok=True)
    copied = []
    for name in ["fileVersion", "filelist.txt", "fileDiff.txt", "StandaloneWindows64.manifest"]:
        source = STREAMING / name
        if source.exists():
            destination = out / name
            shutil.copyfile(source, destination)
            copied.append(destination.relative_to(OUT_ROOT).as_posix())
    return {"copied": copied}


def main() -> int:
    if not SOURCE_ROOT.exists():
        raise SystemExit(f"Missing source: {SOURCE_ROOT}")
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    summary = {
        "source": str(SOURCE_ROOT),
        "output": str(OUT_ROOT),
        "tables": decode_tables(),
        "code": decode_dll_bytes(),
        "filelist": parse_filelist(),
        "asset_manifest": parse_assetbundle_manifest(),
        "resources": index_streaming_assets(),
        "manifests": copy_manifests_and_records(),
    }
    write_json(OUT_ROOT / "extraction_summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
