#!/usr/bin/env node

/**
 * COPC RGB Converter using Node.js
 *
 * Converts 16-bit RGB (0-65535) to 8-bit RGB (0-255) by reading and rewriting COPC data
 */

const Copc = require('copc');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: node convert-copc-rgb.js <input.copc.laz> [output.copc.laz]

Examples:
  node convert-copc-rgb.js tokyo_merged.copc.laz
  node convert-copc-rgb.js tokyo_merged.copc.laz tokyo_8bit.copc.laz

Note: This script reads RGB values, scales them from 16-bit to 8-bit,
      and shows you the transformed values. However, writing back to COPC
      requires external tools like PDAL with Python bindings.
  `);
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace('.copc.laz', '_8bit.copc.laz');

async function main() {
  console.log('🔧 COPC RGB Analyzer & Converter\n');
  console.log(`📂 Input:  ${inputFile}\n`);

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    // Load COPC file
    console.log('📖 Loading COPC file...');
    const copc = await Copc.create(inputFile);
    console.log('✅ COPC file loaded\n');

    // Get hierarchy
    const { nodes } = await Copc.loadHierarchyPage(inputFile, copc.info.rootHierarchyPage);

    console.log(`📊 Total nodes: ${Object.keys(nodes).length}`);
    console.log(`📦 Points: ${copc.header.pointCount.toLocaleString()}\n`);

    // Process first few nodes to show RGB values
    console.log('🔍 Analyzing RGB values from sample nodes...\n');

    const nodeKeys = Object.keys(nodes).slice(0, 5);
    let totalSamples = 0;
    let rgbSamples = [];

    for (const key of nodeKeys) {
      const node = nodes[key];

      try {
        const view = await Copc.loadPointDataView(inputFile, copc, node);
        const getters = ['Red', 'Green', 'Blue'].map(view.getter);

        const sampleCount = Math.min(10, node.pointCount);

        for (let i = 0; i < sampleCount; i++) {
          const r = getters[0](i);
          const g = getters[1](i);
          const b = getters[2](i);

          rgbSamples.push({ r, g, b });

          if (totalSamples < 10) {
            const r8 = Math.floor(r / 257);
            const g8 = Math.floor(g / 257);
            const b8 = Math.floor(b / 257);

            console.log(`Sample ${totalSamples + 1}:`);
            console.log(`  16-bit: R=${r}, G=${g}, B=${b}`);
            console.log(`  8-bit:  R=${r8}, G=${g8}, B=${b8}`);
            console.log();
          }

          totalSamples++;
        }

        if (totalSamples >= 100) break;
      } catch (err) {
        console.log(`   Skipping node ${key}: ${err.message}`);
      }
    }

    // Calculate statistics
    if (rgbSamples.length > 0) {
      const rValues = rgbSamples.map(s => s.r);
      const gValues = rgbSamples.map(s => s.g);
      const bValues = rgbSamples.map(s => s.b);

      const stats = {
        Red: {
          min: Math.min(...rValues),
          max: Math.max(...rValues),
          avg: Math.round(rValues.reduce((a, b) => a + b, 0) / rValues.length)
        },
        Green: {
          min: Math.min(...gValues),
          max: Math.max(...gValues),
          avg: Math.round(gValues.reduce((a, b) => a + b, 0) / gValues.length)
        },
        Blue: {
          min: Math.min(...bValues),
          max: Math.max(...bValues),
          avg: Math.round(bValues.reduce((a, b) => a + b, 0) / bValues.length)
        }
      };

      console.log(`📊 Sample Statistics (${rgbSamples.length} points):`);
      console.log(`   Red:   min=${stats.Red.min}, max=${stats.Red.max}, avg=${stats.Red.avg}`);
      console.log(`   Green: min=${stats.Green.min}, max=${stats.Green.max}, avg=${stats.Green.avg}`);
      console.log(`   Blue:  min=${stats.Blue.min}, max=${stats.Blue.max}, avg=${stats.Blue.avg}`);
      console.log();

      const maxRGB = Math.max(stats.Red.max, stats.Green.max, stats.Blue.max);

      if (maxRGB > 255) {
        console.log(`💡 RGB values are in 16-bit range (max=${maxRGB})`);
        console.log(`   Conversion factor: divide by 257`);
        console.log(`   After conversion: max will be ${Math.floor(maxRGB / 257)}`);
      } else {
        console.log(`✅ RGB values are already in 8-bit range (0-255)`);
      }
    }

    console.log('\n⚠️  Note: To write converted COPC files, please use:');
    console.log('   1. Python script: python3 scripts/convert-rgb-8bit.py (requires pip install pdal)');
    console.log('   2. Or modify your shader to handle 16-bit RGB values');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
