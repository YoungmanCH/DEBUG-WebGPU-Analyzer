import { throttle } from "../webgpu/renderer";

// Query storage usage for monitoring (no global state needed)
navigator.webkitPersistentStorage.queryUsageAndQuota(
  function () {
    // Available for future monitoring if needed
  },
  function (error) {
    console.error("Error getting origin-private file system size:", error);
  }
);

export async function clearAllFiles() {
  const root = await navigator.storage.getDirectory();
  const fileNames = root.keys();
  let x = await fileNames.next();
  while (!x.done) {
    const fileName = x.value;
    const fileHandle = await root.getFileHandle(fileName);
    await fileHandle.remove();
    x = await fileNames.next();
  }
}

export async function createPersistentMetaCache() {
  const fileToCheck = `${process.env.p_cache}.json`;
  const [alreadyExist] = await doesExist(fileToCheck);
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

export async function readFile(fileName) {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(`${fileName}.bin`, {
    create: false,
  });
  const file = await fileHandle.getFile();
  const content = await file.text();
  if (content) {
    return JSON.parse(content);
  }
  return null;
}

export const throttledUpdatePersCache = throttle(_updatePersCache, 30000);

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
      resolve([true, JSON.parse(reader.result)]);
    };
    reader.readAsText(blob);
  });
}

async function _updatePersCache(updatedData) {
  const fileToCheck = `${process.env.p_cache}.json`;
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(fileToCheck, {
    create: true,
  });
  const writableStream = await fileHandle.createWritable();
  await writableStream.write(updatedData);
  await writableStream.close();
  console.log("cache updating is done");
}
