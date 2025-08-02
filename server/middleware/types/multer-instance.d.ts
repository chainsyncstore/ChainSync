import { Request, Response, NextFunction } from 'express';

export type MulterInstance = {
    (options?: any): (_req: Request, _res: Response, _next: NextFunction) => void;
    any(fieldname?: string): (_req: Request, _res: Response, _next: NextFunction) => void;
    array(_fieldname: string, maxCount?: number): (_req: Request, _res: Response, _next: NextFunction)
   = > void;
    fields(_fields: Array<{ _name: string; _maxCount: number }>): (_req: Request, _res: Response, _next: NextFunction)
   = > void;
    single(_fieldname: string): (_req: Request, _res: Response, _next: NextFunction) => void;
    none(): (_req: Request, _res: Response, _next: NextFunction) => void;
};
