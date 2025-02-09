// mailer.js

const nodemailer = require('nodemailer')
const dotenv = require('dotenv')
dotenv.config()

const { EMAIL_USERNAME, EMAIL_PASSWORD } = process.env

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USERNAME,
    pass: EMAIL_PASSWORD,
  },
})

const sendMail = async (email, imageLinks = []) => {
  const visitLink = `http://nosistamislis.rs?`
  let baseUrl = visitLink
  imageLinks.forEach((link, index) => {
    const encoded = encodeURIComponent(link)
    baseUrl += `img${index}=${encoded}&`
  })
  baseUrl.slice(0, -1)
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
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error(`Error sending confirmation email: ${error}`)
  }
}

const sendContactUsEmail = async ({ text }) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid message');
    }

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: 'nosistamislis@gmail.com',
      subject: 'New Contact Us Message',
      text,
    };

    await transporter.sendMail(mailOptions);

    console.log('Contact Us email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending Contact Us email:', error);
    return { success: false, error: error.message };
  }
};


const genderToLabel = {
  male: 'Muški',
  female: 'Ženski',
}

const sendOrderMail = async (data) => {
  try {
    const totalPrice = data.orderItems.reduce((acc, item) => {
      return acc + item.price * item.quantity
    }, 0)

    const itemHTML = data.orderItems.map((item) => {
      return `
        <div style = "flex-basis: 45%; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;" >
          <img src="${
            item.mainImageUrl
          }" alt="Majica 1" style="width: 100%; height: auto; border-bottom: 1px solid #ddd; margin-bottom: 10px;">
            <p><strong>Majica broj:</strong> ${item.imageIndex}</p>
            <p><strong>Tip:</strong> ${genderToLabel[item.gender]}</p>
            <p><strong>Boja:</strong> ${item.color}</p>
            <p><strong>Veličina:</strong> ${item.size}</p>
            <p><strong>Količina:</strong> ${item.quantity}</p>
            <p><strong>Cena:</strong> ${item.price * item.quantity}RSD</p>
          </div>
      `
    })
    const mailOptions = {
      from: EMAIL_USERNAME,
      to: EMAIL_USERNAME,
      subject: 'Nova porudzbina kreirana 🪄',
      html: `
      <!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f4f4f4; 
        }
        .email-container { 
            max-width: 600px; 
            margin: auto; 
            background: #ffffff; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.05); 
        }
        .header { 
            background-color: #007bff; 
            padding: 20px; 
            text-align: center; 
            color: white; 
            border-top-left-radius: 8px; 
            border-top-right-radius: 8px; 
        }
        .header h1 {
            margin: 0;
        }
        .content { 
            margin-top: 20px; 
            padding: 0 20px; 
        }
        .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            margin-top: 20px; 
            text-align: center; 
            border-bottom-left-radius: 8px; 
            border-bottom-right-radius: 8px; 
        }
        .order-details { 
            background-color: #e9ecef; 
            padding: 15px; 
            margin-top: 15px; 
            border-radius: 8px; 
        }
        a { 
            color: #007bff; 
            text-decoration: none; 
        }
        a:hover {
            text-decoration: underline;
        }
        .social-media img {
            height: 24px; 
            margin: 0 10px; 
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <!-- Ovde dodajte logo vaše prodavnice -->
            <h1>🎉 Nova porudzbina! 🚀</h1>
        </div>

        <div class="content">
            <div class="user-info" style="background-color: #e9ecef; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
                <h3>Informacije o Kupcu:</h3>
                <p><strong>Ime:</strong> ${data.name}</p>
                <p><strong>Prezime:</strong> ${data.lastName}</p>
                <p><strong>Telefon:</strong> ${data.phoneNumber}</p>
                <p><strong>Grad:</strong> ${data.city}</p>
                <p><strong>Adresa:</strong> ${data.address}</p>
                <p><strong>Email:</strong> ${data.email}</p>
            </div>
            <div class="order-details" style="display: flex; flex-wrap: wrap; justify-content: space-around;">
                ${itemHTML.join(' ')}
            </div>
            <p><strong>Ukupna cena: ${totalPrice}RSD</strong></p>
        </div>
    </div>
</body>
</html>
      `,
    }

    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error(`Error sending batoo: ${error}`)
  }
}

