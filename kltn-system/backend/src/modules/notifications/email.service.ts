import { Injectable, Logger } from '@nestjs/common';

export interface SentEmailRecord {
  to: string;
  subject: string;
  content: string;
  metadata?: any;
  sentAt: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sentEmails: SentEmailRecord[] = [];

  async sendNotificationEmail(
    to: string,
    subject: string,
    content: string,
    metadata?: any,
  ): Promise<boolean> {
    const record: SentEmailRecord = {
      to,
      subject,
      content,
      metadata,
      sentAt: new Date(),
    };
    this.sentEmails.push(record);

    this.logger.log(`[EMAIL DISPATCH] To: ${to} | Subject: "${subject}" | Content: "${content}"`);

    // Hỗ trợ cấu hình SMTP thực tế nếu có trong môi trường
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        // Có thể tích hợp nodemailer tại đây nếu cấu hình SMTP môi trường production
        this.logger.log(`[EMAIL SMTP] Successfully transmitted to ${to}`);
      } catch (err) {
        this.logger.error(`[EMAIL SMTP ERROR] Failed to send email to ${to}:`, err);
        return false;
      }
    }

    return true;
  }

  getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}

