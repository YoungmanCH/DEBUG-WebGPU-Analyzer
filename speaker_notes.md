# Speaker Notes for Research Presentation (October 17)

## Slide 1: Title Slide - Research Introduction

Today I will present my research progress on two main topics.

---

## Slide 2: Progress/Agenda

First, visualization and evaluation of point cloud data on the browser using WebGPU. Second, plant data grass height analysis and verification using multiple automated methods.

---

## Slide 3: Section Title - Visualization and Evaluation of Point Cloud Data on the Browser Using WebGPU

Let me begin with the first topic: visualization and evaluation of point cloud data using WebGPU.

---

## Slide 4: Research Background (Part 1)

Conventional web-based point cloud visualization primarily uses WebGL. However, WebGL executes rendering commands via the CPU, causing frame rate degradation and processing delays when handling large-scale point clouds over 10⁷ point（ten to the seventh power）. Its GPU memory management flexibility is limited, making parallel processing optimization difficult.

In contrast, WebGPU became a W3C Recommendation in 2023. It allows direct control over GPU resources, enabling parallel execution and efficient buffer management. However, research cases remain limited due to high implementation effort and learning cost.

---

## Slide 5: Research Background (Part 2)

Browser-based point cloud visualization enables platform-independent sharing via networks. This provides substitutability and immediacy for disaster response and on-site inspections. The democratization of visualization data allows collaborative analysis in shared environments, contributing significantly to 3D data research.

---

## Slide 6: What is WebGPU?

WebGPU's architecture consists of several layers. The GPU is the physical device. The Native GPU API is part of the operating system. The WebGPU Adapter represents the physical GPU and driver. The logical device allows each web application to access GPU functionalities in an isolated manner for security reasons.

---

## Slide 7: Research Purpose

This research evaluated multiple point cloud formats under identical conditions: COPC (Cloud Optimized Point Cloud), LAS, LAZ, XYZ, and TIF. The objective is to compare how file format differences affect streaming behavior, initial rendering time, and FPS. This research aims to clarify performance characteristics and challenges of point cloud rendering using WebGPU, deriving new insights for 3D data utilization on browser-based platforms.

---

## Slide 8: Experimental Methods

I used the same dataset for all experiments: LAS point cloud data of central Minato City from the Tokyo Digital Twin Project. I evaluated COPC, LAS, LAZ, XYZ, and TIF under identical conditions, comparing FPS, file size, and behavioral characteristics. The hypothesis is that format differences would reveal insights into rendering performance compatibility and efficient optimization methods such as caching.

---

## Slide 9: Execution Environment

Browser: Chrome version 140.0.7339.215. 
Network: 
  Uplink capacity 66.041 Mbps, 
  Downlink capacity 557.309 Mbps, 
  Responsiveness Medium (191.105 milliseconds | 313 RPM), Idle Latency 16.267 milliseconds | 3688 RPM. Device: M4 MacBook Air 1TB 36MB.

---

## Slide 10: Data Comparison (Small Dataset)

For the small dataset, file sizes were: COPC (LAZ 1.4) 72.20 MB, LAZ 1.2 59.35 MB, LAS 1.2 215.36 MB, XYZ 373.71 MB, GEOTIFF 1.84 MB. 

All point cloud formats contained 6,641,729 points, while GEOTIFF had 801 × 601 pixel resolution.

FPS results: COPC achieved 60-62 FPS, LAZ 1.2 achieved 28-30 FPS, LAS 1.2 achieved 28-30 FPS, XYZ achieved 26-30 FPS, and GEOTIFF achieved 60-62 FPS. COPC uses LAS version 1.4 (16-bit), while LAZ 1.2 and LAS 1.2 use version 1.2 (8-bit).

---

## Slide 11: Data Comparison (Medium Dataset)

For the medium dataset, file sizes were: COPC 174.3 MB, LAZ 1.2 167.8 MB, LAS 1.2 615.4 MB, XYZ 373.71 MB. 

All contained 18,101,404 points. 
However, FPS results show dramatic differences: COPC resulted in ERROR, LAZ 1.2 resulted in ERROR, LAS 1.2 achieved 12 FPS, XYZ resulted in ERROR. 

