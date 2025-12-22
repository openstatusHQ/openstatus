export const monitorPausedEmail = () => {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>Your monitors have been paused</title>
      <style>
          body {
              font-family: Arial, sans-serif;
          }
      </style>
  </head>
  <body>
      <p>Hello, </p><p>To save on cloud resources, your monitor(s) has been paused due to inactivity.</p><p>If you would like to unpause your monitor(s), please login to  your account or upgrade to a paid plan.</p><p>If you have any questions, please reply to this email.</p><p>Merci,</p><p>Thibault</p>
  </body>
  </html>

`;
};
