import { CanvasEventManager } from "../webgpu/canvas-event";
import { P_CACHE } from "../configs";

export async function createPersistentMetaCache() {
  const fileToCheck = `${P_CACHE}.json`;
  const [alreadyExist]: any = await doesExist(fileToCheck);
  if (!alreadyExist) {
    const root = await navigator.storage.getDirectory();
    await root.getFileHandle(fileToCheck, {
      create: true,
    });
  } else {
    console.log("meta cache file already exist");
  }
}

export async function doesExist(fileName) {
  try {
    const fileToCheck = `${fileName}.bin`;
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(fileToCheck);
    const retrievedBlob = await fileHandle.getFile();
    if (retrievedBlob.size > 0) {
      return await _readBlobAsJSON(retrievedBlob);
    } else {
      return [true, { position: [], color: [] }];
    }
  } catch (error) {
    if (error.name === "NotFoundError") {
      return [false, null];
    } else {
      console.error("Error checking if file exists:", error);
      return [false, null];
    }
  }
}

export const throttledUpdatePersCache = new CanvasEventManager().throttle(
  _updatePersCache,
  30000
);

export async function writeFile(fileName, data) {
  const fileToCheck = `${fileName}.bin`;
  const blob = new Blob([data], { type: "application/octet-stream" });
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileToCheck, {
    create: true,
  });
  const writableStream = await fileHandle.createWritable();
  await writableStream.write(blob);
  await writableStream.close();
}

async function _readBlobAsJSON(blob) {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function () {
      resolve([true, JSON.parse(reader.result as string)]);
    };
    reader.readAsText(blob);
  });
}

async function _updatePersCache(updatedData) {
  const fileToCheck = `${P_CACHE}.json`;
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileToCheck, {
    create: true,
  });
  const writableStream = await fileHandle.createWritable();
  await writableStream.write(updatedData);
  await writableStream.close();
  console.log("cache updating is done");
}
