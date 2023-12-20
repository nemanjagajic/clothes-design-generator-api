// mailer.js

const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const { EMAIL_USERNAME, EMAIL_PASSWORD } = process.env;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USERNAME,
    pass: EMAIL_PASSWORD,
  },
});

const sendMail = async (email, imageLinks = []) => {
  const visitLink = `http://nosistamislis.rs?`;
  let baseUrl = visitLink;
  imageLinks.forEach((link, index) => {
    const encoded = encodeURIComponent(link)
    baseUrl+=`img${index}=${encoded}&`
  })
  baseUrl.slice(0,-1)
  const mailOptions = {
    from: EMAIL_USERNAME,
    to: email,
    subject: 'Nosi Šta Misliš - Tvoja kreacija je gotova! 🪄',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <h1 style="color: #5b7ab5;">Bravo, tvoja kreacija je gotova! 🪄</h1>
        <p style="font-size: 1.2rem;">Klikni na dugme ispod da vidiš svoju kreaciju:</p>
        <a href="${baseUrl}" style="display: inline-block; background-color: #5b7ab5; color: white; padding: 10px 20px; margin: 10px 0; text-decoration: none; border-radius: 4px;">Pogledaj</a>
        <hr/>
        <p style="font-size: 0.9rem; color: #999;">Poseti nas na<a href="${baseUrl}" style="color: #5b7ab5;"> ${baseUrl}</a></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`Error sending confirmation email: ${error}`);
  }
};

module.exports = {
  sendMail,
};
