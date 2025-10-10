const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Command } = require("commander");

const program = new Command();

program
  .name("laz-converter")
  .description("Convert LAZ v1.4+ files to LAZ v1.3 and show RGB presence")
  .version("1.1.0")
  .argument("<input>", "Input LAZ file path")
  .option("-o, --output <path>", "Output file path (default: <input>_v13.laz)")
  .option("-f, --force", "Overwrite output file if exists")
  .option(
    "--check-only",
    "Only check version and RGB presence without converting"
  )
  .action(async (input, options) => {
    try {
      await convertLAZ(input, options);
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();

/**
 * LAZファイルのバージョンを読み取る
 */
function readLAZVersion(filepath) {
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
    throw new Error(`Failed to read LAZ file: ${error.message}`);
  }
}

/**
 * LAZファイルにRGB情報が含まれているか確認
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
    console.log("   Tip: Try running manually ->  pdal info --schema <file.laz>\n");
    return false;
  }

  const hasR = dimNames.includes("Red");
  const hasG = dimNames.includes("Green");
  const hasB = dimNames.includes("Blue");

  console.log("\n🎨 RGB Presence Check:");
  console.log(`   dimNames:   ${dimNames}`);
  console.log(`   Red:   ${hasR ? "✅ Present" : "❌ None"}`);
  console.log(`   Green: ${hasG ? "✅ Present" : "❌ None"}`);
  console.log(`   Blue:  ${hasB ? "✅ Present" : "❌ None"}`);

  const hasRGB = hasR && hasG && hasB;
  console.log(hasRGB
    ? "👉  This LAZ file includes RGB color data.\n"
    : "👉  This LAZ file does NOT include RGB color data.\n");

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
 * LAZ変換のメイン処理
 */
async function convertLAZ(inputPath, options) {
  console.log("🔍 Checking LAZ file...\n");

  // 入力ファイル確認
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // バージョン確認
  const version = readLAZVersion(inputPath);
  const versionStr = `${version.major}.${version.minor}`;
  const versionFloat = parseFloat(versionStr);

  console.log(`📄 File: ${path.basename(inputPath)}`);
  console.log(`📊 Version: LAZ ${versionStr}`);

  // ✅ RGB情報確認
  await checkRGBPresence(inputPath);

  // 出力パス決定
  const outputPath = options.output || inputPath.replace(/\.laz$/i, "_v13.laz");

  // バージョンが1.3以下なら変換不要
  if (versionFloat <= 1.3) {
    console.log(`\n✅ File is already LAZ v${versionStr}`);
    console.log("   No conversion needed.");
    return;
  }

  console.log(`\n⚠️  LAZ v${versionStr} detected. Conversion required.\n`);

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

  console.log("🔄 Converting to LAZ v1.3...");
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}\n`);

  if (converter.tool === "pdal") {
    await runPDAL(inputPath, outputPath);
  } else {
    await runLaszip(inputPath, outputPath);
  }

  const convertedVersion = readLAZVersion(outputPath);
  const convertedVersionStr = `${convertedVersion.major}.${convertedVersion.minor}`;

  console.log(`\n✅ Conversion complete!`);
  console.log(`   Output version: LAZ ${convertedVersionStr}`);
  console.log(`   Output file: ${outputPath}`);
}

/**
 * PDALによる変換
 */
function runPDAL(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const pipeline = {
      pipeline: [
        { type: "readers.las", filename: inputPath },
        {
          type: "writers.las",
          filename: outputPath,
          minor_version: 3,
          dataformat_id: 2,
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
 * laszipによる変換
 */
function runLaszip(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ["-set_version", "1.3", "-i", inputPath, "-o", outputPath];
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
