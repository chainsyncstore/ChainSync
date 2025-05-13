import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY is not set. Email functionality will not work.');
}

export interface EmailOptions {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using SendGrid
 * @param options Email options including to, from, subject, text, and html
 * @returns Promise that resolves with the SendGrid response or rejects with an error
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('Cannot send email: SENDGRID_API_KEY is not set');
      return false;
    }
    
    await sgMail.send({
      to: options.to,
      from: options.from || 'no-reply@chainsync.com', // Default sender
      subject: options.subject,
      text: options.text || '',
      html: options.html || ''
    });
    
    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send a password reset email
 * @param email Recipient email address
 * @param resetToken Reset token to include in the reset link
 * @param username Username of the user
 * @returns Promise that resolves with the SendGrid response or rejects with an error
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  username: string
): Promise<boolean> {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const emailOptions: EmailOptions = {
    to: email,
    from: 'support@chainsync.com',
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