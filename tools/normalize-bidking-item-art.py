#!/usr/bin/env python3
"""Normalize generated BidKing item art to the prompt-defined canvas.

The image generator is asked for a flat chroma-key background, but the final
game asset must be an alpha PNG whose canvas exactly matches Item.slot_type.
This tool removes the key color, trims the subject, scales it into the target
canvas with stable padding, and writes the configured project output path.
"""

from __future__ import annotations

import argparse
import json
import math
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
    if len(text) != 6:
        raise ValueError(f"Expected #rrggbb color, got {value!r}")
    return tuple(int(text[index : index + 2], 16) for index in (0, 2, 4))


def find_prompt(prompts: list[dict[str, Any]], item_id: int) -> dict[str, Any]:
    for prompt in prompts:
        if int(prompt["itemId"]) == item_id:
            return prompt
    raise SystemExit(f"Item {item_id} not found in prompt manifest")


def remove_chroma(image: Image.Image, key: tuple[int, int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    hard = 34.0
    soft = 96.0
    background: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []

    def chroma_distance(r: int, g: int, b: int) -> float:
        return math.sqrt((r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2)

    def is_background_like(r: int, g: int, b: int, a: int) -> bool:
        if a == 0:
            return True
        if chroma_distance(r, g, b) < 148.0:
            return True
        if key[1] > key[0] and key[1] > key[2]:
            return g >= 56 and g - max(r, b) >= 28 and r <= 150 and b <= 150
        return False

    for x in range(width):
        for y in (0, height - 1):
            if is_background_like(*pixels[x, y]):
                stack.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if is_background_like(*pixels[x, y]):
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in background:
            continue
        if not is_background_like(*pixels[x, y]):
            continue
        background.add((x, y))
        if x > 0:
            stack.append((x - 1, y))
        if x + 1 < width:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y + 1 < height:
            stack.append((x, y + 1))

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if (x, y) in background:
                pixels[x, y] = (r, g, b, 0)
                continue
            distance = chroma_distance(r, g, b)
            if distance <= hard:
                pixels[x, y] = (r, g, b, 0)
            elif distance < soft:
                keep = (distance - hard) / (soft - hard)
                new_alpha = int(a * keep)
                # Simple despill for the default green key.
                if key[1] > key[0] and key[1] > key[2]:
                    g = min(g, int((r + b) / 2 + 24))
                pixels[x, y] = (r, g, b, new_alpha)
    return rgba


def alpha_bbox(image: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    return mask.getbbox()


def normalize(input_path: Path, output_path: Path, target_size: tuple[int, int], key: tuple[int, int, int], padding_ratio: float) -> None:
    image = Image.open(input_path)
    keyed = remove_chroma(image, key)
    bbox = alpha_bbox(keyed, 12)
    if bbox is None:
        raise SystemExit(f"No non-transparent subject found after chroma removal: {input_path}")

    subject = keyed.crop(bbox)
    target_w, target_h = target_size
    pad_x = max(1, round(target_w * padding_ratio))
    pad_y = max(1, round(target_h * padding_ratio))
    fit_w = max(1, target_w - pad_x * 2)
    fit_h = max(1, target_h - pad_y * 2)
    scale = min(fit_w / subject.width, fit_h / subject.height)
    resized_w = max(1, round(subject.width * scale))
    resized_h = max(1, round(subject.height * scale))
    subject = subject.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    offset = ((target_w - resized_w) // 2, (target_h - resized_h) // 2)
    canvas.alpha_composite(subject, offset)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize one generated BidKing item image.")
    parser.add_argument("--config", default="tools/bidking-item-art.config.json")
    parser.add_argument("--item-id", type=int, required=True)
    parser.add_argument("--input", required=True, help="Raw generated image path")
    parser.add_argument("--output", help="Optional override for final PNG path")
    args = parser.parse_args()

    config = load_json(resolve_repo_path(args.config))
    manifest = load_json(resolve_repo_path(config["sourcePrompts"]))
    prompt = find_prompt(manifest["prompts"], args.item_id)
    canvas = prompt["canvas"]
    output = resolve_repo_path(args.output) if args.output else resolve_repo_path(prompt["output"])
    normalize(
      input_path=resolve_repo_path(args.input),
      output_path=output,
      target_size=(int(canvas["width"]), int(canvas["height"])),
      key=parse_hex_color(config["chromaKey"]),
      padding_ratio=float(config["paddingRatio"])
    )
    print(f"normalized item {args.item_id} -> {output.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
