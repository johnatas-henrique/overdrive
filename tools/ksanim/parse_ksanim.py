#!/usr/bin/env python3
"""Parse Assetto Corsa KSANIM transform clips into JSON.

The parser implements the two KSANIM layouts verified against the Benetton B189
animation samples. Version 2 stores quaternion, position, and scale values as
ten little-endian float32 values per frame. Version 1 stores a 4x4 transform
matrix as sixteen little-endian float32 values per frame.

Example:
    python tools/ksanim/parse_ksanim.py input.ksanim output.json
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import BinaryIO


VERSION_1 = 1
VERSION_2 = 2
VERSION_1_FRAME_FLOAT_COUNT = 16
VERSION_2_FRAME_FLOAT_COUNT = 10
GLOBAL_HEADER_SIZE_BYTES = 12
TARGET_HEADER_SIZE_BYTES = 4
QUATERNION_TOLERANCE = 0.01


class KsanImFormatError(ValueError):
    """Raised when a KSANIM file violates the expected binary layout."""


@dataclass(frozen=True)
class TransformFrame:
    """One local transform sample from a KSANIM target."""

    quaternion: tuple[float, float, float, float] | None = None
    position: tuple[float, float, float] | None = None
    scale: tuple[float, float, float] | None = None
    matrix: tuple[float, ...] | None = None


@dataclass(frozen=True)
class AnimationTarget:
    """A named animated object and its ordered transform frames."""

    name: str
    frames: tuple[TransformFrame, ...]


@dataclass(frozen=True)
class AnimationClip:
    """Parsed KSANIM clip data and format metadata."""

    format_version: int
    header_value: int
    frame_size_bytes: int
    targets: tuple[AnimationTarget, ...]


def _read_uint32(stream: BinaryIO, offset: int, label: str) -> int:
    """Read one little-endian uint32 or raise a contextual format error."""

    stream.seek(offset)
    raw = stream.read(4)
    if len(raw) != 4:
        raise KsanImFormatError(
            f"Cannot read {label} at byte offset {offset}; expected 4 bytes, got {len(raw)}."
        )
    return struct.unpack("<I", raw)[0]


def _read_name(stream: BinaryIO, offset: int, name_length: int) -> tuple[str, int]:
    """Read an ASCII target name and return it with the next byte offset."""

    if name_length == 0:
        raise KsanImFormatError(f"Target name at byte offset {offset} has zero length.")
    stream.seek(offset)
    raw = stream.read(name_length)
    if len(raw) != name_length:
        raise KsanImFormatError(
            f"Target name at byte offset {offset} is truncated; expected {name_length} bytes, got {len(raw)}."
        )
    try:
        return raw.decode("ascii"), offset + name_length
    except UnicodeDecodeError as error:
        raise KsanImFormatError(
            f"Target name at byte offset {offset} is not ASCII: {error}."
        ) from error


def _read_frames(
    stream: BinaryIO,
    offset: int,
    frame_count: int,
    format_version: int,
) -> tuple[TransformFrame, ...]:
    """Read frame_count transform records from the stream."""

    if frame_count == 0:
        raise KsanImFormatError(f"Target at byte offset {offset} has zero frames.")
    float_count = _frame_float_count(format_version)
    frame_size = float_count * 4
    stream.seek(offset)
    frames: list[TransformFrame] = []
    for frame_index in range(frame_count):
        raw = stream.read(frame_size)
        if len(raw) != frame_size:
            raise KsanImFormatError(
                f"Frame {frame_index} at byte offset {offset + frame_index * frame_size} "
                f"is truncated; expected {frame_size} bytes, got {len(raw)}."
            )
        values = struct.unpack(f"<{float_count}f", raw)
        if format_version == VERSION_2:
            frames.append(
                TransformFrame(
                    quaternion=tuple(values[0:4]),
                    position=tuple(values[4:7]),
                    scale=tuple(values[7:10]),
                )
            )
        else:
            frames.append(TransformFrame(matrix=tuple(values)))
    return tuple(frames)


def _frame_float_count(format_version: int) -> int:
    """Return the number of float32 values in one frame for a known version."""

    if format_version == VERSION_1:
        return VERSION_1_FRAME_FLOAT_COUNT
    if format_version == VERSION_2:
        return VERSION_2_FRAME_FLOAT_COUNT
    raise KsanImFormatError(
        f"Unsupported KSANIM format version {format_version}; expected {VERSION_1} or {VERSION_2}."
    )


def parse_ksanim(path: Path, target_prefix: str | None = None) -> AnimationClip:
    """Parse one KSANIM file into a typed animation clip.

    Args:
        path: Existing KSANIM file to parse.
        target_prefix: Optional target-name prefix used to filter output targets.

    Returns:
        Parsed animation metadata and transform targets.

    Raises:
        FileNotFoundError: If path does not exist.
        KsanImFormatError: If the binary layout is truncated or invalid.
    """

    if not path.is_file():
        raise FileNotFoundError(f"KSANIM input does not exist or is not a file: {path}")
    file_size = path.stat().st_size
    if file_size < GLOBAL_HEADER_SIZE_BYTES:
        raise KsanImFormatError(
            f"KSANIM file is too small: {file_size} bytes; expected at least {GLOBAL_HEADER_SIZE_BYTES}."
        )

    targets: list[AnimationTarget] = []
    with path.open("rb") as stream:
        format_version = _read_uint32(stream, 0, "format version")
        frame_float_count = _frame_float_count(format_version)
        header_value = _read_uint32(stream, 4, "header value")
        name_length = _read_uint32(stream, 8, "first target name length")
        block_offset = 0
        first_target = True

        while block_offset < file_size:
            if first_target:
                name_start = GLOBAL_HEADER_SIZE_BYTES
            else:
                name_length = _read_uint32(stream, block_offset, "target name length")
                name_start = block_offset + TARGET_HEADER_SIZE_BYTES
            name, name_end = _read_name(stream, name_start, name_length)
            frame_count = _read_uint32(stream, name_end, f"frame count for {name}")
            payload_start = name_end + 4
            payload_size = frame_count * frame_float_count * 4
            payload_end = payload_start + payload_size
            if payload_end > file_size:
                raise KsanImFormatError(
                    f"Target {name!r} at byte offset {block_offset} exceeds file size: "
                    f"payload ends at {payload_end}, file has {file_size} bytes."
                )
            if target_prefix is None or name.startswith(target_prefix):
                frames = _read_frames(stream, payload_start, frame_count, format_version)
                targets.append(AnimationTarget(name=name, frames=frames))
            block_offset = payload_end
            first_target = False

    if not targets:
        filter_description = target_prefix or "all targets"
        raise KsanImFormatError(f"No targets matched the requested filter: {filter_description!r}.")
    return AnimationClip(
        format_version=format_version,
        header_value=header_value,
        frame_size_bytes=frame_float_count * 4,
        targets=tuple(targets),
    )


def _quaternion_norm(quaternion: tuple[float, float, float, float]) -> float:
    """Return the Euclidean norm of a quaternion."""

    return math.sqrt(sum(value * value for value in quaternion))


def build_report(clip: AnimationClip) -> dict[str, object]:
    """Convert a parsed clip into deterministic JSON-compatible data."""

    quaternion_errors = [
        abs(_quaternion_norm(frame.quaternion) - 1.0)
        for target in clip.targets
        for frame in target.frames
        if frame.quaternion is not None
    ]
    max_error = max(quaternion_errors, default=None)
    quaternion_validation = {
        "checked": bool(quaternion_errors),
        "max_norm_error": max_error,
        "tolerance": QUATERNION_TOLERANCE,
        "within_tolerance": max_error is not None and max_error <= QUATERNION_TOLERANCE,
    }
    return {
        "format_version": clip.format_version,
        "header_value": clip.header_value,
        "frame_size_bytes": clip.frame_size_bytes,
        "target_count": len(clip.targets),
        "frame_count_total": sum(len(target.frames) for target in clip.targets),
        "matrix_frame_count": sum(
            1
            for target in clip.targets
            for frame in target.frames
            if frame.matrix is not None
        ),
        "quaternion_validation": quaternion_validation,
        "targets": [
            {
                "name": target.name,
                "frame_count": len(target.frames),
                "frames": [asdict(frame) for frame in target.frames],
            }
            for target in clip.targets
        ],
    }


def _build_argument_parser() -> argparse.ArgumentParser:
    """Build the command-line interface parser."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Input .ksanim file.")
    parser.add_argument("output", type=Path, help="Output JSON path.")
    parser.add_argument(
        "--target-prefix",
        help="Only emit targets whose names start with this prefix.",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Write compact JSON instead of indented JSON.",
    )
    return parser


def main() -> int:
    """Parse command-line arguments, decode the clip, and write JSON."""

    arguments = _build_argument_parser().parse_args()
    clip = parse_ksanim(arguments.input, arguments.target_prefix)
    report = build_report(clip)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    indent = None if arguments.compact else 2
    arguments.output.write_text(
        json.dumps(report, indent=indent, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"Parsed {report['target_count']} targets and "
        f"{sum(target['frame_count'] for target in report['targets'])} frames into {arguments.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
