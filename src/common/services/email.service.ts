import { ConfigService } from '@/common/services/config.service';
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpPort = this.configService.smtpPort;
    // Port 465 typically uses SSL (secure: true), port 587 uses STARTTLS (secure: false, requireTLS: true)
    const isSecurePort = smtpPort === 465;

    const smtpConfig: any = {
      host: this.configService.smtpHost,
      port: smtpPort,
      secure: isSecurePort, // true for 465, false for other ports
      auth: {
        user: this.configService.smtpUser,
        pass: this.configService.smtpPass,
      },
    };

    // For non-secure ports (like 587), require TLS
    if (!isSecurePort) {
      smtpConfig.requireTLS = true;
      smtpConfig.tls = {
        rejectUnauthorized: false, // Allow self-signed certificates
      };
    }

    this.logger.log(
      `Initializing SMTP transporter with host: ${smtpConfig.host}, port: ${smtpConfig.port}, secure: ${smtpConfig.secure}, user: ${smtpConfig.auth.user}`,
    );

    this.transporter = nodemailer.createTransport(smtpConfig);

    // Verify SMTP connection on initialization (fire and forget)
    this.verifyConnection().catch((error) => {
      this.logger.warn(`Initial SMTP verification failed, but service will continue: ${error?.message}`);
    });
  }

  private async verifyConnection() {
    try {
      this.logger.log('Verifying SMTP connection...');
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error: any) {
      this.logger.error(`SMTP connection verification failed: ${error?.message}`, error?.stack);
      Sentry.captureException(error, {
        tags: {
          operation: 'smtp_verification',
        },
        extra: {
          errorMessage: error?.message,
          smtpHost: this.configService.smtpHost,
          smtpPort: this.configService.smtpPort,
        },
      });
    }
  }

  async sendVerificationEmail(
    to: string,
    verificationUrl: string,
    acceptLanguage: string,
  ) {
    const translations = {
      en: {
        subject: 'Verify Your Email Address',
        title: 'Email Verification',
        message:
          'Thank you for registering! Please verify your email address by clicking the button below:',
        button: 'Verify Email',
        ignore: "If you didn't create an account, please ignore this email.",
        fallback:
          "If the button doesn't work, copy and paste this link into your browser:",
      },
      kh: {
        subject: 'បញ្ជាក់អាសយដ្ឋានអ៊ីមែលរបស់អ្នក',
        title: 'ការបញ្ជាក់អ៊ីមែល',
        message:
          'សូមអរគុណសម្រាប់ការចុះឈ្មោះ! សូមបញ្ជាក់អាសយដ្ឋានអ៊ីមែលរបស់អ្នកដោយចុចប៊ូតុងខាងក្រោម៖',
        button: 'បញ្ជាក់អ៊ីមែល',
        ignore: 'ប្រសិនបើអ្នកមិនបានបង្កើតគណនីទេ សូមអើពើអ៊ីមែលនេះ។',
        fallback:
          'ប្រសិនបើប៊ូតុងមិនដំណើរការទេ សូមចម្លងនិងដាក់តំណនេះទៅក្នុងកម្មវិធីរុករករបស់អ្នក៖',
      },
      de: {
        subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
        title: 'E-Mail-Bestätigung',
        message:
          'Vielen Dank für Ihre Registrierung! Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf die Schaltfläche unten klicken:',
        button: 'E-Mail bestätigen',
        ignore:
          'Wenn Sie kein Konto erstellt haben, ignorieren Sie bitte diese E-Mail.',
        fallback:
          'Wenn die Schaltfläche nicht funktioniert, kopieren Sie diesen Link und fügen Sie ihn in Ihren Browser ein:',
      },
    };

    const lang = translations[acceptLanguage] || translations.en;

    const mailOptions = {
      from: this.configService.emailFrom,
      to,
      subject: lang.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">${lang.title}</h1>
          <p>${lang.message}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #4CAF50; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              ${lang.button}
            </a>
          </div>
          <p style="color: #666;">${lang.ignore}</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${lang.fallback}<br>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </p>
        </div>
      `,
    };

    try {
      this.logger.log(`Sending verification email to: ${to}`);
      this.logger.debug(`Email from: ${mailOptions.from}, subject: ${mailOptions.subject}`);

      // Verify connection before sending
      try {
        await this.transporter.verify();
      } catch (verifyError: any) {
        this.logger.warn(`SMTP connection check failed before sending: ${verifyError?.message}`);
      }

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent successfully to: ${to}. MessageId: ${result.messageId}`);
      this.logger.debug(`Email response: ${JSON.stringify(result.response)}`);
      return result;
    } catch (error: any) {
      const errorDetails = {
        message: error?.message,
        code: error?.code,
        command: error?.command,
        response: error?.response,
        responseCode: error?.responseCode,
        stack: error?.stack,
      };

      this.logger.error(
        `Failed to send verification email to: ${to}. Error: ${error?.message}`,
        error?.stack || error,
      );
      this.logger.error(`Email error details: ${JSON.stringify(errorDetails, null, 2)}`);

      Sentry.captureException(error, {
        tags: {
          operation: 'send_verification_email',
        },
        extra: {
          to,
          acceptLanguage,
          from: mailOptions.from,
          errorDetails,
        },
      });
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, name: string, acceptLanguage: string) {
    // Email translations
    const translations = {
      en: {
        subject: 'Welcome to JobXHub!',
        greeting: 'Welcome',
        message:
          "We're thrilled to have you join us. Let us know if you need anything.",
        signOff: 'Cheers,<br>The Team',
      },
      kh: {
        subject: 'សូមស្វាគមន៍មកកាន់ JobXHub!',
        greeting: 'សូមស្វាគមន៍',
        message:
          'យើងរីករាយណាស់ដែលបានស្វាគមន៍អ្នក។ សូមប្រាប់យើងប្រសិនបើអ្នកត្រូវការអ្វីមួយ។',
        signOff: 'សូមគោរព,<br>ក្រុមការងារ',
      },
      de: {
        subject: 'Willkommen bei JobXHub!',
        greeting: 'Willkommen',
        message:
          'Wir freuen uns sehr, dass Sie bei uns sind. Lassen Sie uns wissen, wenn Sie etwas benötigen.',
        signOff: 'Mit freundlichen Grüßen,<br>Das Team',
      },
    };

    // Default to English if locale not found
    const content =
      translations[acceptLanguage as keyof typeof translations] ||
      translations.en;

    const mailOptions = {
      from: this.configService.emailFrom,
      to,
      subject: content.subject,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">${content.greeting}, ${name}!</h1>
        <p>${content.message}</p>
        <p style="color: #666;">${content.signOff}</p>
      </div>
    `,
    };

    try {
      this.logger.log(`Sending welcome email to: ${to}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent successfully to: ${to}. MessageId: ${result.messageId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to send welcome email to: ${to}`, error?.stack || error);
      Sentry.captureException(error, {
        tags: {
          operation: 'send_welcome_email',
        },
        extra: {
          to,
          name,
          acceptLanguage,
          errorMessage: error?.message,
        },
      });
      throw error;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    acceptLanguage: string,
  ) {
    const translations = {
      en: {
        subject: 'Password Reset Request',
        title: 'Password Reset Request',
        message:
          'You requested a password reset. Click the button below to reset your password:',
        button: 'Reset Password',
        expiry: 'This link will expire in 15 minutes',
        ignore: "If you didn't request this, please ignore this email.",
        fallback:
          "If the button doesn't work, copy and paste this link into your browser:",
      },
      kh: {
        subject: 'ការស្នើសុំកំណត់ពាក្យសម្ងាត់ឡើងវិញ',
        title: 'ការស្នើសុំកំណត់ពាក្យសម្ងាត់ឡើងវិញ',
        message: `អ្នកបានស្នើសុំកំណត់ពាក្យសម្ងាត់ឡើងវិញ។ សូមចុចប៊ូតុងខាងក្រោមដើម្បីកំណត់ពាក្យសម្ងាត់របស់អ្នកឡើងវិញ៖ ${resetUrl}`,
        button: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញ',
        expiry: 'តំណនេះនឹងផុតកំណត់ក្នុងរយៈពេល 15 នាទី',
        ignore: 'ប្រសិនបើអ្នកមិនបានស្នើសុំនេះទេ សូមអើពើអ៊ីមែលនេះ។',
        fallback:
          'ប្រសិនបើប៊ូតុងមិនដំណើរការទេ សូមចម្លងនិងដាក់តំណនេះទៅក្នុងកម្មវិធីរុករករបស់អ្នក៖',
      },
      de: {
        subject: 'Anfrage zum Zurücksetzen des Passworts',
        title: 'Anfrage zum Zurücksetzen des Passworts',
        message:
          'Sie haben das Zurücksetzen Ihres Passworts angefordert. Klicken Sie auf die Schaltfläche unten, um Ihr Passwort zurückzusetzen:',
        button: 'Passwort zurücksetzen',
        expiry: 'Dieser Link läuft in 15 Minuten ab.',
        ignore:
          'Wenn Sie dies nicht angefordert haben, ignorieren Sie bitte diese E-Mail.',
        fallback:
          'Wenn die Schaltfläche nicht funktioniert, kopieren Sie diesen Link und fügen Sie ihn in Ihren Browser ein:',
      },
    };

    const lang = translations[acceptLanguage] || translations.en;

    const mailOptions = {
      from: this.configService.emailFrom,
      to,
      subject: lang.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">${lang.title}</h1>
          <p>${lang.message}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4CAF50; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              ${lang.button}
            </a>
          </div>
          <p style="color: #666;">${lang.expiry}</p>
          <p style="color: #666;">${lang.ignore}</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${lang.fallback}<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      `,
    };

    try {
      this.logger.log(`Sending password reset email to: ${to}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent successfully to: ${to}. MessageId: ${result.messageId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to send password reset email to: ${to}`, error?.stack || error);
      Sentry.captureException(error, {
        tags: {
          operation: 'send_password_reset_email',
        },
        extra: {
          to,
          acceptLanguage,
          errorMessage: error?.message,
        },
      });
      throw error;
    }
  }

  async sendDailyJobListingEmail(params: {
    to: string;
    firstName: string;
    lastName: string;
    jobListings: { id: string; title: string; organizationName: string; city?: string; stateAbbreviation?: string }[];
    aiPrompt?: string | null;
  }) {
    const { to, firstName, lastName, jobListings, aiPrompt } = params;
    const greeting = firstName ? `Hi ${firstName} ${lastName}` : 'Hi there';

    const jobListingsHtml = jobListings
      .map(
        (job) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              <strong style="color: #333;">${job.title}</strong><br>
              <span style="color: #666; font-size: 13px;">${job.organizationName}</span>
              ${job.city || job.stateAbbreviation ? `<br><span style="color: #999; font-size: 12px;">${[job.city, job.stateAbbreviation].filter(Boolean).join(', ')}</span>` : ''}
            </td>
          </tr>`,
      )
      .join('');

    const aiPromptNote = aiPrompt
      ? `<p style="color: #555; font-size: 13px; font-style: italic;">Your custom search preference: <em>${aiPrompt}</em></p>`
      : '';

    const mailOptions = {
      from: this.configService.emailFrom,
      to,
      subject: `🔔 ${jobListings.length} New Job${jobListings.length > 1 ? 's' : ''} Matching Your Preferences`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Daily Job Digest</h1>
          <p>${greeting},</p>
          <p>Here are the latest job listings you might be interested in:</p>
          ${aiPromptNote}
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            ${jobListingsHtml}
          </table>
          <p style="color: #666; font-size: 12px;">
            You're receiving this because you have daily job notifications enabled.
            You can update your notification preferences in your account settings.
          </p>
        </div>
      `,
    };

    try {
      this.logger.log(`Sending daily job listing email to: ${to}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Daily job listing email sent successfully to: ${to}. MessageId: ${result.messageId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to send daily job listing email to: ${to}`, error?.stack || error);
      Sentry.captureException(error, {
        tags: { operation: 'send_daily_job_listing_email' },
        extra: { to, errorMessage: error?.message },
      });
      throw error;
    }
  }

  /**
   * Test method to verify email service is working
   * This can be called to diagnose email sending issues
   */
  async testEmailConnection() {
    try {
      this.logger.log('Testing SMTP connection...');
      const verified = await this.transporter.verify();
      this.logger.log('SMTP connection test passed');
      return { success: true, verified };
    } catch (error: any) {
      this.logger.error(`SMTP connection test failed: ${error?.message}`, error?.stack);
      return {
        success: false,
        error: error?.message,
        code: error?.code,
        command: error?.command,
      };
    }
  }
}
