#!/bin/bash

# LAS to LAZ Converter Script
# Usage: ./scripts/las-to-laz.sh <input.las> [output.laz]

# Check if input file is provided
if [ -z "$1" ]; then
  echo "Error: Input LAS file is required"
  echo "Usage: $0 <input.las> [output.laz]"
  exit 1
fi

INPUT_FILE="$1"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Input file '$INPUT_FILE' does not exist"
  exit 1
fi

# Check if input file has .las extension
if [[ ! "$INPUT_FILE" =~ \.las$ ]]; then
  echo "Error: Input file must have .las extension"
  exit 1
fi

# Determine output file name
if [ -z "$2" ]; then
  # Replace .las extension with .laz
  OUTPUT_FILE="${INPUT_FILE%.las}.laz"
else
  OUTPUT_FILE="$2"
fi

# Check if pdal is installed
if ! command -v pdal &> /dev/null; then
  echo "Error: pdal is not installed"
  echo "Install it using: brew install pdal (macOS) or apt install pdal (Linux)"
  exit 1
fi

echo "Converting LAS to LAZ..."
echo "Input:  $INPUT_FILE"
echo "Output: $OUTPUT_FILE"

# Get the original LAS version and point format
ORIGINAL_VERSION=$(pdal info "$INPUT_FILE" --metadata | grep '"minor_version"' | head -1 | grep -oE '[0-9]+')
POINT_FORMAT=$(pdal info "$INPUT_FILE" --metadata | grep '"dataformat_id"' | head -1 | grep -oE '[0-9]+')

if [ -z "$ORIGINAL_VERSION" ] || [ -z "$POINT_FORMAT" ]; then
  echo "Error: Could not determine LAS version or point format"
  exit 1
fi

echo "Original LAS version: 1.$ORIGINAL_VERSION"
echo "Point format: $POINT_FORMAT"

# Convert LAS to LAZ using pdal with version and format preservation
pdal translate "$INPUT_FILE" "$OUTPUT_FILE" \
  --writers.las.compression=true \
  --writers.las.minor_version="$ORIGINAL_VERSION" \
  --writers.las.dataformat_id="$POINT_FORMAT"

# Check if conversion was successful
if [ $? -eq 0 ]; then
  echo "✓ Conversion completed successfully!"

  # Show file sizes
  INPUT_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
  OUTPUT_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo ""
  echo "File sizes:"
  echo "  Original (LAS): $INPUT_SIZE"
  echo "  Compressed (LAZ): $OUTPUT_SIZE"
else
  echo "✗ Conversion failed"
  exit 1
fi
