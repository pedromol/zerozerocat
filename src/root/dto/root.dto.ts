export class RootDto {
  Key: string | undefined;
}

export class RootResponseDto {
  constructor(status: string) {
    this.status = status;
    return this;
  }
  status: string;
}
