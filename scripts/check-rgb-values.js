#!/usr/bin/env node

/**
 * COPC RGB Value Inspector
 *
 * Displays actual RGB values from COPC/LAZ files to debug color issues
 */

const { spawn } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: node check-rgb-values.js <input.copc.laz> [sample_count]

Examples:
  node check-rgb-values.js tokyo_merged.copc.laz
  node check-rgb-values.js tokyo_merged.copc.laz 20
  `);
  process.exit(1);
}

const inputFile = args[0];
const sampleCount = parseInt(args[1]) || 10;

async function main() {
  console.log('🔍 COPC RGB Value Inspector\n');
  console.log(`📂 File: ${inputFile}`);
  console.log(`📊 Sample count: ${sampleCount}\n`);

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  // Get schema info
  console.log('📋 Checking schema...\n');
  await getSchema(inputFile);

  console.log('\n');

  // Get sample points
  console.log('📌 Sample RGB values:\n');
  await getSamplePoints(inputFile, sampleCount);
}

/**
 * Get schema information
 */
async function getSchema(filename) {
  return new Promise((resolve) => {
    const proc = spawn('pdal', ['info', '--schema', filename]);
    let stdout = '';

    proc.stdout.on('data', (data) => stdout += data.toString());

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Error getting schema');
        resolve();
        return;
      }

      try {
        const json = JSON.parse(stdout);
        const dimensions = json.schema?.dimensions || [];

        const redDim = dimensions.find(d => d.name === 'Red');
        const greenDim = dimensions.find(d => d.name === 'Green');
        const blueDim = dimensions.find(d => d.name === 'Blue');

        if (redDim) {
          console.log(`Red:   type=${redDim.type}, size=${redDim.size} bytes`);
        }
        if (greenDim) {
          console.log(`Green: type=${greenDim.type}, size=${greenDim.size} bytes`);
        }
        if (blueDim) {
          console.log(`Blue:  type=${blueDim.type}, size=${blueDim.size} bytes`);
        }
      } catch (e) {
        console.error('Error parsing schema:', e.message);
      }
      resolve();
    });
  });
}

/**
 * Get sample point data
 */
async function getSamplePoints(filename, count) {
  // Create a temporary pipeline to dump point data
  const pipeline = {
    "pipeline": [
      {
        "type": "readers.copc",
        "filename": filename,
        "count": count
      },
      {
        "type": "writers.text",
        "filename": "STDOUT",
        "order": "X,Y,Z,Red,Green,Blue",
        "keep_unspecified": false,
        "precision": 0
      }
    ]
  };

  const pipelineFile = '/tmp/check_rgb_pipeline.json';
  fs.writeFileSync(pipelineFile, JSON.stringify(pipeline, null, 2));

  return new Promise((resolve) => {
    const proc = spawn('pdal', ['pipeline', pipelineFile]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());

    proc.on('close', (code) => {
      fs.unlinkSync(pipelineFile);

      if (code !== 0) {
        console.error('❌ Error reading points:', stderr);
        resolve();
        return;
      }

      // Parse output
      const lines = stdout.trim().split('\n').filter(line => line.trim());

      console.log('Index | X         | Y         | Z      | Red   | Green | Blue');
      console.log('------|-----------|-----------|--------|-------|-------|------');

      lines.forEach((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 6) {
          const x = parseFloat(parts[0]).toFixed(1);
          const y = parseFloat(parts[1]).toFixed(1);
          const z = parseFloat(parts[2]).toFixed(1);
          const r = parts[3];
          const g = parts[4];
          const b = parts[5];

          console.log(`${String(idx + 1).padStart(5)} | ${x.padStart(9)} | ${y.padStart(9)} | ${z.padStart(6)} | ${r.padStart(5)} | ${g.padStart(5)} | ${b.padStart(5)}`);
        }
      });

      // Calculate statistics
      const rgbValues = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          r: parseInt(parts[3]),
          g: parseInt(parts[4]),
          b: parseInt(parts[5])
        };
      }).filter(v => !isNaN(v.r) && !isNaN(v.g) && !isNaN(v.b));

      if (rgbValues.length > 0) {
        const avgR = rgbValues.reduce((sum, v) => sum + v.r, 0) / rgbValues.length;
        const avgG = rgbValues.reduce((sum, v) => sum + v.g, 0) / rgbValues.length;
        const avgB = rgbValues.reduce((sum, v) => sum + v.b, 0) / rgbValues.length;

        const minR = Math.min(...rgbValues.map(v => v.r));
        const maxR = Math.max(...rgbValues.map(v => v.r));
        const minG = Math.min(...rgbValues.map(v => v.g));
        const maxG = Math.max(...rgbValues.map(v => v.g));
        const minB = Math.min(...rgbValues.map(v => v.b));
        const maxB = Math.max(...rgbValues.map(v => v.b));

        console.log('\n📊 Sample Statistics:');
        console.log(`Red:   min=${minR}, max=${maxR}, avg=${Math.round(avgR)}`);
        console.log(`Green: min=${minG}, max=${maxG}, avg=${Math.round(avgG)}`);
        console.log(`Blue:  min=${minB}, max=${maxB}, avg=${Math.round(avgB)}`);

        // Suggest scaling factor
        const maxValue = Math.max(maxR, maxG, maxB);
        if (maxValue > 255) {
          console.log(`\n💡 Suggestion: Values exceed 255 (max=${maxValue})`);
          console.log(`   Scaling factor: divide by ${Math.round(maxValue / 255)}`);
        } else {
          console.log(`\n✅ RGB values are in 8-bit range (0-255)`);
        }
      }

      resolve();
    });
  });
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
