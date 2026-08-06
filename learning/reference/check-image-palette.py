"""Measure image dimensions, corner background, and dominant colors."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

from PIL import Image


TARGET_BACKGROUND = (204, 204, 204)


def color_distance(first: tuple[int, int, int], second: tuple[int, int, int]) -> float:
    return sum((left - right) ** 2 for left, right in zip(first, second)) ** 0.5


def average_pixels(pixels: Iterable[tuple[int, int, int]]) -> tuple[int, int, int]:
    values = list(pixels)
    count = max(1, len(values))
    return tuple(round(sum(pixel[channel] for pixel in values) / count) for channel in range(3))


def corner_average(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    patch_width = max(1, width // 20)
    patch_height = max(1, height // 20)
    corners = (
        image.crop((0, 0, patch_width, patch_height)),
        image.crop((width - patch_width, 0, width, patch_height)),
        image.crop((0, height - patch_height, patch_width, height)),
        image.crop((width - patch_width, height - patch_height, width, height)),
    )
    return average_pixels(pixel for patch in corners for pixel in patch.get_flattened_data())


def dominant_colors(image: Image.Image, count: int = 8) -> list[dict[str, object]]:
    sample = image.convert("RGB").resize((96, 96))
    quantized = sample.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    histogram = quantized.getcolors(maxcolors=96 * 96) or []
    histogram.sort(reverse=True)
    total = 96 * 96
    results = []
    for pixels, index in histogram:
        offset = index * 3
        rgb = tuple(palette[offset : offset + 3])
        results.append(
            {
                "hex": "#%02X%02X%02X" % rgb,
                "rgb": list(rgb),
                "percent": round(pixels * 100 / total, 2),
            }
        )
    return results


def inspect_image(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        corners = corner_average(rgb)
        distance = color_distance(corners, TARGET_BACKGROUND)
        return {
            "file": str(path),
            "size": list(image.size),
            "mode": image.mode,
            "corner_average": {"rgb": list(corners), "hex": "#%02X%02X%02X" % corners},
            "target_background": "#CCCCCC",
            "background_distance": round(distance, 2),
            "background_match_within_25": distance <= 25,
            "dominant_colors": dominant_colors(rgb),
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = [inspect_image(path) for path in args.images]
    serialized = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
