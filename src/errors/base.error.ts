import { ErrorShape } from '../types';

export class BaseError extends Error implements ErrorShape {
  constructor(
    public code: string,
    public type: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.type = type;

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
