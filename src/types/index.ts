import { Request } from 'express';

export interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
    userRole: string;
    phoneNumber: string;
    dateOfBirth: string;
    createdAt: string;
    updatedAt: string;
}

export interface RawBodyRequest<T extends Request = Request> extends Request {
    rawBody: Buffer;
}
