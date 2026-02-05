import { Injectable } from "@nestjs/common";
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
    async generateAndHashToken(expireMinutes: number) {
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
        return { token, hashedToken, expiresAt };
    }
}