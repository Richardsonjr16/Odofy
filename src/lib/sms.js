const twilio = require('twilio');

async function sendSms(toPhoneNumber, messageBody) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials are not fully configured');
  }

  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    body: messageBody,
    from: fromNumber,
    to: toPhoneNumber,
  });

  return message.sid;
}

module.exports = { sendSms };