const sendMailToCustomer = async (data) => {
  try {
    const totalPrice = data.orderItems.reduce((acc, item) => {
      return acc + item.price * item.quantity
    }, 0)
    const itemHTML = data.orderItems.map((item) => {
      return `
        <div style = "flex-basis: 45%; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;" >
          <img src="${
            item.mainImageUrl
          }" alt="Majica 1" style="width: 100%; height: auto; border-bottom: 1px solid #ddd; margin-bottom: 10px;">
            <p><strong>Majica broj:</strong> ${item.imageIndex}</p>
            <p><strong>Tip:</strong> ${genderToLabel[item.gender]}</p>
            <p><strong>Boja:</strong> ${item.color}</p>
            <p><strong>Veličina:</strong> ${item.size}</p>
            <p><strong>Količina:</strong> ${item.quantity}</p>
            <p><strong>Cena:</strong> ${item.price * item.quantity}RSD</p>
          </div>
      `
    })
    const mailOptions = {
      from: EMAIL_USERNAME,
      to: data.email,
      subject: 'Nova porudzbina! 🪄',
      html: `
      <!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f4f4f4; 
        }
        .email-container { 
            max-width: 600px; 
            margin: auto; 
            background: #ffffff; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.05); 
        }
        .header { 
            background-color: #007bff; 
            padding: 20px; 
            text-align: center; 
            color: white; 
            border-top-left-radius: 8px; 
            border-top-right-radius: 8px; 
        }
        .header h1 {
            margin: 0;
        }
        .content { 
            margin-top: 20px; 
            padding: 0 20px; 
        }
        .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            margin-top: 20px; 
            text-align: center; 
            border-bottom-left-radius: 8px; 
            border-bottom-right-radius: 8px; 
        }
        .order-details { 
            background-color: #e9ecef; 
            padding: 15px; 
            margin-top: 15px; 
            border-radius: 8px; 
        }
        a { 
            color: #007bff; 
            text-decoration: none; 
        }
        a:hover {
            text-decoration: underline;
        }
        .social-media img {
            height: 24px; 
            margin: 0 10px; 
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <!-- Ovde dodajte logo vaše prodavnice -->
            <h1>✅ Porudžbina prihvaćena! 🚀</h1>
        </div>

        <div class="content">
            <p>Zdravo ${data.name}! 👋</p>
            <p>Super vesti! Vaša narudžbina je uspešno primljena i u obradi je. Evo šta možete očekivati u vašem paketu:</p>
            
            <!-- Sekcija Detalja Narudžbine -->
            <div class="user-info" style="background-color: #e9ecef; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
                <h3>Informacije o Kupcu:</h3>
                <p><strong>Ime:</strong> ${data.name}</p>
                <p><strong>Prezime:</strong> ${data.lastName}</p>
                <p><strong>Telefon:</strong> ${data.phoneNumber}</p>
                <p><strong>Grad:</strong> ${data.city}</p>
                <p><strong>Adresa:</strong> ${data.address}</p>
                <p><strong>Email:</strong> ${data.email}</p>
            </div>
            <div class="order-details" style="display: flex; flex-wrap: wrap; justify-content: space-around;">
                ${itemHTML.join(' ')}
            </div>
            <p><strong>Ukupna cena: ${totalPrice}RSD</strong></p>
            

            <p>Svaka majica je kreirana sa posebnom pažnjom i inspirisana vašim idejama 🌟</p>
        </div>

        <div class="footer">
            
            <p>Za bilo kakva pitanja ili vam treba pomoć, slobodno nam se obratite na nosistamislis@gmail.com</p>
            <p>Hvala na poverenju,</p>

            <i>Nosi Šta Misliš tim</i>
        </div>
    </div>
</body>
</html>
      `,
    }

    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error(`Error sending batoo: ${error}`)
  }
}

module.exports = {
  sendMail,
  sendMailToCustomer,
  sendOrderMail,
  sendContactUsEmail
}
