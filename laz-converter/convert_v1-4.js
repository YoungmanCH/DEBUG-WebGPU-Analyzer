const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Command } = require("commander");

const program = new Command();

program
  .name("las-to-laz-v14-converter")
  .description("Convert LAS files to LAZ (compressed) while keeping v1.4 format")
  .version("1.0.0")
  .argument("<input>", "Input LAS file path")
  .option("-o, --output <path>", "Output file path (default: <input>.laz)")
  .option("-f, --force", "Overwrite output file if exists")
  .option(
    "--check-only",
    "Only check version and RGB presence without converting"
  )
  .action(async (input, options) => {
    try {
      await convertToLAZ(input, options);
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();

/**
 * LAS/LAZファイルのバージョンを読み取る
 */
function readLASVersion(filepath) {
  try {
    const buffer = Buffer.alloc(26);
    const fd = fs.openSync(filepath, "r");
    fs.readSync(fd, buffer, 0, 26, 0);
    fs.closeSync(fd);

    // LASヘッダー: オフセット24-25にバージョン情報
    const versionMajor = buffer.readUInt8(24);
    const versionMinor = buffer.readUInt8(25);

    return { major: versionMajor, minor: versionMinor };
  } catch (error) {
    throw new Error(`Failed to read LAS file: ${error.message}`);
  }
}

/**
 * ファイルが圧縮されているか確認（LAZかどうか）
 */
function isCompressed(filepath) {
  try {
    const buffer = Buffer.alloc(228);
    const fd = fs.openSync(filepath, "r");
    fs.readSync(fd, buffer, 0, 228, 0);
    fs.closeSync(fd);

    // オフセット227: Point Data Format ID
    // 最上位ビット(0x80)が立っていれば圧縮されている
    const pointDataFormat = buffer.readUInt8(104);

    return (pointDataFormat & 0x80) !== 0;
  } catch (error) {
    throw new Error(`Failed to check compression: ${error.message}`);
  }
}

/**
 * LAS/LAZファイルにRGB情報が含まれているか確認
 */
async function checkRGBPresence(inputPath) {
  // ヘルパ: pdal info を実行して JSON を返す（失敗時 null）
  const runPdalInfo = (extraArgs = []) =>
    new Promise((resolve) => {
      const args = ["info", ...extraArgs, inputPath];
      const proc = spawn("pdal", args);
      let out = "";
      let err = "";
      proc.stdout.on("data", (d) => (out += d.toString()));
      proc.stderr.on("data", (d) => (err += d.toString()));
      proc.on("close", (code) => {
        if (code !== 0) return resolve(null);
        try {
          const json = JSON.parse(out);
          resolve(json);
        } catch {
          resolve(null);
        }
      });
      proc.on("error", () => resolve(null));
    });

  // ヘルパ: いろんな形の出力から次元名配列を抽出
  const extractDimensionNames = (json) => {
    if (!json || typeof json !== "object") return [];
    // 1) 一般的: schema.dimensions[]
    if (Array.isArray(json?.schema?.dimensions)) {
      return json.schema.dimensions.map((d) => d?.name).filter(Boolean);
    }
    // 2) stages[].schema.dimensions[]（--all系で出ることがある）
    if (Array.isArray(json?.stages)) {
      const names = new Set();
      for (const st of json.stages) {
        if (Array.isArray(st?.schema?.dimensions)) {
          for (const d of st.schema.dimensions) {
            if (d?.name) names.add(d.name);
          }
        }
      }
      if (names.size) return [...names];
    }
    // 3) metadata.readers.las.dimensions[]
    if (Array.isArray(json?.metadata?.readers?.las?.dimensions)) {
      return json.metadata.readers.las.dimensions.map((d) => d?.name).filter(Boolean);
    }
    // 4) metadata.dimensions[] or top-level dimensions[]
    if (Array.isArray(json?.metadata?.dimensions)) {
      return json.metadata.dimensions.map((d) => d?.name).filter(Boolean);
    }
    if (Array.isArray(json?.dimensions)) {
      return json.dimensions.map((d) => d?.name).filter(Boolean);
    }
    return [];
  };

  // 順に試す
  const tries = [
    ["--schema"],
    [],                // 無指定
    ["--metadata"],
  ];

  let dimNames = [];
  for (const t of tries) {
    const json = await runPdalInfo(t);
    dimNames = extractDimensionNames(json);
    if (dimNames.length) break;
  }

  if (!dimNames.length) {
    console.log("⚠️  Could not obtain dimensions from PDAL (schema/metadata unavailable).");
    console.log("   Tip: Try running manually ->  pdal info --schema <file>\n");
    return false;
  }

  const hasR = dimNames.includes("Red");
  const hasG = dimNames.includes("Green");
  const hasB = dimNames.includes("Blue");

  console.log("\n🎨 RGB Presence Check:");
  console.log(`   Red:   ${hasR ? "✅ Present" : "❌ None"}`);
  console.log(`   Green: ${hasG ? "✅ Present" : "❌ None"}`);
  console.log(`   Blue:  ${hasB ? "✅ Present" : "❌ None"}`);

  const hasRGB = hasR && hasG && hasB;
  console.log(hasRGB
    ? "👉  This file includes RGB color data.\n"
    : "👉  This file does NOT include RGB color data.\n");

  console.log("📋 All available dimensions:");
  console.log(dimNames.join(", "));
  console.log();

  return hasRGB;
}

/**
 * 変換ツールが利用可能かチェック（PDAL優先、次にlaszip）
 */
async function checkConverter() {
  const hasPDAL = await new Promise((resolve) => {
    const process = spawn("pdal", ["--version"]);
    process.on("error", () => resolve(false));
    process.on("close", (code) => resolve(code === 0));
  });

  if (hasPDAL) return { tool: "pdal", available: true };

  const hasLaszip = await new Promise((resolve) => {
    const process = spawn("laszip", ["-version"]);
    process.on("error", () => resolve(false));
    process.on("close", (code) => resolve(code === 0));
  });

  if (hasLaszip) return { tool: "laszip", available: true };
  return { tool: null, available: false };
}

/**
 * LAS to LAZ変換のメイン処理（v1.4を維持）
 */
async function convertToLAZ(inputPath, options) {
  console.log("🔍 Checking LAS file...\n");

  // 入力ファイル確認
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // バージョン確認
  const version = readLASVersion(inputPath);
  const versionStr = `${version.major}.${version.minor}`;

  // 圧縮チェック
  const compressed = isCompressed(inputPath);
  const fileType = compressed ? "LAZ" : "LAS";

  console.log(`📄 File: ${path.basename(inputPath)}`);
  console.log(`📊 Format: ${fileType} v${versionStr}`);
  console.log(`🗜️  Compressed: ${compressed ? "Yes" : "No"}`);

  // ✅ RGB情報確認
  if (!options.checkOnly) {
    await checkRGBPresence(inputPath);
  }

  // チェックのみの場合はここで終了
  if (options.checkOnly) {
    console.log("✅ Check complete (no conversion performed).");
    return;
  }

  // 既に圧縮されている場合
  if (compressed) {
    console.log(`\n✅ File is already compressed (LAZ)`);
    console.log("   No conversion needed.");
    return;
  }

  // 出力パス決定
  const outputPath = options.output || inputPath.replace(/\.las$/i, ".laz");

  console.log(`\n🔄 Converting LAS to LAZ (keeping v${versionStr})...\n`);

  // 変換ツールチェック
  const converter = await checkConverter();
  if (!converter.available) {
    throw new Error(
      "Conversion tool not found.\n" + "Install PDAL (recommended) or laszip.\n"
    );
  }

  console.log(`Using ${converter.tool} for conversion\n`);

  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(
      `Output file already exists: ${outputPath}\n` +
        "Use --force to overwrite."
    );
  }

  console.log("🔄 Compressing to LAZ...");
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}\n`);

  if (converter.tool === "pdal") {
    await runPDAL(inputPath, outputPath, version.minor);
  } else {
    await runLaszip(inputPath, outputPath);
  }

  const convertedVersion = readLASVersion(outputPath);
  const convertedVersionStr = `${convertedVersion.major}.${convertedVersion.minor}`;
  const convertedCompressed = isCompressed(outputPath);

  console.log(`\n✅ Conversion complete!`);
  console.log(`   Output format: ${convertedCompressed ? "LAZ" : "LAS"} v${convertedVersionStr}`);
  console.log(`   Output file: ${outputPath}`);

  // ファイルサイズ比較
  const inputSize = fs.statSync(inputPath).size;
  const outputSize = fs.statSync(outputPath).size;
  const ratio = ((outputSize / inputSize) * 100).toFixed(1);

  console.log(`\n📊 Compression stats:`);
  console.log(`   Original: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Compressed: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Ratio: ${ratio}% (saved ${(100 - parseFloat(ratio)).toFixed(1)}%)`);
}

/**
 * PDALによる圧縮（バージョン維持）
 */
function runPDAL(inputPath, outputPath, minorVersion) {
  return new Promise((resolve, reject) => {
    const pipeline = {
      pipeline: [
        { type: "readers.las", filename: inputPath },
        {
          type: "writers.las",
          filename: outputPath,
          minor_version: minorVersion, // 元のバージョンを維持
          compression: "laszip",
        },
      ],
    };

    const args = ["pipeline", "--stdin"];
    const process = spawn("pdal", args);
    let stderr = "";

    process.stdin.write(JSON.stringify(pipeline));
    process.stdin.end();

    process.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stdout.write(data);
    });

    process.stdout.on("data", (data) => {
      process.stdout.write(data);
    });

    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pdal exited with code ${code}\n${stderr}`));
    });
  });
}

/**
 * laszipによる圧縮
 */
function runLaszip(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ["-i", inputPath, "-o", outputPath];
    console.log(`   Running: laszip ${args.join(" ")}\n`);

    const process = spawn("laszip", args);
    let stderr = "";

    process.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stdout.write(data);
    });

    process.stdout.on("data", (data) => {
      process.stdout.write(data);
    });

    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`laszip exited with code ${code}\n${stderr}`));
    });
  });
}
