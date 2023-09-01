import { TwitterIcon } from "lucide-react";

import { Icons } from "@/components/icons";

type SocialLink = {
  icon: React.FC<any>;
  link: string;
};

type Friend = {
  name: string;
  website: string;
  description: string;
  socialLinks: {
    twitter?: SocialLink;
    github?: SocialLink;
    discord?: SocialLink;
  };
  logo: string;
};

const GithubIcon = Icons.github;
const DiscordIcon = Icons.discord;

export const openSourceFriends: Friend[] = [
  {
    name: "Documenso",
    website: "https://documenso.com/",
    description:
      "The Open-Source DocuSign Alternative. We aim to earn your trust by enabling you to self-host the platform and examine its inner workings.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/documenso",
      },
      github: {
        icon: Icons.github,
        link: "https://github.com/documenso/documenso",
      },
      discord: {
        icon: Icons.discord,
        link: "https://documen.so/discord",
      },
    },
    logo: "data:image/png;base64,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",
  },
  {
    name: "Erxes",
    website: "https://erxes.io/",
    description:
      "The Open-Source HubSpot Alternative. A single XOS enables to create unique and life-changing experiences that work for all types of business.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/erxeshq",
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/erxes",
      },
      discord: {
        icon: DiscordIcon,
        link: "https://discord.com/invite/aaGzy3gQK5",
      },
    },
    logo: "https://images.crunchbase.com/image/upload/c_lpad,f_auto,q_auto:eco,dpr_1/ssn6vw2bwrkdwnonli6d",
  },
  {
    name: "Infisical",
    website: "https://infisical.io/",
    description:
      "Open source, end-to-end encrypted platform that lets you securely manage secrets and configs across your team, devices, and infrastructure.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://www.twitter.com/infisical/",
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/Infisical/infisical-cli",
      },
    },
    logo: "https://avatars.githubusercontent.com/u/107880645?s=400&v=4",
  },
  {
    name: "HTMX",
    website: "https://htmx.org/",
    description:
      "HTMX is a dependency-free JavaScript library that allows you to access AJAX, CSS Transitions, WebSockets, and Server Sent Events directly in HTML.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://www.twitter.com/htmx_org/",
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/bigskysoftware/htmx",
      },
      discord: {
        icon: DiscordIcon,
        link: "https://htmx.org/discord",
      },
    },
    logo: "data:image/jpeg;base64,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",
  },
  {
    name: "Crowd.dev",
    website: "https://crowd.dev",
    description:
      "Centralize community, product, and customer data to understand which companies are engaging with your open source project.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/crowd_dev",
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/calcom/cal.com",
      },
      discord: {
        icon: DiscordIcon,
        link: "https://discord.com/invite/zRcwtjmESW",
      },
    },
    logo: "https://res.cloudinary.com/practicaldev/image/fetch/s--Zswn21Dz--/c_fill,f_auto,fl_progressive,h_320,q_auto,w_320/https://dev-to-uploads.s3.amazonaws.com/uploads/organization/profile_image/5928/020fde8d-ff1f-4b12-a454-4a273adaeeed.png",
  },
  {
    name: "Cal.com",
    website: "https://cal.com",
    description:
      "Cal.com is a scheduling tool that helps you schedule meetings without the back-and-forth emails.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/calcom",
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/calcom/cal.com",
      },
      discord: {
        icon: DiscordIcon,
        link: "https://discord.gg/calcom",
      },
    },
    logo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAhFBMVEUpKSn///8AAAAgICAXFxclJSVEREQODg4cHBwREREmJiYVFRWjo6PExMQaGhq7u7tra2vp6en5+fmRkZHx8fHf39+tra2FhYW0tLSdnZ3Ozs47OztSUlLY2Ninp6d1dXVdXV0uLi6KiorJyclzc3NlZWVLS0tVVVWWlpZBQUE1NTV+fn436Xd0AAAFFUlEQVR4nO3Z65KjKBgGYAUZEBNNm/PBHDrHSe7//hb9wKAmPbW1ncl21fv8mGqIGF9BwEwQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwL+jOef6Twep1PjjUf9DWkkWbAfbHZPqq+PU0Lhcf17EJJ0u8rCUF9OvMrLqoF/i713atxCyF3ryG3t66M9MqK6jsGnyNOKPTKhWYUeWPDn4Jybkp3p0joux/bMfPTn6JyZkHxRqsWVMMnYri5d6lArOG2meJNTt4x5WvUcyp4ADxquyYpPwYAPqhC2Pg1MkRRAxQz1JmDKxGhx/x5LXVYopU3XyqrgyTDuzLDGW0Am0X3gVSQG39wcv3tnVQokJTUH7JZvlo1E+Tx8l5NHQDu79kdFCyeXUVi02jI7lg09jq+LpfvxRTE6sCj2sCr/kCwOmw+pCZv7kaZdzOcjrmWfZL//tRQ8Syq03E+952WfJ6eNetbhWN0zuy8L86j7JmI7rL3g+d/93jO616G5S5NCbW0dPEzL/MDNbrUQQ3xpV4baMKOkM95tWsIF3G14XMam+oN8dJmoQdjxIGE1bx6yjbsulcAlzr3biF+bPlqf/StBaOEzbH+jUfv9ivd4/T6h3tuuy3rqozsR0ZFv215MF/TVmLqExKrwhfC8kL9rq8k11+iNvf5BM6NquLEmYWjxLKLOqnDEZJexoBqR0LReqbPmbAnwqlzA3axJbumV3Ywr2yeze5O+haJCdO/M1qzrigyZCzYrHCW0XLmgKjbYn5VqOqYqzEZ3HJTyVQbidwKtllz99UL4Fp0lh2+5DcW70rdg9Tqg+q6J7qyxXeH6oqpbuCBokV00JC5pR5MxrR4Xxi+Yafqy+6tZ+X6JLH9XfyhYPE8bVIN37F5esvSSB2yJsOCWcxHT6m3d6GkcfL0poh9ksbtXTdS7qkUMPVyehrIKv/XmQQmf1CWk5GqbSrTcl6mgbqlH4fvScjNqn7yRcf5Gw52/TKeGslfBiE85twoGfcPDShHbmG7aWo/TS/Fb5eMWPq+rMnySSGc09dcIRPQZvS+gWtN19rhFS22+t5ws7QXYSRtW2PXcXp3k9O8d28hH0bnYSb0voVrTRzvWiXI0DrtPQn0MY9XQjIU+42zD06DCxO0izqaUn27Us7FPwvoSaUyeGn2bVTiMpzfjMl3ZQmS2x4ly5vaeXUMvbZMNsgHBaHhZHH+YPt/ANmRI8ZbQsTJI3JnQrlrnR2Xw4tzu0bWrf/MfT83lahJ2ESTmBFIxv6ZNiej7O86o77bgMi9vq/En7lXyn35kwkO3Nc3lNiZx3a+8JE+rVqbKddNdP4k7LgwremjCQt/Yl5b+FXeSdopnQPr1m9LGi2dRsQVnWrJqXF//WhOaNtXmZRTWz+hc6zVp9eLF9WM9C9tYMypWDNXqRfn19b8JAsGP9ihQWB/vDAzvad4D8xqqP195zWD5htJeUZ9c2X3Pa/sW/6rszCeilgd7xe37C0V9MWG7308N8ls3mtyu7/3jEVpdZtt6kKhDlnGo+SDKjv9RaXbKhdIddp2vTdMDqlzwh+a2XzXqH2C2Mali23NC5xapvChOKK85e4ZU0j+I4jpr/+yTSOE6qKq3pg7iky1fk+L5d1yopm3ZO51epsqEri7IQPSoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAl/4Bf0BGpKiJeOAAAAAASUVORK5CYII=",
  },
  {
    name: "BoxyHQ",
    website: "https://boxyhq.com",
    description:
      "BoxyHQ's suite of APIs for security and privacy helps engineering teams build and ship compliant cloud applications faster.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/boxyhq",
        icon: TwitterIcon,
      },
      github: {
        link: "https://github.com/boxyhq",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.boxyhq.com/",
        icon: DiscordIcon,
      },
    },
    logo: "https://boxyhq.com/img/logo.png",
  },
  {
    name: "Formbricks",
    website: "https://formbricks.com/",
    description:
      "Survey granular user segments at any point in the user journey. Gather up to 6x more insights with targeted micro-surveys. All open-source.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/formbricks",
        icon: TwitterIcon,
      },
      github: {
        link: "https://formbricks.com/github",
        icon: GithubIcon,
      },
    },
    logo: "https://yt3.googleusercontent.com/RgTJBQ3B2_qGr0ORG9GXgSDiNHlBdJkR-luNUUgLQsKZyyJpoaUY7G9ahiP7hhrwZ5Jf25-aYT0=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    name: "GitWonk",
    website: "https://GitWonk.com/",
    description:
      "GitWonk is an open-source technical documentation tool, designed and built focusing on the developer experience.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/getgitwonk",
        icon: TwitterIcon,
      },
      github: {
        link: "https://github.com/gitwonk/gitwonk",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.gitwonk.com/",
        icon: DiscordIcon,
      },
    },
    logo: "https://pbs.twimg.com/profile_images/1644239215549624321/pNFBal3U_400x400.jpg",
  },
  {
    name: "Hanko",
    website: "https://Hanko.io/",
    description:
      "Open-source authentication and user management for the passkey era. Integrated in minutes, for web and mobile apps.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/hanko_io",
        icon: TwitterIcon,
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/teamhanko",
      },
    },
    logo: "https://is4-ssl.mzstatic.com/image/thumb/Purple124/v4/f4/59/bb/f459bb28-a4f7-3219-e642-74c9ad0eed47/source/256x256bb.jpg",
  },
  {
    name: "Novu",
    website: "https://novu.co/",
    description:
      "The open-source notification infrastructure for developers. Simple components and APIs for managing all communication channels in one place.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/novuhq",
        icon: TwitterIcon,
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/novuhq/novu",
      },
      discord: {
        link: "https://discord.gg/novu",
        icon: DiscordIcon,
      },
    },
    logo: "https://yt3.googleusercontent.com/sz2Nt_mcNlt87h3Kqmi578PnXhOtUqfD4_KC4h0cXcr7dDSX5AYThHRYH39kGf-thcSdKaSL=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    name: "OpenBB",
    website: "https://openbb.co/",
    description:
      "Democratizing investment research through an open source financial ecosystem. The OpenBB Terminal allows everyone to perform investment research, from everywhere.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/openbb_finance",
        icon: TwitterIcon,
      },
      github: {
        icon: GithubIcon,
        link: "https://github.com/OpenBB-finance/OpenBBTerminal",
      },
      discord: {
        icon: DiscordIcon,
        link: "https://discord.com/invite/xPHTuHCmuV",
      },
    },
    logo: "https://openbb.co/assets/images/ogimages/Homepage.png",
  },
  {
    name: "Trigger.dev",
    website: "https://trigger.dev/",
    description:
      "The open-source notification infrastructure for developers. Simple components and APIs for managing all communication channels in one place.",
    socialLinks: {
      twitter: {
        link: "https://twitter.com/triggerdotdev",
        icon: TwitterIcon,
      },
      github: {
        link: "https://github.com/triggerdotdev/trigger.dev",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.gg/nkqV9xBYWy",
        icon: DiscordIcon,
      },
    },
    logo: "https://bookface-images.s3.amazonaws.com/small_logos/8069166b83a24a11f284e53cf00c907f928eecad.png",
  },
  {
    name: "Spark.NET",
    website: "https://spark-framework.net/",
    description:
      "The open-source notification infrastructure for developers. Simple components and APIs for managing all communication channels in one place.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/wes_walke",
      },
      github: {
        link: "https://github.com/spark-dotnet",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.gg/TyxmQgvtDw",
        icon: DiscordIcon,
      },
    },
    logo: "data:image/jpeg;base64,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",
  },
  {
    name: "Webiny",
    website: "https://www.webiny.com/",
    description:
      "Open-source enterprise-grade serverless CMS. Own your data. Scale effortlessly. Customize everything.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/WebinyCMS",
      },
      github: {
        link: "https://github.com/webiny/webiny-js",
        icon: GithubIcon,
      },
    },
    logo: "https://avatars.githubusercontent.com/u/3808429?s=200&v=4",
  },
  {
    name: "Sniffnet",
    website: "https://www.sniffnet.net/",
    description:
      "Sniffnet is a network monitoring tool to help you easily keep track of your Internet traffic.",
    socialLinks: {
      github: {
        link: "https://github.com/GyulyVGC/sniffnet",
        icon: GithubIcon,
      },
    },
    logo: "data:image/jpeg;base64,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",
  },
  {
    name: "Twenty",
    website: "https://twenty.com/",
    description:
      "A modern CRM offering the flexibility of open-source, advanced features and sleek design.",
    socialLinks: {
      github: {
        link: "https://github.com/twentyhq/twenty",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.gg/cx5n4Jzs57",
        icon: DiscordIcon,
      },
    },
    logo: "https://bookface-images.s3.amazonaws.com/logos/fcab99ef90c1d9ad9dee8b905bbd332b0d3b8b90.png",
  },
  {
    name: "Webstudio",
    website: "https://webstudio.is/",
    description: "Webstudio is an open source alternative to Webflow",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/getwebstudio",
      },
      github: {
        link: "https://github.com/webstudio-is/webstudio",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.gg/UNdyrDkq5r",
        icon: DiscordIcon,
      },
    },
    logo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBw8QEBUPEBIODxAPDxAPEBAPDxAQEA8QFREWFhURFRUYHSggGBonHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGi0fHSYtLS0yLS0tLS0tLS4rKy0tKy0tLS0tLS0tLS0rLSstLSstLS0tLS0tLS0tLS0tKy0tLf/AABEIAMMBAwMBIgACEQEDEQH/xAAcAAEAAQUBAQAAAAAAAAAAAAAABAIDBQYHAQj/xABAEAACAgADBQYCBwUGBwAAAAAAAQIDBBEhBQYSEzFBUWFxgaEikQcyQnKCscEjUpLR4RQWM0NiomODo7LC0vD/xAAaAQACAwEBAAAAAAAAAAAAAAAABQMEBgIB/8QAMREAAgEDAQUGBgMBAQEAAAAAAAECAwQRIQUSMUFRE4GRobHhImFxwdHwIzJS8UIU/9oADAMBAAIRAxEAPwDs+PxldNbssfDGPV/ojne2t8sRa3GlumGqTg8rJLvcuz0yK9+trO250xf7Ol8LSekrPtN+XT0ZqkmaPZ2z4RiqlRZk9deXuOba0jCCnNZb1+nuVXXSk3KUpSb6uTcm/Nsv4Da+IoedVtkO3JSfC/OL0fqiDKRbcxx2aaw1p3HtSquDOnbr74K9qm/hha9IzWkLH3NdjNxOCVW+mR1zc/a39qwycnnOt8ufjktJeqM7tSwjRXa09FzXT/ovuKccb8OBnwAJiqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADGba2vXhYcUvik/qQXWT/ReJkJySTb6JNvyRzLbWLd9krJPq/hXcuxE9vSVSXxcCle3aoRWP7Ph+SNtfeTF3t52Srg88q624JLubWsvU1y1GRviQLkai1UYrEUl9CnQnKo8yeSVszeTGYVrl3TcV/l2Nzraz6cL6emTOm7qb1VY6PC1y74rOVeeaa/ei+1HHZovYHFWUWRurfDOtqUX+j8Gd3ez6dxDhiXJ/nr6jeEGkd/BC2Rjo4miu+OisgpZZ/VfSUfRpr0BjJb0ZOLWqOzkGJm5SlJ9ZSlJ+beb/ADIczK7cwnJvsq7I2TUfuOWcX8mjFWG5pNOKa4YXoaau/hyuGF6FibLEpF+aI8izFCC4k8lcJG6/Rvj+DEOlvS6Dy+/F5r2z+Ro0WZLZeMdNsLo9a5xnl35PVeqzXqQXdHtaUodV58vM9t5b8XDqd2BaptjOKnF5xnFSi12prNMumFKwAAAAAAAAAAAAAAAAAAAAAAAAAAAAABh958Ty8O++bUF8837JnPL5Gz75YrisVa6VRef3pZPJ+iialfIZ2kNDN38+0uWlwjp+fx3EW5kG4l3Mg2sf28RnZUstFrIcJVFFxRLrZoYUcoy+zN4LqKo1RbUY8WWXjJy/U8Np3e3VjZhq7J5pzi5ejk3H2yAjrXtpGpJSjl5fIhk4ptFv6RMFlZC9LSceCX3o9PZ+xpNiOtb34LnYSaSzlX+1j6Z5+2ZyqyJLsytvUEnxWn48hpaT7S2S5rT8eRDmiLNEyyJGsQ3jIWXUSzmX6ZEeRXTIkktChRnuzOx7iY/m4OMW85UN1PXXhWsPTJpfhNlOZ/Rpj+C6VLelsM196P8ARs6YYnaNLs7iXR6+PuWayxN+IABSIgAAAAAAAIl2Pph9ayKaeTWebT8lqRJ7fw67ZS8YweXudKLfIjlVhD+0ku9GWBh/7xYf/ifwf1L9W2MPLRWJN/vZx93oG5LoEa1OXCSfejIgohNSWcWpJ9Gnmn6lZySAAAAAAACmckk23kkm230SXaVGJ3jxPLw8sussorpn4+35nqWXg4qVFTi5vglnwNF2niXZZOx9Zvi655ZPpn4aL0MXdIk3yIFzH1vAy9unOW8+L18SNayLMv2ssIc0VhGtsaR7FEzZ+Ed1sK49bJxh5JvV+izZHijbfo9wPHiHa1pVDNfelovbP5nNzW7KlKp0Xny8xy/46bl0Oj0UqEVCKyjFKKXckskeF0GI16iXJbsrUk4vpJNPyZyDa2EdVs639mcl6cWh2M5/v/g+G6NqWlkMn96Oj9nEY7OrblRx6/YY7NqYm4PmvNe2TSbIkayJPtiQ7Ymkp1Du6gQbEUwZdtiWhhF5Qhmt2RmdiY103V2r/LnGT8u32zO4VzUkpLo0mvJnz/h5HY9ysfzsHDN5yqzql+FaezRnNt0dI1Fy08dV558S/J79NSNgABniEAplJJZtpJLNt9EjWtrbac84VNqPRy6OXz6I9SK11d07aG9N/Rc39P3QyO0dtV1fDH459yei9TX8ZtG6360mov7C+GPr3+pCdiRalcSxg+Rl7jaVxcaL4Y9F93z9PkXuFDhRFdx5zjtUpMpbkyVkiiUCxzj3nHShJHcHUiy7TdZW+KucoP8A0vLPzXb6me2fvQ18N6/5kF+cf5GucwokyXdU9JIdWl7KOjOl03RnFSg1KL6NPNFw51s3almHlnB5xf1oP6sv5PxN52btCu+HHB/ei/rQfcyrVouGvFD6nUU1lEwAEJ2DT988TnONS6Ri2+nV/wBEbecy2riubZOzsm812adI+2RYto5lkWbVqbtFQX/p+S1Zjb5EK1km6RCtY/t4lOypZZYsZTFHsiqCGi0Rs7SliKK4o6duHgeVhVJr4rpOb+6llE5zg8O7Jxrj9ac4wXnJpHZsNQq4Rrj9WEYxXklkJds1sU401zee5e5JtGW7CMOuvh7+heABnhODBb4YLm4WWX1qnzF5LNS9m36GdLdtalFxeqkmmvBnUJbslLoSUqjpzU1yZxm2JDtiZraWFddkq31hJx9M9H8jGWxNDQrZHVzFPgYy2JFkjIXRIVsRzQnlGfuIa5PaGdA+jTH8Ns6G9LIccfvw6peab/hOe19TN7BxjovruWfwWQby0zj0kvVNog2hS7WlKHVe688Els96LgdvBTCSaTWqazT70anvrt3lL+zVv9pNZza6wi+i8G/yMZCLm8Ihq1Y0oOcuBa29tvmydVb+CLybX2mtTDzuMdTYVTtL8KBkq+/cVN+fH0+S/fmX53FmVxGnaWZWlyFuSwoEx3HnPIDtKeaTqgTqgZBXFSuMbzStWnjtzx0DJK0qVhjlaXI2kbonipE/iJGz9oTosVkH4SXZKPczGxsK+I43OTL9tUcGdS2fjYX1qyD0fVdsX2pko5zu7tZ4e34n+ym0pru7p+h0SLT1Wqeqa7RVcUHSljk+H78hunlZMVvNjOVhpvPKUsq4+cuuXio8T9DnVkzYvpAx/wC0rpT+rGU5JP7UtFmu9JP+I1LmF20p/Cn1EG0JdpXxyWn3/HgeWsiWMv2sizY7oRGmzqWWihIvQRbgi/BFts2VtSNl3CwPMxPMa+GmDn+NvKP/AJP0Olmtbi4Ll4bja+K6Tl+FaR/n6mymT2jV7S4fRaeHvkTbQqb9d44LTwAAKJSAAADQ99sHw3KxLSyOv3lp/I1O6B0ve3CczDuS61vi9OjOeXQLlvWxoPLeXaW6+Wn73GJugQ7YmVugQbYD+2rCy5pkLIk0MsyiXaS/UllFWj8Mzq2yt4IV7N/tNjzdEOW1ms5TWkYrz0Oaf22d1krrHnOyTnJ+Pd5dnoWNqYmzkKpSfL5nMlHvlwpIt4J6Ge7BU6kvm/IX7UT7Td5cfH9wZmuw8stLEZFE5F2lTTKNG2ciudpZlYW5Mttl6FJDSnZ9S67CnjGHpnZNV1xc5zeUYx6tnQNj/R/Wo8WKlKU39it5Rj+Lq2cXFejbrNR93P8AfqTu2S4mgcwKw6bidwcFKLUObXLskp8WXozQd4dgX4KaVi4oSb4LY/Vl4PufgR293QuHuwevR/YilbpkSNpejYY5TLkLCeVEpTo7rMlCwvwmY2FhIrmVZ0yPdJnEbzubtXjrdE38VKzi2+tf9PyNBUi9RiZ1tyrfDJxlHPwayaKteh2tNx58hlbT3lgj7c2lz8Tbb2ObUdc8orRfkR4zMTTJp5PqnkydXM6pRxohMouU8viSJssSK2y2hpSWEajZtLmXIIl4OlznGC6ymor1ZGgjZ9xsFzMSpPpTFz/EmkvzOa9Ts4OfRfvmaVTVKlKp0X/PM6JhMOq641rpCKivRF8AxbedWZNvOrAAAAAAAtXVKUXB9JRcX5NZHMcbh3CUoPrGTi/NPI6maTvbhOG7jXS2Kl+JaP8AT5nM5buGMtmz+KUHzWe9exp90CDdAy90CDdAa2lwSXEDFzieQRJsrKFWOo1lu8RY44ZW6+KLj3r3zLOFiTqYHnKyk/8A7qLbmqt5NHt3Q7SMZ9375nsUeSiX4wDrOqVcltrVYIbgUuon8oze6GyFfiFKSzrpysl3Sln8Efms/wAPiWf/ALFCLky/KlGnFyfBGx7k7vLD186yK59qz1WtcH9ldzfabUAZ6tVlVm5y4sUSk5PLBD2lgK8RVKm2KlCay8U+yS7miYCNNp5XE8OE7d2VPCXypnrw6xl2Tg+kkQFI6v8ASJsbn4bnxX7TDZy06yqf116fW9H3nJ5I2lhcq5oqb48H9fdHM4KSL9dhJrmY2MiVVMlqUxfOODIwmXVIh1yL8WUnHB3QypGN2pXw2KS6TXuuopkTNo18Vb74viXp19syDQcKOJHdW3/myuD1/PmSsyqCKUXIovx0Rp7GjiCLkEdG3CwfBhnY9HbPNP8A0R+Fe/Ec+or4mox1cpKMV3tvJI7DgaFVXCpdK4RgvHJZZifa9bFJQXN+S98Eu1Km5RVNc/Re+CSADPGfAAAAAAAGF3pw3HTxdtcuL0ejM0WsRUpxcH0lFr5nM470WiSlU7Oal0ZzG6shW1GZxFDi3F9Ytp+hDsrKNtdtaD2tDOpiZ0lHKMjKoo5Q1je6cShKlqR66yuyro/QvxrL3LzRBUuskkaeY7pFhAq5ZfhWXeA8jdFqhT0IvLOg7qYDk4dNrKVr5ks+uvRfLI1DZ+E5tsK/3pJPTPTt9jpEIpJJaJLJLwJu1c44K2054Uaa+r+xUADgUAAABROKaaeqaaa70ziG8ezXhsTZV2Rk3Dxg9Y/y9DuRzz6UNnf4eJS651T09Yt+422PX3K24+EvVar7ncOODnMkXKpCUTyBq3qiCdLUm1SJMWQ6mSYMpzieQp6l8xsYZNrueRPTLN0fiz7yPd1GXY7yT6CCLsUUQRdiidj62hiKNg3KwXNxSk1mqk7H3ZppR99fQ6capuBguGmVzWtksl92OX65m1mW2lV367XJafnzEm06u/cNLgtPz5gAFAXgAAAAAAAAAGobxYbhub7LEpevRmGsgbfvJRxVKa6wevlLT88jV5RM5efw3D6PXx98j61n2lFfLTw9sEKVZRyyVKB5wHsbh4PXAjKsuRgXVAqUDyVdnsY4ZYUCrhL3Ae8IK5J4aGU3Uw2dsp6fBDTvUpaL2UjcDC7sU8NDlp8c5PpqlH4cn6xb9TND6gv4456euoivJ79aT6aeAABKVQAAAGE3vwfOwdscs3CPNj4OGr9szNlM4JpppNNZNPo13HUJuElJcnnwPU8anB51kaUMjNY3COuydb1dc51t97jJrP2MfZWa+hc5LtSmnqi3USYEaCJECxMjVPUuoptRUg0RoZ0IaHkEXq4ttJdW0l5stxRndzsHzcXDTSrO6X4X8P8AucTyrNQg5vks+A03lSpub5LPgdG2bh1TTCpfYgk/PLX3zJgBjG222zHttvLAAPDwAAAAAAAAAAs4ipThKD6STXzRpE4tNp9U2n5o301Hb1HBc32T+JfqJtsUswjU6aePv6jLZ1TEnDrr4fvkYxop4S4xkI1MaNFCiVKJUDlybPcFLR6z0rogpSjF6qU1Frwckn7M9hFzko9Wl4g3jVm44GpwqhB5ZxhFPLpxZav55koA22EuBmW8vLAAA8AAAAAAA5nvjheDFzeSSsUbFl4xyb+cZGuWwN538oXMrn2yrlF+UXp/3M0+2Ayta+GkNqS3qUX8vQx0oFcS5OBRFGipz3onap6laPTxHp0X6MMHqN/+j/A8NMrmtZy4I/dik3l6v/ajQ4Rb0WreiXe+467sjCqmiuv92Ec9Ms5dW/mLNrVd2iof6fktfXBFtWruUVD/AE/Ja+uCcADOGcAAAAAAAAAAAAAAYTeWjOEZ9sXk/JmbI+Mq5lcofvJpefZ7kFzS7WlKHVefLzJaNTs6ikaSAwY00Z6AAA8JeyFnfXpn8Wb8uF/0Ihk93P8AHX3JfoWrJZuIJ9ff7ENw8UpfRm1gA15nQAAAAAAAAADWd9q0663lqrGs/BxensjR7YHRN7Ip4Z6aqcMvDU0G6JzGpu1MDey1pY+bMdZEsNEyyJGmjU2U8ovwhllKPQVDAuQhgy+6WC52Kgms4wfMl5Ref55HVTTPo9weUbLn9p8qPkspS/NfI3MzO1Ku/X3f86d/F+pn9qVd+vu/50+79QABcLQAAAAAAAAAAAAAAAANN2xQ4XSXZJ8cXpqpa+zzXoQzcNpYFXQy0UlrGXd4eRqmJw865cM00+z/AFeKfb1Rl9oWkqU3Nf1ev0zyf25Y04jy0uFUiot6r9yWweAXFwGf3Zw7SlY00pZRj497MfszZc7nm8416Zya+t93v8za6q4wioxSUUskkO9l2kt7tpLC5d/P6YFt9cLd7OPHmXAAPhSAAAAAAAAAARNo4fmVTr7ZRaXTr2dTnOIg02msmnk0+xnUTWt4thOxu6lLjyznDpx+K8SOcMtSXFF2yrqEt2XBmiWoiWIyGIg4txaaa6prJrzRBtNFs58DQU0UHsE28km22kklm230SXaz2utyaUU5OTySSzbfcl2m9bqbsupq+9LjWsIPXhenxPx/IY3NzChHel3LqdXFzC3hvS7l1/epndh4LkYeFX2oxznrn+0essn3Zt5eGRkwDJSk5ScnxepkpScpOT4vUAA5OQAAAAAAAAAAAAAAAABaupjNcM4xktNJJNaPNe6ADjoeN4IcdjYf9x/x2fzK69lURearTeX2nKeXkpN5AEc7WhBKUYRT6pLJ3TuKsliUm+9k4AEhyAAAAAAAAAAAAAAAABExmzqbl+1rhPTLNr4l5SWq9DH/AN1MC/8AJ/6t3/sAewr1IY3JNfRtEka9SnpCTX0bRMwezKKP8KuEHk1xKOc2s+jk9X8yeAeOcpSbk8sj35SbcnlgAAAAAAAAAAAAB//Z",
  },
  {
    name: "Tolgee",
    website: "https://tolgee.io/",
    description: "Software localization from A to Z made really easy.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/Tolgee_i18n",
      },
      github: {
        link: "hhttps://github.com/tolgee/tolgee-platform",
        icon: GithubIcon,
      },
    },
    logo: "https://avatars.githubusercontent.com/u/78480209?s=200&v=4",
  },
  {
    name: "Appsmith",
    website: "https://www.appsmith.com/",
    description: "Build build custom software on top of your data.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/theappsmith",
      },
      github: {
        link: "https://github.com/appsmithorg/appsmith",
        icon: GithubIcon,
      },
      discord: {
        link: "https://discord.com/invite/rBTTVJp",
        icon: DiscordIcon,
      },
    },
    logo: "https://www.appsmith.com/favicon.png",
  },
  {
    name: "Ghostfolio",
    website: "https://ghostfol.io/",
    description:
      "Ghostfolio is a privacy-first, open source dashboard for your personal finances. Designed to simplify asset tracking and empower informed investment decisions.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/ghostfolio_",
      },
      github: {
        link: "https://github.com/ghostfolio/ghostfolio",
        icon: GithubIcon,
      },
    },
    logo: "https://getumbrel.github.io/umbrel-apps-gallery/ghostfolio/icon.svg",
  },
  {
    name: "Typebot",
    website: "https://www.typebot.io/",
    description:
      "Typebot gives you powerful blocks to create unique chat experiences. Embed them anywhere on your apps and start collecting results like magic.",
    socialLinks: {
      twitter: {
        icon: TwitterIcon,
        link: "https://twitter.com/Typebot_io",
      },
      github: {
        link: "https://github.com/baptisteArno/typebot.io",
        icon: GithubIcon,
      },
    },
    logo: "https://docs.typebot.io/img/logo.svg",
  },
];
