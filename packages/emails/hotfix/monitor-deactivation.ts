interface MonitorDeactivationEmailProps {
  date: string;
}

export const monitorDeactivationEmail = (props: MonitorDeactivationEmailProps) => {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>Login to your OpenStatus account to keep your monitors active.</title>
      <style>
          body {
              font-family: Arial, sans-serif;
          }
      </style>
  </head>
  <body>
      <p>Hello, </p><p>To save on cloud resources and avoid having stale monitors. We are deactivating monitors for free account if you have not logged in for the last 2 months.</p><p>Your monitor(s) will be deactivated on ${props.date}</p><p>If you would like to keep your monitor(s) active, please login to  your account or upgrade to a paid plan.</p><p>If you have any questions, please reply to this email.</p><p>Merci,</p><p>Thibault</p>
  </body>
  </html>
`
}
