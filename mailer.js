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
  baseUrl = baseUrl.slice(0, -1); // Remove last "&"

  const mailOptions = {
    from: EMAIL_USERNAME,
    to: email,
    subject: 'Kreiraj - Tvoja kreacija je gotova! 🪄',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <h1 style="color: #5b7ab5;">Bravo, tvoja kreacija je gotova! 🪄</h1>
        <p style="font-size: 1.2rem;">Klikni na dugme ispod da vidiš svoju kreaciju:</p>
        <a href="${baseUrl}" style="display: inline-block; background-color: #5b7ab5; color: white; padding: 10px 20px; margin: 10px 0; text-decoration: none; border-radius: 4px;">Pogledaj</a>
        <hr/>
        <p style="font-size: 0.9rem; color: #999;">Poseti nas na <a href="${baseUrl}" style="color: #5b7ab5;">${baseUrl}</a></p>
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

const sendOrderMail = async (data) => {
  console.log(JSON.stringify(data.orderItems, null, 2));
  try {
    const totalPrice = data.orderItems.reduce((acc, item) => acc + item.price * item.productCount, 0);

    const itemHTML = data.orderItems.map((item) => `
      <div style="flex-basis: 45%; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
        <img src="${item.imageSrc}" alt="${item.name}" style="width: 100%; height: auto; border-bottom: 1px solid #ddd; margin-bottom: 10px;">
        <p><strong>Proizvod:</strong> ${item.name}</p>
        <p><strong>Kategorija:</strong> ${item.category}</p>
        <p><strong>Boja:</strong> ${item.color.description} (${item.color.hex})</p>
        <p><strong>Veličina:</strong> ${item?.size?.size ? `${item.size.size} (${item.size.description || 'N/A'})` : 'N/A'}</p>
        <p><strong>Dimenzije:</strong> 
          ${item?.size?.width ? `Širina: ${item.size.width}cm` : ''} 
          ${item?.size?.length ? `, Dužina: ${item.size.length}cm` : ''} 
          ${item?.size?.sleeves ? `, Rukavi: ${item.size.sleeves}cm` : ''}
          ${!item?.size?.width && !item?.size?.length && !item?.size?.sleeves ? 'N/A' : ''}
        </p>
        <p><strong>Količina:</strong> ${item.productCount}</p>
        <p><strong>Cena:</strong> ${item.price * item.productCount} RSD</p>
      </div>
    `).join(' ');

    const mailOptions = {
      from: EMAIL_USERNAME,
      to: EMAIL_USERNAME,
      subject: 'Nova porudžbina kreirana 🪄',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>🎉 Nova porudžbina! 🚀</h2>
          <div>
            <h3>Informacije o kupcu:</h3>
            <p><strong>Ime:</strong> ${data.name}</p>
            <p><strong>Prezime:</strong> ${data.lastName}</p>
            <p><strong>Telefon:</strong> ${data.phoneNumber}</p>
            <p><strong>Grad:</strong> ${data.city}</p>
            <p><strong>Adresa:</strong> ${data.address}</p>
            <p><strong>Email:</strong> ${data.email}</p>
          </div>
          <h3>Detalji porudžbine:</h3>
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between;">
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
    const totalPrice = data.orderItems.reduce((acc, item) => acc + item.price * item.productCount, 0);

    const itemHTML = data.orderItems.map((item) => `
      <div style="flex-basis: 45%; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
        <img src="${item.imageSrc}" alt="${item.name}" style="width: 100%; height: auto; border-bottom: 1px solid #ddd; margin-bottom: 10px;">
        <p><strong>Proizvod:</strong> ${item.name}</p>
        <p><strong>Kategorija:</strong> ${item.category}</p>
        <p><strong>Boja:</strong> ${item.color.description} (${item.color.hex})</p>
        <p><strong>Veličina:</strong> ${item?.size?.size ? `${item.size.size} (${item.size.description || 'N/A'})` : 'N/A'}</p>
        <p><strong>Dimenzije:</strong> 
          ${item?.size?.width ? `Širina: ${item.size.width}cm` : ''} 
          ${item?.size?.length ? `, Dužina: ${item.size.length}cm` : ''} 
          ${item?.size?.sleeves ? `, Rukavi: ${item.size.sleeves}cm` : ''}
          ${!item?.size?.width && !item?.size?.length && !item?.size?.sleeves ? 'N/A' : ''}
        </p>
        <p><strong>Količina:</strong> ${item.productCount}</p>
        <p><strong>Cena:</strong> ${item.price * item.productCount} RSD</p>
      </div>
    `).join(' ');

    const mailOptions = {
      from: EMAIL_USERNAME,
      to: data.email,
      subject: 'Vaša porudžbina je primljena! 🪄',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Hvala na porudžbini, ${data.name}! 🚀</h2>
          <p>Vaša porudžbina je uspešno primljena i obrađuje se.</p>
          <h3>Detalji porudžbine:</h3>
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between;">
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
