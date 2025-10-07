declare module "*.worker.ts" {
  export default class Worker {
    constructor();
  }
}

declare module "*.worker.js" {
  export default class Worker {
    constructor();
  }
}

declare module "*.worker" {
  export default class Worker {
    constructor();
  }
}

declare const __webpack_public_path__: string;
declare module "*.css";
