export class UrlPattern {
  public pattern: string;
  constructor(pattern: string) {
    this.pattern = pattern;
  }

  match(url: string): boolean {
    const components = this.pattern.split('/');
    const urlComponents = url.split('/');

    if (components.length !== urlComponents.length) {
      return false;
    }

    for (let i = 0; i < components.length; i++) {
      if (components[i].startsWith(':')) {
        continue;
      }

      if (components[i] !== urlComponents[i]) {
        return false;
      }
    }

    return true;
  }

  parse(url: string): any {
    const components = this.pattern.split('/');
    const urlComponents = url.split('/');
    const result: Record<string, any> = {};

    for (let i = 0; i < components.length; i++) {
      if (components[i].startsWith(':')) {
        result[components[i].substring(1)] = urlComponents[i];
      }
    }

    return result;
  }
}
