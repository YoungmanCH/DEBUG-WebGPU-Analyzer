# LAZ Converter

LAZ v1.4以降のファイルをv1.3にダウングレードするコマンドラインツール

## 必要な環境

### 変換ツールのインストール

変換には **PDAL** (推奨) または **laszip** コマンドが必要です。

#### オプション1: PDAL (推奨)

**macOS / Linux / Windows:**
```bash
# conda or venv or brew
conda install -c conda-forge pdal
```

**Ubuntu/Debian:**
```bash
sudo apt-get install pdal
```

**メリット:**
- より多くの機能
- macOSで動作する
- パイプライン処理が可能

#### オプション2: laszip

**Ubuntu/Debian:**
```bash
sudo apt-get install laszip
```

**Windows:**
[https://laszip.org/](https://laszip.org/) からダウンロード

**注意:** laszipのCLIツールは macOS の Homebrew では利用できません。macOS では PDAL を使用してください。

## インストール

```bash
cd laz-converter
npm install
```

## 使用方法

### 基本的な変換

```bash
node convert.js <input-file.laz>
```

例：
```bash
node convert.js ../dataset/laz/200406_100502_Sample.laz
```

出力ファイルは自動的に `<input>_v13.laz` として作成されます。

### オプション

#### 出力ファイル名を指定

```bash
node convert.js input.laz -o output.laz
```

#### 既存ファイルを上書き

```bash
node convert.js input.laz -o output.laz --force
```

#### バージョンチェックのみ（変換しない）

```bash
node convert.js input.laz --check-only
```

#### ヘルプ表示

```bash
node convert.js --help
```

## 使用例

### 例1: 単純な変換

```bash
$ node convert.js ../dataset/laz/200406_100502_Sample.laz

🔍 Checking LAZ file...

📄 File: 200406_100502_Sample.laz
📊 Version: LAZ 1.4

⚠️  LAZ v1.4 detected. Conversion required.

🔄 Converting to LAZ v1.3...
   Input:  ../dataset/laz/200406_100502_Sample.laz
   Output: ../dataset/laz/200406_100502_Sample_v13.laz

   Running: laszip -set_version 1.3 -i ../dataset/laz/200406_100502_Sample.laz -o ../dataset/laz/200406_100502_Sample_v13.laz

✅ Conversion complete!
   Output version: LAZ 1.3
   Output file: ../dataset/laz/200406_100502_Sample_v13.laz

📊 File size:
   Input:  15.2 MB
   Output: 14.8 MB
   Saved:  2.6%

⚠️  Note: Point format conversion may result in data loss.
   Please verify the output file meets your requirements.
```

### 例2: 出力先を指定

```bash
node convert.js input_v14.laz -o converted/output.laz
```

### 例3: バージョンチェックのみ

```bash
$ node convert.js ../dataset/laz/sample_v13.laz --check-only

🔍 Checking LAZ file...

📄 File: sample_v13.laz
📊 Version: LAZ 1.3

✅ This file is compatible (v1.3 <= v1.3)
```

### 例4: 既存ファイルの上書き

既存ファイルを上書きする場合は `--force` オプションを使用：
```bash
node convert.js input.laz -o output.laz --force
```

### 例5: 複数ファイルの一括変換（シェルスクリプト）

```bash
# convert_all.sh
#!/bin/bash

for file in ../dataset/laz/*.laz; do
    echo "Processing: $file"
    node convert.js "$file"
    echo "---"
done
```

実行：
```bash
chmod +x convert_all.sh
./convert_all.sh
```

## 注意事項

### データ損失の可能性

LAZ v1.4からv1.3へのダウングレードでは、以下のデータが失われる可能性があります：

- **ポイントフォーマット 6-10** の拡張属性
- **64-bitポイント数** → 32-bitに変換
- **高精度GPS時刻**
- **波形データ**（一部）

1. **可能であればCOPC形式を使用**
   ```bash
   # PDALでCOPCに変換（LAZ 1.4のまま使える）
   pdal translate input_v14.laz output.copc.laz --writers.copc
   ```

## 技術仕様

### 対応バージョン

- **入力**: LAZ 1.0 - 1.4
- **出力**: LAZ 1.3

### ファイル形式

- **拡張子**: `.laz` (圧縮LAS)
- **エンコーディング**: laszip compression

### バージョン検出方法

LASヘッダーのオフセット24-25バイトからバージョン情報を読み取り：
- バイト24: Major version
- バイト25: Minor version
