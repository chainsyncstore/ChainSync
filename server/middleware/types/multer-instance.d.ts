import { Request, Response, NextFunction } from 'express';

export type MulterInstance = {
    (options?: any): (req: Request, res: Response, next: NextFunction) => void;
    any(fieldname?: string): (req: Request, res: Response, next: NextFunction) => void;
    array(fieldname: string, maxCount?: number): (req: Request, res: Response, next: NextFunction) => void;
    fields(fields: Array<{ name: string; maxCount: number }>): (req: Request, res: Response, next: NextFunction) => void;
    single(fieldname: string): (req: Request, res: Response, next: NextFunction) => void;
    none(): (req: Request, res: Response, next: NextFunction) => void;
};
