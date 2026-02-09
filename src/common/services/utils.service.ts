import { Injectable } from "@nestjs/common";

@Injectable()
export class UtilsService {
    constructor() { }

    getTimestamp() {
        return new Date().toISOString();
    }
}