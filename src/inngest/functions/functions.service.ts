import { Injectable } from '@nestjs/common';
import { InngestClientService } from '../inngest.service';
import { EmailService } from '@/email/email.service';

@Injectable()
export class UserFunctionsService {
  private createUserFunction;
  private forgotPasswordFunction;

  constructor(
    private readonly inngestClientService: InngestClientService,
    private readonly emailService: EmailService,
  ) {
    this.createUserFunction = this.inngestClientService.inngest.createFunction(
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

    this.forgotPasswordFunction =
      this.inngestClientService.inngest.createFunction(
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

  getFunctions() {
    return [this.createUserFunction, this.forgotPasswordFunction];
  }
}
