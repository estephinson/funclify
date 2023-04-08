export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export class Logger {
  private level: LogLevel;
  constructor(level: LogLevel) {
    this.level = level;
  }

  public debug(message: string) {
    if (this.level <= LogLevel.Debug) {
      console.debug(message);
    }
  }

  public info(message: string) {
    if (this.level <= LogLevel.Info) {
      console.info(message);
    }
  }

  public warn(message: string) {
    if (this.level <= LogLevel.Warn) {
      console.warn(message);
    }
  }

  public error(message: string) {
    if (this.level <= LogLevel.Error) {
      console.error(message);
    }
  }
}
