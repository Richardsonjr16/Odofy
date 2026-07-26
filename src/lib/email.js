const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

async function sendTransactionalEmail(to, subject, htmlContent) {
  const region = process.env.AWS_SES_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const fromEmail = process.env.ODOFY_SYSTEM_FROM_EMAIL;

  if (
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId === 'placeholder' ||
    secretAccessKey === 'placeholder'
  ) {
    console.log(`SES not configured — skipping email to ${to}`);
    return null;
  }

  try {
    const client = new SESClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: htmlContent, Charset: 'UTF-8' } },
      },
    });

    const result = await client.send(command);
    return result.MessageId;
  } catch (err) {
    console.error(`SES send failed for ${to}:`, err.message);
    return null;
  }
}

module.exports = { sendTransactionalEmail };
