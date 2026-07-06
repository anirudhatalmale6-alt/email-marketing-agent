import nodemailer from 'nodemailer'
import { prisma } from './prisma'

export async function getSmtpTransport(configId?: string, userId?: string) {
  const config = configId
    ? await prisma.smtpConfig.findUnique({ where: { id: configId } })
    : await prisma.smtpConfig.findFirst({ where: { isDefault: true, ...(userId ? { userId } : {}) } })

  if (!config) throw new Error('No SMTP configuration found')

  return {
    transport: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
    }),
    from: `"${config.fromName}" <${config.fromEmail}>`,
    config,
  }
}

export function injectTrackingPixel(html: string, campaignLeadId: string, baseUrl: string) {
  const pixel = `<img src="${baseUrl}/api/tracking/open?id=${campaignLeadId}" width="1" height="1" style="display:none" />`
  return html.replace('</body>', `${pixel}</body>`)
}

export function wrapLinks(html: string, campaignLeadId: string, baseUrl: string) {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, url) => `href="${baseUrl}/api/tracking/click?id=${campaignLeadId}&url=${encodeURIComponent(url)}"`
  )
}

export function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}
