export function renderTemplate(children: string, title: string) {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>${title}</title>
      <style>
          body {
              font-family: Arial, sans-serif;
          }
          hr {
              border: none;
              width: 100%;
              border-top: 1px solid #eaeaea;
          }
      </style>
  </head>
  <body>
      ${children}
  </body>
  </html>
  `;
}

export function renderTemplateWithFooter(children: string, title: string) {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
        }
        hr {
            border: none;
            width: 100%;
            border-top: 1px solid #eaeaea;
        }
    </style>
</head>
<body>
    ${children}
    <hr style="margin-top: 48px;">
    <p>
        OpenStatus ・ 122 Rue Amelot ・ 75011 Paris, France ・ <a target="_blank" rel="noopener noreferrer" href="mailto:ping@openstatus.dev">Contact Support</a>
    </p>
</body>
</html>
`;
}
