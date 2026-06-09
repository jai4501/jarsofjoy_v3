export const sendEmailOtp = async (
  to_email: string, 
  otp: string, 
  to_name: string = 'User',
  overrideCreds?: { serviceId: string; templateId: string; publicKey: string },
  expiry: string = '10 minutes'
) => {
  try {
    const response = await fetch(`http://localhost:3001/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_email,
        otp_code: otp,
        to_name,
        expiry,
        overrideCreds
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send Email OTP');
    }
    return data;
  } catch (error) {
    console.error('Email OTP Error:', error);
    throw error;
  }
};
