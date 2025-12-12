#!/usr/bin/env node

/**
 * COPC RGB Bit Depth Converter
 *
 * Converts 16-bit RGB values (0-65535) to 8-bit RGB values (0-255)
 * in COPC/LAZ files while preserving COPC structure.
 *
 * Usage:
 *   node convert-rgb-8bit.js <input.copc.laz> [output.copc.laz]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: node convert-rgb-8bit.js <input.copc.laz> [output.copc.laz]

Examples:
  node convert-rgb-8bit.js tokyo_merged.copc.laz
  node convert-rgb-8bit.js tokyo_merged.copc.laz tokyo_merged_8bit.copc.laz

This script converts 16-bit RGB (0-65535) to 8-bit RGB (0-255).
  `);
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace('.copc.laz', '_8bit.copc.laz').replace('.laz', '_8bit.laz');

// ============================================================================
// Main Process
// ============================================================================

async function main() {
  console.log('🔧 COPC RGB Bit Depth Converter\n');

  // Validate input file
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: Input file not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`📂 Input:  ${inputFile}`);
  console.log(`📂 Output: ${outputFile}\n`);

  // Check if PDAL is available
  const hasPDAL = await checkPDAL();
  if (!hasPDAL) {
    console.error('❌ Error: PDAL is not installed or not in PATH');
    console.error('   Install PDAL: https://pdal.io/en/latest/download.html');
    process.exit(1);
  }

  // Get RGB statistics
  console.log('🔍 Analyzing RGB bit depth...\n');
  const stats = await getRGBStats(inputFile);

  if (!stats) {
    console.error('❌ Error: Could not retrieve RGB statistics');
    process.exit(1);
  }

  displayStats(stats);

  // Determine if conversion is needed
  const needs16to8 = stats.Red.maximum > 255 || stats.Green.maximum > 255 || stats.Blue.maximum > 255;

  if (!needs16to8) {
    console.log('ℹ️  RGB values are already in 8-bit range (0-255).');
    console.log('   No conversion needed.\n');
    process.exit(0);
  }

  // Perform conversion
  console.log('🔄 Converting 16-bit RGB to 8-bit RGB...\n');
  await convertRGB(inputFile, outputFile);

  // Verify output
  console.log('\n✅ Conversion completed successfully!');
  console.log(`📦 Output file: ${outputFile}\n`);

  // Show output stats
  console.log('🔍 Verifying output...\n');
  const outputStats = await getRGBStats(outputFile);
  if (outputStats) {
    displayStats(outputStats);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if PDAL is installed
 */
async function checkPDAL() {
  return new Promise((resolve) => {
    const process = spawn('pdal', ['--version']);
    process.on('error', () => resolve(false));
    process.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Get RGB statistics using PDAL
 */
async function getRGBStats(filename) {
  return new Promise((resolve) => {
    const proc = spawn('pdal', ['info', '--stats', filename]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('Error running pdal info:', stderr);
        resolve(null);
        return;
      }

      try {
        const json = JSON.parse(stdout);
        const stats = json.stats?.statistic || [];

        const redStat = stats.find(s => s.name === 'Red');
        const greenStat = stats.find(s => s.name === 'Green');
        const blueStat = stats.find(s => s.name === 'Blue');

        if (!redStat || !greenStat || !blueStat) {
          console.error('❌ RGB dimensions not found in file');
          resolve(null);
          return;
        }

        resolve({
          Red: { minimum: redStat.minimum, maximum: redStat.maximum, average: redStat.average },
          Green: { minimum: greenStat.minimum, maximum: greenStat.maximum, average: greenStat.average },
          Blue: { minimum: blueStat.minimum, maximum: blueStat.maximum, average: blueStat.average }
        });
      } catch (e) {
        console.error('Error parsing PDAL output:', e.message);
        resolve(null);
      }
    });
  });
}

/**
 * Display RGB statistics
 */
function displayStats(stats) {
  console.log('📊 RGB Statistics:');
  console.log(`   Red:   min=${Math.round(stats.Red.minimum)}, max=${Math.round(stats.Red.maximum)}, avg=${Math.round(stats.Red.average)}`);
  console.log(`   Green: min=${Math.round(stats.Green.minimum)}, max=${Math.round(stats.Green.maximum)}, avg=${Math.round(stats.Green.average)}`);
  console.log(`   Blue:  min=${Math.round(stats.Blue.minimum)}, max=${Math.round(stats.Blue.maximum)}, avg=${Math.round(stats.Blue.average)}`);
  console.log();
}

/**
 * Convert RGB using PDAL pipeline with scale option
 */
async function convertRGB(input, output) {
  const pipeline = {
    "pipeline": [
      {
        "type": "readers.copc",
        "filename": input
      },
      {
        "type": "writers.copc",
        "filename": output,
        "forward": "all",
        "scale_red": 0.00389105058,
        "scale_green": 0.00389105058,
        "scale_blue": 0.00389105058,
        "offset_red": 0,
        "offset_green": 0,
        "offset_blue": 0
      }
    ]
  };

  const pipelineFile = output.replace('.laz', '_pipeline.json').replace('.copc', '');
  fs.writeFileSync(pipelineFile, JSON.stringify(pipeline, null, 2));

  return new Promise((resolve, reject) => {
    console.log(`   Running PDAL pipeline...`);
    const proc = spawn('pdal', ['pipeline', pipelineFile]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(`   ${data.toString()}`);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(`   ${data.toString()}`);
    });

    proc.on('close', (code) => {
      // Clean up pipeline file
      if (fs.existsSync(pipelineFile)) {
        fs.unlinkSync(pipelineFile);
      }

      if (code !== 0) {
        console.error('\n   Pipeline stderr:', stderr);
        reject(new Error(`PDAL pipeline failed with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

// ============================================================================
// Execute
// ============================================================================

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
