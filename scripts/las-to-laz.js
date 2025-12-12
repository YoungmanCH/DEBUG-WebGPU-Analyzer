#!/usr/bin/env node

/**
 * LAS to LAZ Converter Script (Node.js version)
 * Usage: node scripts/las-to-laz.js <input.las> [output.laz]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Error: Input LAS file is required');
  console.error('Usage: node scripts/las-to-laz.js <input.las> [output.laz]');
  process.exit(1);
}

const inputFile = args[0];

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file '${inputFile}' does not exist`);
  process.exit(1);
}

// Check if input file has .las extension
if (!inputFile.endsWith('.las')) {
  console.error('Error: Input file must have .las extension');
  process.exit(1);
}

// Determine output file name
const outputFile = args[1] || inputFile.replace(/\.las$/, '.laz');

// Check if pdal is installed
try {
  execSync('which pdal', { stdio: 'pipe' });
} catch (error) {
  console.error('Error: pdal is not installed');
  console.error('Install it using: brew install pdal (macOS) or apt install pdal (Linux)');
  process.exit(1);
}

console.log('Converting LAS to LAZ...');
console.log(`Input:  ${inputFile}`);
console.log(`Output: ${outputFile}`);

try {
  // Get the original LAS version and format
  const metadataOutput = execSync(`pdal info "${inputFile}" --metadata`, { encoding: 'utf8' });
  const metadata = JSON.parse(metadataOutput);
  const minorVersion = metadata.metadata.minor_version;
  const dataformatId = metadata.metadata.dataformat_id;

  if (minorVersion === undefined || dataformatId === undefined) {
    console.error('Error: Could not determine LAS version or point format');
    process.exit(1);
  }

  console.log(`Original LAS version: 1.${minorVersion}`);
  console.log(`Point format: ${dataformatId}`);

  // Convert LAS to LAZ using pdal with version and format preservation
  execSync(`pdal translate "${inputFile}" "${outputFile}" --writers.las.compression=true --writers.las.minor_version=${minorVersion} --writers.las.dataformat_id=${dataformatId}`, {
    stdio: 'inherit'
  });

  console.log('✓ Conversion completed successfully!');

  // Show file sizes
  const inputStats = fs.statSync(inputFile);
  const outputStats = fs.statSync(outputFile);

  const formatSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;
  };

  console.log('');
  console.log('File sizes:');
  console.log(`  Original (LAS): ${formatSize(inputStats.size)}`);
  console.log(`  Compressed (LAZ): ${formatSize(outputStats.size)}`);
  console.log(`  Compression ratio: ${((1 - outputStats.size / inputStats.size) * 100).toFixed(1)}%`);

} catch (error) {
  console.error('✗ Conversion failed');
  process.exit(1);
}
