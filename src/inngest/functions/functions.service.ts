import { Injectable } from '@nestjs/common';
import { EmailService } from '@/email/email.service';
import { InngestHealthService } from '../services/inngest-health.service';

@Injectable()
export class UserFunctionsService {
  private createUserFunction;
  private forgotPasswordFunction;

  constructor(
    private readonly inngestHealth: InngestHealthService,
    private readonly emailService: EmailService,
  ) {
    this.createUserFunction = this.inngest.createFunction(
      { id: 'jobxhub/create-db-user', name: 'JobXHub - Create DB User' },
      { event: 'jobxhub/user.created' },
      async ({ event, step }) => {
        const { userId, email, acceptLanguage, verificationUrl } = event.data;

        await step.run('send-verification-email', async () => {
          await this.emailService.sendVerificationEmail(
            email,
            verificationUrl,
            acceptLanguage,
          );
          return { emailSent: true };
        });

        return { success: true, userId };
      },
    );

    this.forgotPasswordFunction = this.inngest.createFunction(
      {
        id: 'jobxhub/user.reset_password',
        name: 'JobXHub - Handle Password Reset Request',
      },
      { event: 'jobxhub/user.reset_password' },
      async ({ event, step }) => {
        const { email, resetUrl, acceptLanguage } = event.data;

        await step.run('send-password-reset-email', async () => {
          await this.emailService.sendPasswordResetEmail(
            email,
            resetUrl,
            acceptLanguage,
          );
          return { emailSent: true };
        });

        return { success: true, email };
      },
    );
  }

  private get inngest() {
    return this.inngestHealth.getInngest();
  }

  getFunctions() {
    return [this.createUserFunction, this.forgotPasswordFunction];
  }
}