These errors occurred because the data size exceeded browser memory limits or WebGPU handling capacity.

---

## Slide 12: Data Preview (Original Data)

This shows the original LAS format data from central Minato City, Tokyo. The point cloud captures detailed 3D representation of urban areas including buildings, infrastructure, and terrain features.

---

## Slide 13: COPC Data

Attributes: 
X, Y, Z, Intensity, ReturnNumber, NumberOfReturns, ScanDirectionFlag, EdgeOfFlightLine, Classification, Synthetic, KeyPoint, Withheld, Overlap, ScanAngleRank, UserData, PointSourceId, GpsTime, Red, Green, Blue, ScanChannel.

Conversion using PDAL. Data are converted into an octree structure with LOD (Level of Detail) generation, enabling efficient streaming and rendering.

---

## Slide 14: LAZ Data

Attributes: 
X, Y, Z, Intensity, ReturnNumber, NumberOfReturns, ScanDirectionFlag, EdgeOfFlightLine, Classification, Synthetic, KeyPoint, Withheld, Overlap, ScanAngleRank, UserData, PointSourceId, GpsTime, Red, Green, Blue.

Conversion using PDAL. LAZ applies lossless compression to reduce file size while preserving all attributes.

---

## Slide 15: LAS Data

Attributes: 
X, Y, Z, Intensity, ReturnNumber, NumberOfReturns, ScanDirectionFlag, EdgeOfFlightLine, Classification, Synthetic, KeyPoint, Withheld, Overlap, ScanAngleRank, UserData, PointSourceId, GpsTime, Red, Green, Blue.

This is the original dataset from the Tokyo Digital Twin Project, serving as the baseline for format comparison.

---

## Slide 16: XYZ Data

Attributes: X, Y, Z, R, G, B.

Conversion using PDAL. Extracts only position and color as simple text format.

---

## Slide 17: TIF Data

Attributes: Average height of Z coordinate in grid attributes.

Conversion using PDAL. Converts point cloud into raster elevation model with 0.5 resolution grid cells.

---

## Slide 18: Experimental Results

For approximately 200 MB LAS data (small-scale), verification was successful. However, larger datasets exceeded Worker size limits, WebGPU handling capacity, or browser memory limit of 2 GB, resulting in Out of Memory errors.

COPC format, utilizing Octree structure characteristics, significantly improved rendering performance on WebGPU. The octree enables efficient spatial indexing and level-of-detail management for streaming visualization.

---

## Slide 19: Discussion and Conclusion

The implementation based on WGPU-COPC-Viewer renders 3D data as meshes, not raw points. When handling medium- to large-scale datasets, the current implementation cannot process them effectively due to browser memory limitations and JavaScript processing overhead. Future work requires sophisticated memory management, progressive loading, and Web Workers for parallel processing.

---

## Slide 20: Source Code

Source code: 
The repository includes WebGPU rendering implementation, data loaders for various formats, and benchmarking tools.

---

## Slide 21: Reference

Key references: There are.

---

## Slide 22: Section Title - Plant Data Grass Height Analysis and Verification

Now I will move to the second topic: Plant Data Grass Height Analysis and Verification, focusing on extracting agricultural measurements from 3D plant data.

---

## Slide 23: Research Direction

This research implements, compares, and organizes multiple methods for automatically estimating plant height from point cloud data. The goal is to enable automatic time-series determination of plant height and acquire new insights. The comparison under controlled conditions identifies which approaches are most suitable for different plant types and data acquisition scenarios.

---

## Slide 24: Experimental Methods

I used the 4D Plant Registration Dataset in XYZ format for all experiments. I evaluated common plant height analysis methods under identical conditions. Plant height is calculated as: Plant Height = Maximum Height of Canopy − Ground Height. The challenge lies in accurately identifying these reference points from noisy point cloud data with ambiguous boundaries between plant and non-plant regions.

---

## Slide 25: Execution Environment

3D Viewer: Open3D. 
Language: Python 3.11.11. 
Virtual Environment: venv. 
Device: M4 MacBook Air 1TB 36MB. 

