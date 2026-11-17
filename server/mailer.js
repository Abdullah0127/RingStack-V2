import nodemailer from 'nodemailer'

export function createPasswordResetMailer(environment = process.env) {
  if (!environment.SMTP_URL || !environment.SMTP_FROM) return null
  const transport = nodemailer.createTransport(environment.SMTP_URL)
  return async ({ to, role, resetUrl }) => {
    const audience = role === 'advertiser' ? 'advertiser' : 'publisher'
    await transport.sendMail({
      from: environment.SMTP_FROM,
      to,
      subject: 'Reset your Ringstack password',
      text: `A password reset was requested for your Ringstack ${audience} account. Use this link within one hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>A password reset was requested for your Ringstack ${audience} account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
    })
  }
}
