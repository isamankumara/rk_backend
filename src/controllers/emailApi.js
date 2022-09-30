const nodemailer = require('nodemailer');
const ejs = require('ejs');
const { EMAIL_ADDRESS, EMAIL_ADDRESS_APP_PASSWORD } = process.env;

const from = `"A Life Lived" <${EMAIL_ADDRESS}>`;
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  requireTLS: true,
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_ADDRESS,
    pass: EMAIL_ADDRESS_APP_PASSWORD,
  },
});

const generalInquiry = async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    const emailConfig = {
      from: from,
      to: to,
      subject: subject,
      text: message,
    };

    await transporter.sendMail(emailConfig);

    return res.status(200).send({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('General inquiry email: ', error);
    return res.status(500).send({ error });
  }
};

const sendSystemEventEmail = async message => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      const emailConfig = {
        from: 'noreply@alifelived.org',
        to: process.env.SYSTEM_EVENT_EMAILS,
        subject: 'A Life Lived system event email',
        text: message,
      };

      await transporter.sendMail(emailConfig);
    }
  } catch (error) {
    console.error('sendSystemEventEmail: ', error);
  }
};

const sendTemplateEmailPromise = async (recipients, subject, template, props) => {
  // render the pdf template
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      `src/templates/${template}.ejs`,
      props,
      ejsCallback.bind(null, resolve, reject, recipients, subject)
    );
  });
};

const ejsCallback = async (
  resolve,
  reject,
  { to, cc, bcc },
  subject,
  err,
  html
) => {
  try {
    if (err) {
      reject(err);
    } else {
      await transporter.sendMail({
        from, // sender address
        to,
        cc,
        bcc,
        subject,
        html,
      });
      resolve(html);
    }
  } catch (err) {
    reject(err);
  }
};

module.exports = {
  sendTemplateEmailPromise,
  generalInquiry,
  ejsCallback,
  sendSystemEventEmail,
};
