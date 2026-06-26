/**
 * Telegram Notification Alert Service.
 * dispatches server alerts to developer chats on pipeline failures.
 */

export async function sendTelegramAlert(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(`[TelegramAlert] (Disabled - config missing) Message: ${message}`);
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ <b>[HandicapLab Alert]</b>\n\n${message}`,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[TelegramAlert] API returned error status ${response.status}:`, responseText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[TelegramAlert] Connection error dispatching webhook:', error);
    return false;
  }
}
