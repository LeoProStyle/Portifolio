declare module "formidable" {
  import * as http from 'http';
  import * as fs from 'fs';

  export type IncomingFormOptions = {
    uploadDir?: string;
    keepExtensions?: boolean;
    multiples?: boolean;
  };

  export class IncomingForm {
    ctor(options?: IncomingFormOptions);
    uploadDir?: string;
    keepExtensions?: boolean;
    parse(req: http.IncomingMessage, callback: (err: any, fields: any, files: any) => void): void;
  }

  const formidable: {
    IncomingForm: typeof IncomingForm;
  };

  export default formidable;
}
