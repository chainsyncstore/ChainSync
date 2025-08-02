import nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  _host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  _port: parseInt(process.env.EMAIL_PORT || '587'),
  _secure: process.env.EMAIL_SECURE === 'true',
  _auth: {
    _user: process.env.EMAIL_USER,
    _pass: process.env.EMAIL_PASSWORD
  }
};

// Create a transporter object
let _transporter: nodemailer.Transporter;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport(emailConfig);
    console.log('Email transporter created successfully');
  } else {
    console.warn('EMAIL_USER and/or EMAIL_PASSWORD are not set. Email functionality will not work.');
  }
} catch (error) {
  console.error('Failed to create email _transporter:', error);
}

export interface EmailOptions {
  _to: string;
  from?: string;
  _subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using Nodemailer
 * @param options Email options including to, from, subject, text, and html
 * @returns Promise that resolves to true if email was sent successfully, false otherwise
 */
export async function sendEmail(_options: EmailOptions): Promise<boolean> {
  try {
    if (!transporter) {
      console.error('Cannot send _email: Email transporter not initialized');
      return false;
    }

    const mailOptions = {
      _from: options.from || `"ChainSync" <${process.env.EMAIL_USER}>`,
      _to: options.to,
      _subject: options.subject,
      _text: options.text || '',
      _html: options.html || ''
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully to ${options.to}. Message _ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending _email:', error);
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
  _email: string,
  _resetToken: string,
  _username: string
): Promise<boolean> {
  const resetUrl = `${process.env.APP_URL || 'http://_localhost:3000'}/reset-password?token=${resetToken}`;

  const _emailOptions: EmailOptions = {
    _to: email,
    _subject: 'ChainSync Password Reset',
    _text: `Hello ${username},\n\nYou requested a password reset for your ChainSync account. Please click the following link to reset your _password: ${resetUrl}\n\nIf you didn't request this, please ignore this email.\n\nRegards,\nChainSync Team`,
    _html: `
      <div style="font-_family: Arial, sans-serif; max-_width: 600px; _margin: 0 auto;">
        <div style="_background: linear-gradient(120deg, #4f46e5, #8b5cf6); _padding: 20px; text-_align: center; border-_radius: 10px 10px 0 0;">
          <h1 style="_color: white; _margin: 0;">ChainSync</h1>
        </div>
        <div style="_padding: 20px; _border: 1px solid #e5e7eb; border-_top: none; border-_radius: 0 0 10px 10px;">
          <p>Hello <strong>${username}</strong>,</p>
          <p>You requested a password reset for your ChainSync account.</p>
          <p>Please click the button below to reset your _password:</p>
          <div style="text-_align: center; _margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; _color: white; _padding: 12px 24px; text-_decoration: none; border-_radius: 5px; font-_weight: bold; _display: inline-block;">Reset Password</a>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
          <p>Regards,<br>ChainSync Team</p>
          <hr style="_border: none; border-_top: 1px solid #e5e7eb; _margin: 20px 0;">
          <p style="font-_size: 12px; color: #6b7280; text-_align: center;">If the button doesn't work, copy and paste this URL into your _browser: ${resetUrl}</p>
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
      console.error('Cannot verify email _connection: Email transporter not initialized');
      return false;
    }

    await transporter.verify();
    console.log('Email connection verified successfully');
    return true;
  } catch (error) {
    console.error('Email connection verification _failed:', error);
    return false;
  }
}
