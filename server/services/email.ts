import nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Create a transporter object
let transporter: nodemailer.Transporter;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport(emailConfig);
    console.log('Email transporter created successfully');
  } else {
    console.warn('EMAIL_USER and/or EMAIL_PASSWORD are not set. Email functionality will not work.');
  }
} catch (error: unknown) {
  console.error('Failed to create email transporter:', error);
}

export interface EmailOptions {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using Nodemailer
 * @param options Email options including to, from, subject, text, and html
 * @returns Promise that resolves to true if email was sent successfully, false otherwise
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!transporter) {
      console.error('Cannot send email: Email transporter not initialized');
      return false;
    }
    
    const mailOptions = {
      from: options.from || `"ChainSync" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html || ''
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent successfully to ${options.to}. Message ID: ${info.messageId}`);
    return true;
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send a password reset email
 * @param email Recipient email address
 * @param resetToken Reset token to include in the reset link
 * @param username Username of the user
 * @returns Promise that resolves to true if email was sent successfully, false otherwise
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  username: string
): Promise<boolean> {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const emailOptions: EmailOptions = {
    to: email,
    subject: 'ChainSync Password Reset',
    text: `Hello ${username},\n\nYou requested a password reset for your ChainSync account. Please click the following link to reset your password: ${resetUrl}\n\nIf you didn't request this, please ignore this email.\n\nRegards,\nChainSync Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(120deg, #4f46e5, #8b5cf6); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">ChainSync</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hello <strong>${username}</strong>,</p>
          <p>You requested a password reset for your ChainSync account.</p>
          <p>Please click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
          <p>Regards,<br>ChainSync Team</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280; text-align: center;">If the button doesn't work, copy and paste this URL into your browser: ${resetUrl}</p>
        </div>
      </div>
    `
  };
  
  return await sendEmail(emailOptions);
}

/**
 * For testing purposes only - verify if the email connection is working
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (!transporter) {
      console.error('Cannot verify email connection: Email transporter not initialized');
      return false;
    }
    
    await transporter.verify();
    console.log('Email connection verified successfully');
    return true;
  } catch (error: unknown) {
    console.error('Email connection verification failed:', error);
    return false;
  }
}