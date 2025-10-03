function deepCopy(obj) {
  const newObj = {};

  for (let key in obj) {
    const value = obj[key];

    if (typeof value === "object" && value !== null) {
      newObj[key] = deepCopy(value);
    } else {
      newObj[key] = value;
    }
  }

  return newObj;
}

export { deepCopy };
