export abstract class BaseFileLoader<T = any> {
  protected filename: string;

  constructor(filename: string) {
    this.filename = filename;
  }

  abstract loadFile(): Promise<T>;
}
