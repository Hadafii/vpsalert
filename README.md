<div align="center">
  <br><br>
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="public/assets/logotextdark.svg">
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/logotext.svg">
    <img src="public/assets/logotext.svg" alt="VPSAlert logo" width="600">
  </picture>
  <br><br>
</div>

<div align="center">
  <h3>🚀 VPSAlert</h3>
  <p>Realtime Monitoring for OVH VPS Availability with Instant Notifications</p>
</div>

<br />

<div align="center">
  <a href="https://github.com/Hadafii/vpsalert/stargazers">
    <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/Hadafii/vpsalert?style=for-the-badge&color=blueviolet">
  </a>
  <a href="https://github.com/yourname/vpsalert/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/Hadafii/vpsalert?style=for-the-badge&color=magenta">
  </a>
</div>

---

## 📖 About

**VPSAlert** was originally a personal project to avoid refreshing OVH’s site over and over.  
I decided to share it publicly so that anyone who’s hunting for cheap OVH VPS can also benefit.

I’m still a junior developer, so this project is a mix of learning and building something useful.  
If you notice bugs or have ideas for improvement, I’d love your feedback 🙏

---

## 🛠 Tech Stack

- **Frontend** → Next.js 15, React 18, Heroui, Tailwind, Framer Motion, GSAP
- **Backend** → Next.js API Routes, MySQL (mysql2), Nodemailer, Zod
- **Realtime** → Server-Sent Events (SSE)
- **Validation & Security** → Zod, Validator, Sanitization

---

## 📦 Installation

```bash
# clone repo
git clone https://github.com/yourname/vpsalert.git

cd vpsalert

# install dependencies
npm install

# setup environment
cp .env.example .env.local

# run dev
npm run dev
```
