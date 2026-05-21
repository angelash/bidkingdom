#!/usr/bin/env python3
"""Validate generated BidKing item art against the prompt manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_repo_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def parse_hex_color(value: str) -> tuple[int, int, int]:
    text = value.strip().lstrip("#")
    return tuple(int(text[index : index + 2], 16) for index in (0, 2, 4))


def alpha_bbox(alpha: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    return mask.getbbox()


def corner_max_alpha(alpha: Image.Image, size: int) -> int:
    width, height = alpha.size
    boxes = [
        (0, 0, size, size),
        (max(0, width - size), 0, width, size),
        (0, max(0, height - size), size, height),
        (max(0, width - size), max(0, height - size), width, height)
    ]
    max_alpha = 0
    for box in boxes:
        pixels = list(alpha.crop(box).getdata())
        if pixels:
            max_alpha = max(max_alpha, max(pixels))
    return max_alpha


def border_opaque_pixels(alpha: Image.Image, threshold: int) -> int:
    width, height = alpha.size
    count = 0
    pixels = alpha.load()
    for x in range(width):
        if pixels[x, 0] > threshold:
            count += 1
        if pixels[x, height - 1] > threshold:
            count += 1
    for y in range(1, height - 1):
        if pixels[0, y] > threshold:
            count += 1
        if pixels[width - 1, y] > threshold:
            count += 1
    return count


def chroma_residue_ratio(image: Image.Image, key: tuple[int, int, int], threshold: int) -> float:
    rgba = image.convert("RGBA")
    opaque = 0
    residue = 0
    for r, g, b, a in rgba.getdata():
        if a <= threshold:
            continue
        opaque += 1
        if abs(r - key[0]) <= 18 and abs(g - key[1]) <= 18 and abs(b - key[2]) <= 18:
            residue += 1
    return residue / opaque if opaque else 0.0


def validate_item(prompt: dict[str, Any], config: dict[str, Any]) -> list[str]:
    rules = config["validation"]
    threshold = int(rules["alphaThreshold"])
    key = parse_hex_color(config["chromaKey"])
    output = resolve_repo_path(prompt["output"])
    errors: list[str] = []

    if not output.exists():
        return [f"missing output: {output.relative_to(REPO_ROOT)}"]

    with Image.open(output) as image:
        expected_size = (int(prompt["canvas"]["width"]), int(prompt["canvas"]["height"]))
        if image.size != expected_size:
            errors.append(f"size {image.size[0]}x{image.size[1]} != expected {expected_size[0]}x{expected_size[1]}")
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        alpha = image.getchannel("A")
        bbox = alpha_bbox(alpha, threshold)
        if bbox is None:
            return errors + ["blank alpha subject"]

        width, height = image.size
        total = width * height
        opaque_count = sum(1 for value in alpha.getdata() if value > threshold)
        coverage = opaque_count / total
        if coverage < float(rules["minOpaqueCoverage"]):
            errors.append(f"opaque coverage {coverage:.4f} below minimum")
        if coverage > float(rules["maxOpaqueCoverage"]):
            errors.append(f"opaque coverage {coverage:.4f} above maximum")

        max_corner = corner_max_alpha(alpha, int(rules["cornerSampleSize"]))
        if max_corner > int(rules["transparentCornerMaxAlpha"]):
            errors.append(f"corner alpha {max_corner} above transparent limit")

        border_count = border_opaque_pixels(alpha, threshold)
        if border_count > int(rules["borderOpaqueMaxPixels"]):
            errors.append(f"{border_count} opaque border pixels")

        left, top, right, bottom = bbox
        bbox_w = right - left
        bbox_h = bottom - top
        fill_x = bbox_w / width
        fill_y = bbox_h / height
        short_fill = min(fill_x, fill_y)
        long_fill = max(fill_x, fill_y)
        if short_fill < float(rules["minBboxFillShortAxis"]):
            errors.append(f"bbox short-axis fill {short_fill:.3f} below minimum")
        if long_fill < float(rules["minBboxFillLongAxis"]):
            errors.append(f"bbox long-axis fill {long_fill:.3f} below minimum")
        if fill_x > float(rules["maxBboxFillAxis"]) or fill_y > float(rules["maxBboxFillAxis"]):
            errors.append(f"bbox fill {fill_x:.3f}x{fill_y:.3f} too close to canvas edge")

        min_edge_padding = min(left, top, width - right, height - bottom) / min(width, height)
        if min_edge_padding < float(rules["minEdgePaddingRatio"]):
            errors.append(f"edge padding {min_edge_padding:.3f} below minimum")

        residue = chroma_residue_ratio(image, key, threshold)
        if residue > float(rules["maxChromaResidueRatio"]):
            errors.append(f"chroma residue {residue:.5f} above maximum")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate generated BidKing item art.")
    parser.add_argument("--config", default="tools/bidking-item-art.config.json")
    parser.add_argument("--sample", action="store_true", help="Validate configured sample items")
    parser.add_argument("--all", action="store_true", help="Validate all manifest items")
    parser.add_argument("--item-id", type=int, action="append", default=[], help="Validate a specific item id; repeatable")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    args = parser.parse_args()

    config = load_json(resolve_repo_path(args.config))
    manifest = load_json(resolve_repo_path(config["sourcePrompts"]))
    prompts = {int(prompt["itemId"]): prompt for prompt in manifest["prompts"]}
    if args.all:
        item_ids = sorted(prompts)
    elif args.item_id:
        item_ids = args.item_id
    else:
        item_ids = [int(item["itemId"]) for item in config["sampleItems"]]

    results = []
    failed = 0
    for item_id in item_ids:
        prompt = prompts.get(item_id)
        if prompt is None:
            errors = [f"item {item_id} missing from manifest"]
        else:
            errors = validate_item(prompt, config)
        failed += 1 if errors else 0
        results.append({"itemId": item_id, "ok": not errors, "errors": errors})

    if args.json:
        print(json.dumps({"checked": len(results), "failed": failed, "results": results}, ensure_ascii=False, indent=2))
    else:
        for result in results:
            status = "OK" if result["ok"] else "FAIL"
            print(f"{status} {result['itemId']}")
            for error in result["errors"]:
                print(f"  - {error}")
        print(f"checked={len(results)} failed={failed}")

    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
