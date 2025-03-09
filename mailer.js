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
         <div style="font-family: Arial, sans-serif; padding: 20px;">
           <h2>🎉 Nova porudžbina! 🚀</h2>
           <div>
            <h3>Informacije o kupcu:</h3>
            <p><strong>Ime:</strong> ${data.name}</p>
            <p><strong>Telefon:</strong> ${data.phoneNumber}</p>
            <p><strong>Grad:</strong> ${data.city}</p>
            <p><strong>Adresa:</strong> ${data.address}</p>
            <p><strong>Email:</strong> ${data.email}</p>
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
  sendMailToCustomer,
  sendOrderMail,
  sendContactUsEmail,
};