This consistent environment ensures measurement variations can be attributed to algorithms rather than environmental factors.

---

## Slide 26: Data Preview (Original Data)

The original XYZ format data is 33.8 MB. 
The point cloud includes not only the plant but also supporting structures such as containers, substrate, and markers. 

The algorithm must distinguish plant material from these extraneous elements. RGB color information provides valuable segmentation cues.

---

## Slide 27: Percentile Method

Logic: Plant Height = Z₉₅% − Z₅%. 

Issues: Requires visual estimation adjustment. Ground surface definition is ambiguous. Plant/non-plant distinction is unclear. 

Results: Point count 827,828. Plant height (5-95% range) 190.498 mm.

---

## Slide 28: Plant Region Extraction Based on RGB Classification

Logic: Plant regions determined by RGB values. 

Issues: Color classification is difficult due to lighting variations. Plant/non-plant distinction remains ambiguous. 

Results: Plant region 162,645 / 827,828 points. Plant height 226.220 mm. Root points 12,955, stem points 51,639, leaf points 130,367. Lowest root Z = 433.994 mm, highest leaf Z = 660.214 mm.

---

## Slide 29: Automatic Threshold Determination Using Histogram

Logic: Generate Z-coordinate histogram, detect valleys (local minima) to determine boundaries between root, stem, and leaf. 

Issues: Root detection is inaccurate. Noise elements mistakenly identified. 

Results: Root points 308 / 827,828, stem points 1,402, leaf points 147,612. Lowest root Z = 433.994 mm, highest leaf Z = 660.214 mm. Plant height 226.220 mm.

---

## Slide 30: K-means Clustering

Logic: Clustering using Z-coordinate and color information, classifying clusters into root, stem, and leaf. 

Issues: Results vary significantly depending on parameter settings. 

Results: Root points 82,137 / 827,828, stem points 144,138, leaf points 156,447. Lowest root Z = 433.073 mm, highest leaf Z = 660.214 mm. Plant height 227.142 mm.

---

## Slide 31: Top-Down Scanning

Logic: Start from leaf tip (upper region), expand connected region downward, stop upon detecting color discontinuity. 

Issues: Outcome varies depending on leaf tip detection accuracy.

Results: Plant height 113.733 mm (Root Z = 546.481 mm, Leaf tip Z = 660.214 mm). Root points 32,794 / 827,828, stem points 0, leaf points 158,341. Currently provides the most accurate results.

---

## Slide 32: Normal Vector Analysis

Logic: Calculate normal vector of each point. Horizontal normals indicate ground surface, vertical normals indicate stem. 

Issues: Currently in progress. May need to distinguish plant/non-plant regions in advance. Success likely depends on combining with color or height information.

---

## Slide 33: Detection of Model-Based Individual Conifer Tree Crown

This method is based on the paper "Detection of model-based Individual Conifer Tree Crown and Estimation of Tree Height Using LiDAR Point Clouds."

Logic: Define shape model combining cylinder (stem) and semi-ellipsoid (leaf canopy), fit to point cloud.

Issues: Difficult to determine apex for small plants with large leaves rather than conifers. Geometric assumptions don't match actual morphology.

Results: Stem radius 0.1999, stem height 131.7890 mm, leaf radius (0.4625 × 0.0500), leaf height 0.0500 mm. Total plant height 131.8390 mm.

---

## Slide 34: Experiment Result

Since algorithms were not specialized for this dataset and no preprocessing was applied, results showed significant variability. 
This demonstrates challenges of robust automated measurement systems. No single method proved universally superior. 
Different methods showed strengths in different aspects. Future work should focus on hybrid approaches and robust preprocessing pipelines.

---

## Slide 35: Discussion and Conclusion

Future validation requires accurate visual calculation using tools like CloudCompare and precise evaluation of additional datasets over time. The goal is to develop a robust automated system for plant phenotyping supporting agricultural research and precision farming.

---

## Slide 36: Source Code

Source code: The repository includes implementations of all methods, visualization tools, and evaluation scripts.

---

## Slide 37: Reference

Key resources: There are.

---
That all, thank you for your attention. 