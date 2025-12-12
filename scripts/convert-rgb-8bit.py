#!/usr/bin/env python3

"""
COPC RGB Bit Depth Converter (Python version)

Converts 16-bit RGB values (0-65535) to 8-bit RGB values (0-255)
in COPC/LAZ files using PDAL Python bindings.

Usage:
    python3 convert-rgb-8bit.py <input.copc.laz> [output.copc.laz]
"""

import sys
import os
import json

try:
    import pdal
except ImportError:
    print("❌ Error: python-pdal is not installed")
    print("   Install with: pip install pdal")
    print("   or: conda install -c conda-forge python-pdal")
    sys.exit(1)

import numpy as np


def get_rgb_stats(filename):
    """Get RGB statistics from file"""
    pipeline = pdal.Pipeline(json.dumps({
        "pipeline": [
            {
                "type": "readers.copc",
                "filename": filename
            }
        ]
    }))

    try:
        pipeline.execute()
        arrays = pipeline.arrays
        if len(arrays) == 0:
            return None

        points = arrays[0]

        if 'Red' not in points.dtype.names:
            print("❌ Error: No RGB data in file")
            return None

        stats = {
            'Red': {
                'min': int(points['Red'].min()),
                'max': int(points['Red'].max()),
                'avg': int(points['Red'].mean())
            },
            'Green': {
                'min': int(points['Green'].min()),
                'max': int(points['Green'].max()),
                'avg': int(points['Green'].mean())
            },
            'Blue': {
                'min': int(points['Blue'].min()),
                'max': int(points['Blue'].max()),
                'avg': int(points['Blue'].mean())
            }
        }

        return stats
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        return None


def display_stats(stats):
    """Display RGB statistics"""
    print("📊 RGB Statistics:")
    print(f"   Red:   min={stats['Red']['min']}, max={stats['Red']['max']}, avg={stats['Red']['avg']}")
    print(f"   Green: min={stats['Green']['min']}, max={stats['Green']['max']}, avg={stats['Green']['avg']}")
    print(f"   Blue:  min={stats['Blue']['min']}, max={stats['Blue']['max']}, avg={stats['Blue']['avg']}")
    print()


def convert_rgb(input_file, output_file):
    """Convert 16-bit RGB to 8-bit RGB"""

    # Read input file
    print("   Reading input file...")
    pipeline_read = pdal.Pipeline(json.dumps({
        "pipeline": [
            {
                "type": "readers.copc",
                "filename": input_file
            }
        ]
    }))

    pipeline_read.execute()
    arrays = pipeline_read.arrays
    points = arrays[0]

    # Convert RGB values: 16-bit (0-65535) -> 8-bit (0-255)
    # Division by 257 (65535 / 255 = 257)
    print("   Converting RGB values (16-bit -> 8-bit)...")
    points['Red'] = (points['Red'] / 257.0).astype(np.uint16)
    points['Green'] = (points['Green'] / 257.0).astype(np.uint16)
    points['Blue'] = (points['Blue'] / 257.0).astype(np.uint16)

    # Write output file
    print("   Writing output file...")
    pipeline_write = pdal.Pipeline(json.dumps({
        "pipeline": [
            {
                "type": "writers.copc",
                "filename": output_file,
                "forward": "all"
            }
        ]
    }), arrays=[points])

    pipeline_write.execute()


def main():
    if len(sys.argv) < 2:
        print("""
Usage: python3 convert-rgb-8bit.py <input.copc.laz> [output.copc.laz]

Examples:
  python3 convert-rgb-8bit.py tokyo_merged.copc.laz
  python3 convert-rgb-8bit.py tokyo_merged.copc.laz tokyo_merged_8bit.copc.laz

This script converts 16-bit RGB (0-65535) to 8-bit RGB (0-255).
        """)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.copc.laz', '_8bit.copc.laz')

    print("🔧 COPC RGB Bit Depth Converter (Python)\n")

    # Validate input
    if not os.path.exists(input_file):
        print(f"❌ Error: Input file not found: {input_file}")
        sys.exit(1)

    print(f"📂 Input:  {input_file}")
    print(f"📂 Output: {output_file}\n")

    # Get RGB statistics
    print("🔍 Analyzing RGB bit depth...\n")
    stats = get_rgb_stats(input_file)

    if not stats:
        sys.exit(1)

    display_stats(stats)

    # Check if conversion is needed
    max_value = max(stats['Red']['max'], stats['Green']['max'], stats['Blue']['max'])

    if max_value <= 255:
        print("ℹ️  RGB values are already in 8-bit range (0-255).")
        print("   No conversion needed.\n")
        sys.exit(0)

    # Perform conversion
    print("🔄 Converting 16-bit RGB to 8-bit RGB...\n")

    try:
        convert_rgb(input_file, output_file)
        print("\n✅ Conversion completed successfully!")
        print(f"📦 Output file: {output_file}\n")

        # Verify output
        print("🔍 Verifying output...\n")
        output_stats = get_rgb_stats(output_file)
        if output_stats:
            display_stats(output_stats)

    except Exception as e:
        print(f"\n❌ Error during conversion: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
