import { Resend } from 'resend';

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@lootly.gg';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendWinnerEmail(params: {
  to: string;
  winnerUsername: string;
  giveawayTitle: string;
  prize: string;
  archiveUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping winner email to', params.to);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `🏆 You won ${params.giveawayTitle}!`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
          <h1 style="color: #d97706;">🏆 Congratulations, @${params.winnerUsername}!</h1>
          <p>You won: <strong>${params.prize}</strong></p>
          <p>Giveaway: ${params.giveawayTitle}</p>
          <p><a href="${params.archiveUrl}" style="color: #d97706;">View Draw Proof</a></p>
        </div>
      `,
    });
    console.log('[Email] Winner email sent to', params.to);
  } catch (err) {
    console.warn('[Email] Failed to send winner email:', err instanceof Error ? err.message : err);
  }
}

export async function sendDrawReminderEmail(params: {
  to: string;
  giveawayTitle: string;
  drawUrl: string;
  minutesUntilDraw: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `⏰ Draw in ${params.minutesUntilDraw} minutes — ${params.giveawayTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
          <h1 style="color: #d97706;">⏰ Draw starting soon!</h1>
          <p>${params.giveawayTitle} draw is in ${params.minutesUntilDraw} minutes.</p>
          <p><a href="${params.drawUrl}" style="color: #d97706;">Watch Live Draw</a></p>
        </div>
      `,
    });
  } catch (err) {
    console.warn('[Email] Failed to send reminder:', err instanceof Error ? err.message : err);
  }
}
