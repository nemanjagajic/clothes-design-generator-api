const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
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
  const visitLink = `https://kreiraj.rs?`;
  let baseUrl = visitLink;
  imageLinks.forEach((link, index) => {
    const encoded = encodeURIComponent(link);
    baseUrl += `img${index}=${encoded}&`;
  });
  baseUrl = baseUrl.slice(0, -1);

  const mailOptions = {
    from: EMAIL_USERNAME,
    to: email,
    subject: 'Kreiraj - Tvoja kreacija je gotova! 🪄',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <h1 style="color: #5b7ab5;">Bravo, tvoja kreacija je gotova! 🪄</h1>
        <p style="font-size: 1.2rem;">Klikni na dugme ispod da vidiš svoju kreaciju:</p>
        <a href="${baseUrl}" style="display: inline-block; background-color: #5b7ab5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Pogledaj</a>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`Error sending confirmation email: ${error}`);
  }
};

const sendContactUsEmail = async ({ text }) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid message');
    }

    const mailOptions = {
      from: EMAIL_USERNAME,
      to: EMAIL_USERNAME,
      subject: 'New Contact Us Message',
      text,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending Contact Us email:', error);
    return { success: false, error: error.message };
  }
};

const formatOrderItem = (item) => `
  <div style="flex: 1 1 250px; max-width: 300px; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center; background-color: #f9f9f9;">
    <img src="${item.printImageSrc || item.imageSrc || ''}" alt="${item.name || 'Proizvod'}" style="width: 150px; height: 150px; object-fit: cover; margin-bottom: 10px;">
    <p style="color: #333;"><strong>Proizvod:</strong> ${item.name || 'Nepoznato'}</p>
    <p style="color: #333; font-weight: bold;"><strong>Kategorija:</strong> ${item.category || 'N/A'}</p>
    <p style="color: #333;"><strong>Boja:</strong> 
      <span style="display: inline-block; width: 12px; height: 12px; background-color: ${item.color?.hex || '#ddd'}; border: 1px solid #999; vertical-align: middle; margin-right: 5px;"></span>
      ${item.color?.description || 'N/A'}
    </p>
    <p style="color: #333;"><strong>Veličina:</strong> ${item?.size?.size ? `${item.size.size} (${item.size.description || 'N/A'})` : 'N/A'}</p>
    <p style="color: #333;"><strong>Dimenzije:</strong> 
      ${item?.size?.width ? `Širina: ${item.size.width}cm` : ''} 
      ${item?.size?.length ? `, Dužina: ${item.size.length}cm` : ''} 
      ${item?.size?.sleeves ? `, Rukavi: ${item.size.sleeves}cm` : ''}
      ${!item?.size?.width && !item?.size?.length && !item?.size?.sleeves ? 'N/A' : ''}
    </p>
    <p style="color: #333;"><strong>Količina:</strong> ${item.productCount || 1}</p>
    <p style="color: #333; font-weight: bold;"><strong>Cena:</strong> ${(item.price || 0) * (item.productCount || 1)} RSD</p>
  </div>
`;



const sendOrderMail = async (data) => {
  try {
    const totalPrice = data.orderItems.reduce((acc, item) => acc + (item.price || 0) * (item.productCount || 1), 0);
    const itemHTML = data.orderItems.map(formatOrderItem).join('');

    const mailOptions = {
      from: EMAIL_USERNAME,
      to: EMAIL_USERNAME,
      subject: '✅ Nova porudžbina kreirana! 🚀',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; text-align: center;">
          <div style="background-color: #007bff; padding: 20px; color: white; border-radius: 8px;">
            <h2>✅ Porudžbina prihvaćena! 🚀</h2>
          </div>
          <p>Vaša porudžbina je uspešno primljena i obrađuje se.</p>
          <h3>Detalji porudžbine:</h3>
          <div style="display: flex; flex-wrap: wrap; justify-content: center;">
            ${itemHTML}
          </div>
          <h3>Ukupna cena: ${totalPrice} RSD</h3>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`Error sending order email: ${error}`);
  }
};

const sendMailToCustomer = async (data) => {
  try {
    const totalPrice = data.orderItems.reduce((acc, item) => acc + (item.price || 0) * (item.productCount || 1), 0);
    const itemHTML = data.orderItems.map(formatOrderItem).join('');

    const mailOptions = {
      from: EMAIL_USERNAME,
      to: data.email,
      subject: '✅ Vaša porudžbina je primljena! 🪄',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; text-align: center;">
          <div style="background-color: #007bff; padding: 20px; color: white; border-radius: 8px;">
            <h2>✅ Hvala na porudžbini, ${data.name || 'Kupče'}! 🚀</h2>
          </div>
          <p>Vaša porudžbina je uspešno primljena i obrađuje se.</p>
          <h3>Detalji porudžbine:</h3>
          <div style="display: flex; flex-wrap: wrap; justify-content: center;">
            ${itemHTML}
          </div>
          <h3>Ukupna cena: ${totalPrice} RSD</h3>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`Error sending customer email: ${error}`);
  }
};

module.exports = {
  sendMail,
  sendMailToCustomer,
  sendOrderMail,
  sendContactUsEmail,
};
